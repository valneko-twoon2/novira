//! Upscaling redraws the enlarged picture in overlapping tiles of about the size the model draws at: a model drawing the
//! whole picture at once would take many times longer per step and break into blocks of its own patch size, far past
//! the size it was trained at. Each tile is cut from the enlarged picture, redrawn, and laid over the tiles before it
//! with a feathered edge where they overlap.
use super::graph::{link, Builder};
use serde_json::{json, Value};

/// The least overlap of two neighbouring tiles, in pixels: the width of the blend between them.
pub const OVERLAP: u32 = 128;
const MIN_TILE: u32 = 512;
const MAX_TILE: u32 = 1024;

/// One tile of the output: where it is cut, its size, and how far its left and top edges are feathered into the tiles
/// laid before it (0 on the picture's edge).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Tile {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub feather_left: u32,
    pub feather_top: u32,
}

/// The side of a square tile for a source picture: about its area, which is the size it was drawn at when the model
/// made it, in steps of 64 between 512 and 1024.
pub fn tile_side(source_width: u32, source_height: u32) -> u32 {
    let side = (f64::from(source_width) * f64::from(source_height)).sqrt();
    (((side / 64.0).round() as u32) * 64).clamp(MIN_TILE, MAX_TILE)
}

/// Starts of the tiles along one side of `length`: evenly spread, the first at 0 and the last at the end, each pair
/// overlapping by at least `OVERLAP`. One tile when the side fits in one.
fn starts(length: u32, tile: u32) -> Vec<u32> {
    if length <= tile {
        return vec![0];
    }
    let step = tile - OVERLAP;
    let count = (length - OVERLAP).div_ceil(step);
    let span = u64::from(length - tile);
    (0..count)
        .map(|i| (span * u64::from(i) / u64::from(count - 1)) as u32)
        .collect()
}

/// The tiles of an output of `width` × `height`, row by row.
pub fn grid(width: u32, height: u32, tile: u32) -> Vec<Tile> {
    let (xs, ys) = (starts(width, tile), starts(height, tile));
    let (tw, th) = (tile.min(width), tile.min(height));
    let overlap = |starts: &[u32], i: usize, size: u32| match i {
        0 => 0,
        _ => starts[i - 1] + size - starts[i],
    };
    let mut tiles = Vec::new();
    for (j, &y) in ys.iter().enumerate() {
        for (i, &x) in xs.iter().enumerate() {
            tiles.push(Tile {
                x,
                y,
                width: tw,
                height: th,
                feather_left: overlap(&xs, i, tw),
                feather_top: overlap(&ys, j, th),
            });
        }
    }
    tiles
}

/// What every tile is redrawn with.
pub struct Redraw<'a> {
    pub model: &'a Value,
    pub positive: &'a Value,
    pub negative: &'a Value,
    pub vae: &'a Value,
    /// The enlarged picture at the output size.
    pub picture: &'a Value,
    pub seed: u64,
    pub steps: u32,
    pub cfg: f64,
    pub sampler: &'a str,
    pub scheduler: &'a str,
    pub denoise: f64,
    /// The tile ControlNet's loader and strength; its picture is the tile's own cut.
    pub control: Option<(&'a str, f64)>,
    /// The newer families take the VAE in their ControlNet.
    pub control_vae: bool,
}

