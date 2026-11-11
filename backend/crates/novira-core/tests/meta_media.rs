//! Metamorphic tests of the picture functions in `media/` (export, thumbnails, PNG text chunks): the exact bytes of a
//! resampled picture are not stated anywhere, but relations between two runs are. The size follows the request, a
//! second export of the same picture is the same, a lossless export keeps the pixels whatever the format, leaving out
//! the settings changes no pixel, a mirrored picture exports to the mirrored picture.
//! There is no crop in the backend (the canvas crops in the WebView), so no crop relation is here. The watermark needs
//! the TrustMark model files and runs only in the ignored live test (`watermark_live.rs`); it is not covered here.
//! In process only. Run: `cargo test -p novira-core --test meta_media`.
mod prop_common;

use image::{DynamicImage, GenericImageView, ImageFormat, RgbImage, RgbaImage};
use novira_core::media::export::{encode, target_size, ExportFormat, ExportOptions};
use novira_core::media::images::{
    read_text, to_png, with_text, ImageFiles, METADATA_KEY, WORKFLOW_KEY,
};
use prop_common::{check, check_up_to};
use proptest::prelude::*;

/// A picture of noise that depends on `seed` only, so shrinking keeps the case small and repeatable.
fn noise(w: u32, h: u32, seed: u64, alpha: bool, flat: bool) -> DynamicImage {
    let value = |x: u32, y: u32, c: u32| -> u8 {
        if flat {
            return (seed >> (c * 8)) as u8;
        }
        let mut v = seed
            ^ (u64::from(x) << 40)
            ^ (u64::from(y) << 20)
            ^ u64::from(c).wrapping_mul(0x9E37_79B9_7F4A_7C15);
        v = (v ^ (v >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        v = (v ^ (v >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        (v ^ (v >> 31)) as u8
    };
    if alpha {
        DynamicImage::ImageRgba8(RgbaImage::from_fn(w, h, |x, y| {
            image::Rgba([
                value(x, y, 0),
                value(x, y, 1),
                value(x, y, 2),
                value(x, y, 3),
            ])
        }))
    } else {
        DynamicImage::ImageRgb8(RgbImage::from_fn(w, h, |x, y| {
            image::Rgb([value(x, y, 0), value(x, y, 1), value(x, y, 2)])
        }))
    }
}

fn png_bytes(img: &DynamicImage) -> Vec<u8> {
    let mut out = std::io::Cursor::new(Vec::new());
    img.write_to(&mut out, ImageFormat::Png).unwrap();
    out.into_inner()
}

#[derive(Debug, Clone)]
struct Pic {
    w: u32,
    h: u32,
    seed: u64,
    alpha: bool,
    flat: bool,
}

impl Pic {
    fn image(&self) -> DynamicImage {
        noise(self.w, self.h, self.seed, self.alpha, self.flat)
    }
}

fn pic() -> impl Strategy<Value = Pic> {
    (
        1u32..72,
        1u32..72,
        any::<u64>(),
        any::<bool>(),
        prop::bool::weighted(0.2),
    )
        .prop_map(|(w, h, seed, alpha, flat)| Pic {
            w,
            h,
            seed,
            alpha,
            flat,
        })
}

fn enc(original: &[u8], o: &ExportOptions) -> Result<Vec<u8>, TestCaseError> {
    encode(original, o).map_err(TestCaseError::fail)
}

fn options(format: ExportFormat, max_side: Option<u32>, remove_info: bool) -> ExportOptions {
    ExportOptions {
        format,
        quality: 90,
        max_side,
        remove_info,
        watermark: false,
    }
}

fn lossless() -> impl Strategy<Value = ExportFormat> {
    prop::sample::select(&[ExportFormat::Png, ExportFormat::Webp][..])
}

fn any_format() -> impl Strategy<Value = ExportFormat> {
    prop::sample::select(&[ExportFormat::Png, ExportFormat::Webp, ExportFormat::Jpeg][..])
}

fn decode(bytes: &[u8]) -> DynamicImage {
    image::load_from_memory(bytes).unwrap()
}

/// The largest difference of any colour channel of two pictures of the same size.
fn max_diff(a: &DynamicImage, b: &DynamicImage) -> u8 {
    assert_eq!(a.dimensions(), b.dimensions());
    a.to_rgba8()
        .as_raw()
        .iter()
        .zip(b.to_rgba8().as_raw())
        .map(|(x, y)| x.abs_diff(*y))
        .max()
        .unwrap_or(0)
}

// tags: boundary
#[test]
fn an_export_has_the_requested_size_and_never_enlarges() {
    check(
        (pic(), any_format(), prop::option::of(16u32..100)),
        |(p, format, max)| {
            let out = decode(&enc(&png_bytes(&p.image()), &options(format, max, true))?);
            let (w, h) = out.dimensions();
            let longest = p.w.max(p.h);
            match max {
                Some(m) if longest > m => {
                    prop_assert_eq!(w.max(h), m, "the longest side is the request");
                    // The other side keeps the proportion within a pixel.
                    let (long, short, out_short) = if p.w >= p.h {
                        (p.w, p.h, h)
                    } else {
                        (p.h, p.w, w)
                    };
                    let exact = f64::from(short) * f64::from(m) / f64::from(long);
                    prop_assert!(
                        (f64::from(out_short) - exact).abs() <= 1.0,
                        "{}x{} -> {}x{}",
                        p.w,
                        p.h,
                        w,
                        h
                    );
                }
                _ => prop_assert_eq!(
                    (w, h),
                    (p.w, p.h),
                    "a picture is not enlarged or changed in size"
                ),
            }
            prop_assert_eq!(
                (w, h),
                target_size(p.w, p.h, max),
                "the stated size is the real size"
            );
            Ok(())
        },
    );
}

// tags: boundary
#[test]
fn exporting_twice_to_a_smaller_size_keeps_the_proportion_of_exporting_once() {
    check(
        (pic(), 40u32..100, 16u32..40, any_format()),
        |(p, first, second, format)| {
            let original = png_bytes(&p.image());
            let direct = decode(&enc(
                &original,
                &options(ExportFormat::Png, Some(second), true),
            )?);
            let step = enc(&original, &options(format, Some(first), true))?;
            // The second export reads what the first wrote (PNG, WebP or JPEG), as a shared copy would be shared again.
            let again = decode(&enc(
                &step,
                &options(ExportFormat::Png, Some(second), true),
            )?);
            let ((dw, dh), (aw, ah)) = (direct.dimensions(), again.dimensions());
            prop_assert!(
                dw.abs_diff(aw) <= 1 && dh.abs_diff(ah) <= 1,
                "{}x{} via {} gives {}x{} against {}x{}",
                p.w,
                p.h,
                first,
                aw,
                ah,
                dw,
                dh
            );
            // And exporting to the size a picture already has changes nothing in size.
            let same = decode(&enc(&step, &options(ExportFormat::Png, Some(first), true))?);
            prop_assert_eq!(same.dimensions(), decode(&step).dimensions());
            Ok(())
        },
    );
}

// tags: condition
#[test]
fn exporting_the_same_picture_twice_gives_the_same_bytes() {
    check(
        (
            pic(),
            any_format(),
            prop::option::of(16u32..100),
            any::<bool>(),
        ),
        |(p, format, max, strip)| {
            let original = png_bytes(&p.image());
            let o = options(format, max, strip);
            prop_assert_eq!(enc(&original, &o)?, enc(&original, &o)?);
            Ok(())
        },
    );
}

// tags: decision-table
#[test]
fn a_lossless_export_without_resizing_keeps_every_pixel() {
    check((pic(), lossless()), |(p, format)| {
        let source = p.image();
        let out = decode(&enc(&png_bytes(&source), &options(format, None, true))?);
        prop_assert_eq!(out.dimensions(), source.dimensions());
        prop_assert_eq!(max_diff(&out, &source), 0);
        // A size limit at or above the picture is the same as none.
        let roomy = decode(&enc(
            &png_bytes(&source),
            &options(format, Some(p.w.max(p.h).max(16)), true),
        )?);
        prop_assert_eq!(max_diff(&roomy, &source), 0);
        Ok(())
    });
}

// tags: boundary
#[test]
fn the_lossless_formats_resize_to_the_same_pixels() {
    check((pic(), prop::option::of(16u32..100)), |(p, max)| {
        let original = png_bytes(&p.image());
        let png = decode(&enc(&original, &options(ExportFormat::Png, max, true))?);
        let webp = decode(&enc(&original, &options(ExportFormat::Webp, max, true))?);
        prop_assert_eq!(max_diff(&png, &webp), 0);
        Ok(())
    });
}

// tags: condition
#[test]
fn leaving_out_the_settings_changes_no_pixel_and_keeping_them_keeps_the_text() {
    check(
        (
            pic(),
            "[ -~]{0,40}",
            "[ -~]{0,40}",
            prop::option::of(16u32..100),
        ),
        |(p, meta, flow, max)| {
            let plain = png_bytes(&p.image());
            let tagged = with_text(&plain, METADATA_KEY, &meta)
                .and_then(|b| with_text(&b, WORKFLOW_KEY, &flow))
                .unwrap();
            let kept = enc(&tagged, &options(ExportFormat::Png, max, false))?;
            let stripped = enc(&tagged, &options(ExportFormat::Png, max, true))?;
            prop_assert_eq!(max_diff(&decode(&kept), &decode(&stripped)), 0);
            // The same pixels as exporting the picture that never had settings.
            prop_assert_eq!(
                &stripped,
                &enc(&plain, &options(ExportFormat::Png, max, true))?
            );
            prop_assert_eq!(read_text(&kept, METADATA_KEY), Some(meta));
            prop_assert_eq!(read_text(&kept, WORKFLOW_KEY), Some(flow));
            prop_assert_eq!(read_text(&stripped, METADATA_KEY), None);
            prop_assert_eq!(read_text(&stripped, WORKFLOW_KEY), None);
            Ok(())
        },
    );
}

// tags: condition
#[test]
fn a_mirrored_picture_exports_to_the_mirrored_export() {
    // Resampling with a symmetric filter commutes with mirroring; one level of rounding is allowed, no more.
    check((pic(), 16u32..48, lossless()), |(p, max, format)| {
        let source = p.image();
        let o = options(format, Some(max), true);
        let then_mirror = decode(&enc(&png_bytes(&source), &o)?).fliph();
        let mirror_then = decode(&enc(&png_bytes(&source.fliph()), &o)?);
        prop_assert_eq!(then_mirror.dimensions(), mirror_then.dimensions());
        let worst = max_diff(&then_mirror, &mirror_then);
        prop_assert!(worst <= 1, "mirror and export differ by {}", worst);
        // Turning the picture a quarter makes the sizes swap.
        let turned = decode(&enc(&png_bytes(&source.rotate90()), &o)?);
        let (w, h) = decode(&enc(&png_bytes(&source), &o)?).dimensions();
        prop_assert_eq!(turned.dimensions(), (h, w));
        Ok(())
    });
}

// tags: condition
#[test]
fn the_best_jpeg_quality_is_no_further_from_the_original_than_the_worst() {
    // Only the two ends are compared and only on a picture of some size: JPEG is not monotone between close
    // qualities (found at 1x2 pixels, 38 against 64), which says nothing about the export.
    check(
        (16u32..72, 16u32..72, any::<u64>(), any::<bool>()),
        |(w, h, seed, alpha)| {
            let (low, high) = (1u8, 100u8);
            let p = Pic {
                w,
                h,
                seed,
                alpha,
                flat: false,
            };
            let source = p.image();
            let original = png_bytes(&source);
            let mean_error = |quality: u8| {
                let mut o = options(ExportFormat::Jpeg, None, true);
                o.quality = quality;
                let out = decode(&enc(&original, &o).unwrap()).to_rgb8();
                // Compare on white, as JPEG has no transparency.
                let reference = flatten(&source);
                out.as_raw()
                    .iter()
                    .zip(reference.as_raw())
                    .map(|(a, b)| u64::from(a.abs_diff(*b)))
                    .sum::<u64>()
            };
            let (worse, better) = (mean_error(low), mean_error(high));
            prop_assert!(
                better <= worse,
                "quality {} off by {}, quality {} off by {}",
                high,
                better,
                low,
                worse
            );
            Ok(())
        },
    );
}

fn flatten(img: &DynamicImage) -> RgbImage {
    let rgba = img.to_rgba8();
    RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
        let [r, g, b, a] = rgba.get_pixel(x, y).0;
        let a = u32::from(a);
        let mix = |c: u8| ((u32::from(c) * a + 255 * (255 - a) + 127) / 255) as u8;
        image::Rgb([mix(r), mix(g), mix(b)])
    })
}

// tags: condition
#[test]
fn a_stored_thumbnail_fits_the_box_and_keeps_the_proportion() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    check_up_to(
        48,
        (1u32..700, 1u32..700, any::<u64>(), any::<bool>()),
        |(w, h, seed, alpha)| {
            let source = noise(w, h, seed, alpha, true);
            let (sw, sh) = files.store("pic.png", &png_bytes(&source)).unwrap();
            prop_assert_eq!((sw, sh), (w, h), "the stored size is the picture's size");
            let thumb = decode(&files.read_thumbnail("pic.png").unwrap());
            let (tw, th) = thumb.dimensions();
            prop_assert!(tw <= 256 && th <= 256, "{}x{} -> {}x{}", w, h, tw, th);
            prop_assert!(tw >= 1 && th >= 1);
            // The proportion is kept to a pixel on the shorter side.
            let (long, short, out_long, out_short) = if w >= h {
                (w, h, tw, th)
            } else {
                (h, w, th, tw)
            };
            let exact = f64::from(short) * f64::from(out_long) / f64::from(long);
            prop_assert!(
                (f64::from(out_short) - exact).abs() <= 1.0,
                "{}x{} -> {}x{}",
                w,
                h,
                tw,
                th
            );
            // A picture larger than the box fills it along its long side.
            if long > 256 {
                prop_assert_eq!(out_long, 256);
            }
            Ok(())
        },
    );
}

// tags: condition
#[test]
fn a_text_chunk_round_trips_and_leaves_the_pixels_and_other_keys_alone() {
    check(
        (pic(), "[ -~]{0,60}", "[ -~]{0,60}", "[ -~]{0,60}"),
        |(p, a, b, other)| {
            let plain = png_bytes(&p.image());
            let with_a = with_text(&plain, METADATA_KEY, &a).unwrap();
            prop_assert_eq!(read_text(&with_a, METADATA_KEY), Some(a.clone()));
            prop_assert_eq!(max_diff(&decode(&with_a), &p.image()), 0);
            // Writing a key again replaces it, so writing twice equals writing the last one.
            let twice = with_text(&with_a, METADATA_KEY, &b).unwrap();
            prop_assert_eq!(&twice, &with_text(&plain, METADATA_KEY, &b).unwrap());
            // Another key does not disturb the first, in either order.
            let both = with_text(&twice, WORKFLOW_KEY, &other).unwrap();
            let reversed = with_text(
                &with_text(&plain, WORKFLOW_KEY, &other).unwrap(),
                METADATA_KEY,
                &b,
            )
            .unwrap();
            prop_assert_eq!(read_text(&both, METADATA_KEY), Some(b.clone()));
            prop_assert_eq!(read_text(&reversed, METADATA_KEY), Some(b));
            prop_assert_eq!(read_text(&both, WORKFLOW_KEY), Some(other.clone()));
            prop_assert_eq!(read_text(&reversed, WORKFLOW_KEY), Some(other));
            Ok(())
        },
    );
}

// tags: condition
#[test]
fn turning_any_accepted_picture_into_png_keeps_its_pixels_and_a_png_stays_the_same_bytes() {
    check(
        (
            pic(),
            prop::sample::select(&[ImageFormat::Png, ImageFormat::Bmp, ImageFormat::Jpeg][..]),
        ),
        |(p, format)| {
            let source = if matches!(format, ImageFormat::Jpeg | ImageFormat::Bmp) {
                DynamicImage::ImageRgb8(p.image().to_rgb8())
            } else {
                p.image()
            };
            let mut encoded = std::io::Cursor::new(Vec::new());
            source.write_to(&mut encoded, format).unwrap();
            let encoded = encoded.into_inner();
            let png = to_png(&encoded)?;
            prop_assert_eq!(max_diff(&decode(&png), &decode(&encoded)), 0);
            if format == ImageFormat::Png {
                prop_assert_eq!(&png, &encoded);
            }
            // Converting what was converted changes nothing.
            prop_assert_eq!(to_png(&png)?, png);
            Ok(())
        },
    );
}