/// Adds the redraw of each tile and returns the finished picture and each tile's sampler with the steps before it.
pub fn redraw(g: &mut Builder, r: &Redraw<'_>, tiles: &[Tile]) -> (Value, Vec<(String, u32)>) {
    let mut result = r.picture.clone();
    let mut passes = Vec::new();
    for (i, t) in tiles.iter().enumerate() {
        let cut = link(
            &g.add(
                "ImageCrop",
                json!({ "image": r.picture, "width": t.width, "height": t.height, "x": t.x, "y": t.y }),
            ),
            0,
        );
        let (mut positive, mut negative) = (r.positive.clone(), r.negative.clone());
        if let Some((net, strength)) = r.control {
            let mut inputs = json!({
                "positive": positive,
                "negative": negative,
                "control_net": link(net, 0),
                "image": cut,
                "strength": strength,
                "start_percent": 0.0,
                "end_percent": 1.0,
            });
            if r.control_vae {
                inputs["vae"] = r.vae.clone();
            }
            let id = g.add("ControlNetApplyAdvanced", inputs);
            positive = link(&id, 0);
            negative = link(&id, 1);
        }
        let encoded = g.add("VAEEncode", json!({ "pixels": cut, "vae": r.vae }));
        let sampled = g.add(
            "KSampler",
            json!({
                "model": r.model,
                "seed": r.seed,
                "steps": r.steps,
                "cfg": r.cfg,
                "sampler_name": r.sampler,
                "scheduler": r.scheduler,
                "positive": positive,
                "negative": negative,
                "latent_image": link(&encoded, 0),
                "denoise": r.denoise,
            }),
        );
        let decoded = g.add(
            "VAEDecode",
            json!({ "samples": link(&sampled, 0), "vae": r.vae }),
        );
        let mut inputs = json!({
            "destination": result,
            "source": link(&decoded, 0),
            "x": t.x,
            "y": t.y,
            "resize_source": false,
        });
        if t.feather_left > 0 || t.feather_top > 0 {
            let solid = g.add(
                "SolidMask",
                json!({ "value": 1.0, "width": t.width, "height": t.height }),
            );
            let mask = g.add(
                "FeatherMask",
                json!({ "mask": link(&solid, 0), "left": t.feather_left, "top": t.feather_top, "right": 0, "bottom": 0 }),
            );
            inputs["mask"] = link(&mask, 0);
        }
        result = link(&g.add("ImageCompositeMasked", inputs), 0);
        passes.push((sampled, r.steps * i as u32));
    }
    (result, passes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_tile_is_about_the_size_the_source_was_drawn_at() {
        assert_eq!(tile_side(888, 1184), 1024);
        assert_eq!(tile_side(512, 768), 640);
        assert_eq!(tile_side(256, 256), 512);
        assert_eq!(tile_side(4000, 3000), 1024);
    }

    #[test]
    fn a_side_that_fits_is_one_tile_and_a_longer_one_is_covered_with_overlaps() {
        assert_eq!(starts(1024, 1024), vec![0]);
        assert_eq!(starts(800, 1024), vec![0]);
        assert_eq!(starts(1025, 1024), vec![0, 1]);
        assert_eq!(starts(2048, 1024), vec![0, 512, 1024]);
        for (length, tile) in [(3552, 1024), (4736, 1024), (1600, 640), (16384, 512)] {
            let s = starts(length, tile);
            assert_eq!(s[0], 0);
            assert_eq!(*s.last().unwrap() + tile, length, "{length}");
            for pair in s.windows(2) {
                assert!(pair[0] + tile >= pair[1] + OVERLAP, "{length}: {pair:?}");
            }
        }
    }

    #[test]
    fn the_grid_covers_the_output_row_by_row_and_feathers_only_into_earlier_tiles() {
        let tiles = grid(3552, 4736, 1024);
        assert_eq!(tiles.len(), 4 * 6);
        assert_eq!(
            tiles[0],
            Tile {
                x: 0,
                y: 0,
                width: 1024,
                height: 1024,
                feather_left: 0,
                feather_top: 0
            }
        );
        assert!(tiles[1].feather_left >= OVERLAP && tiles[1].feather_top == 0);
        assert!(tiles[4].feather_left == 0 && tiles[4].feather_top >= OVERLAP);
        let last = tiles.last().unwrap();
        assert_eq!((last.x + last.width, last.y + last.height), (3552, 4736));
        // A small output is one tile of its own size.
        assert_eq!(
            grid(800, 600, 1024),
            vec![Tile {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
                feather_left: 0,
                feather_top: 0
            }]
        );
    }
}
