//! Mutation fuzzing of the readers of files that come from outside: a valid file of each kind is damaged many times
//! (bits flipped, cut short, bytes put in or taken out, a range copied elsewhere, a length field set to an edge value,
//! a piece of another file spliced in) and read again. Random bytes stop at the first check of a format; a damaged valid
//! file reaches the code behind it. Each reader must answer or refuse, never panic, and refuse in reasonable time.
//!
//! Runs on stable Rust in the ordinary test run with a fixed seed and 200 cases per reader. A longer search:
//! `NOVIRA_FUZZ_ITERATIONS=20000 NOVIRA_FUZZ_SEED=<n> cargo test -p novira-core --test fuzz_inputs`. An input that
//! panics is saved to `novira-data/work/fuzz/<reader>-<seed>-<case>.bin`; a finding is pinned as an ordinary test.
use novira_core::backup::restore::{stage, STAGING};
use novira_core::backup::{DATABASE, MANIFEST, UI_STATE};
use novira_core::db::Db;
use novira_core::media::images::{check_limits, read_text, to_png, with_text};
use novira_core::models::classify::{
    detect_base, detect_kind, detect_variant, parse_header, read_header,
};
use novira_core::provenance::{credentials, xmp};
use novira_core::types::ModelType;
use std::io::Write;
use std::panic::AssertUnwindSafe;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

/// The slowest a single damaged input may take to be read or refused.
const SLOWEST: Duration = Duration::from_secs(10);

fn setting(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

/// A small seeded generator (xorshift64*), so a run is repeated exactly from its seed.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    /// A number below `n` (0 when `n` is 0).
    fn below(&mut self, n: usize) -> usize {
        if n == 0 {
            0
        } else {
            (self.next() % n as u64) as usize
        }
    }
}

/// `seed` damaged one to four times; `other` is a second file to splice from.
fn mutate(rng: &mut Rng, seed: &[u8], other: &[u8]) -> Vec<u8> {
    const EDGES: [u64; 8] = [0, 1, 0x7f, 0xff, 0xffff, 0x7fff_ffff, 0xffff_ffff, u64::MAX];
    let mut v = seed.to_vec();
    for _ in 0..1 + rng.below(4) {
        let len = v.len();
        match rng.below(8) {
            0 if len > 0 => {
                let at = rng.below(len);
                v[at] ^= 1 << rng.below(8);
            }
            1 if len > 0 => {
                let at = rng.below(len);
                v[at] = [0, 0xff, 0x7f, 0x80, rng.next() as u8][rng.below(5)];
            }
            2 => v.truncate(rng.below(len + 1)),
            3 => {
                let at = rng.below(len + 1);
                let extra: Vec<u8> = (0..1 + rng.below(16)).map(|_| rng.next() as u8).collect();
                v.splice(at..at, extra);
            }
            4 if len > 0 => {
                let at = rng.below(len);
                let end = (at + 1 + rng.below(64)).min(len);
                v.drain(at..end);
            }
            5 if len > 0 => {
                let at = rng.below(len);
                let end = (at + 1 + rng.below(64)).min(len);
                let piece = v[at..end].to_vec();
                let to = rng.below(len + 1);
                v.splice(to..to, piece);
            }
            6 if len >= 8 => {
                let at = rng.below(len - 7);
                let edge = EDGES[rng.below(EDGES.len())];
                let bytes = if rng.below(2) == 0 {
                    edge.to_le_bytes()
                } else {
                    edge.to_be_bytes()
                };
                let width = [2, 4, 8][rng.below(3)];
                v[at..at + width].copy_from_slice(&bytes[..width]);
            }
            7 if !other.is_empty() => {
                let from = rng.below(other.len());
                let end = (from + 1 + rng.below(256)).min(other.len());
                let at = rng.below(len + 1);
                let cut = (at + rng.below(64)).min(len);
                v.splice(at..cut, other[from..end].iter().copied());
            }
            _ => {}
        }
    }
    v
}

/// Feeds `cases` damaged copies of the seeds to `read`. A panic saves the input and fails the test with where it is.
fn fuzz(reader: &str, seeds: &[Vec<u8>], mut read: impl FnMut(&[u8])) {
    let cases = setting("NOVIRA_FUZZ_ITERATIONS", 200);
    let seed = setting("NOVIRA_FUZZ_SEED", 0x6e6f_7669_7261);
    let mut rng = Rng(seed | 1);
    for case in 0..cases {
        let pick = rng.below(seeds.len());
        let input = mutate(&mut rng, &seeds[pick], &seeds[(pick + 1) % seeds.len()]);
        let started = Instant::now();
        let outcome = std::panic::catch_unwind(AssertUnwindSafe(|| read(&input)));
        let took = started.elapsed();
        if outcome.is_err() || took > SLOWEST {
            let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../novira-data/work/fuzz");
            let _ = std::fs::create_dir_all(&dir);
            let file = dir.join(format!("{reader}-{seed}-{case}.bin"));
            let _ = std::fs::write(&file, &input);
            let what = if outcome.is_err() {
                "panicked".to_string()
            } else {
                format!("took {took:?}")
            };
            panic!(
                "{reader} {what} on case {case} of seed {seed}; the input is {}",
                file.display()
            );
        }
    }
}

fn picture(format: image::ImageFormat, w: u32, h: u32) -> Vec<u8> {
    let img = image::RgbImage::from_fn(w, h, |x, y| image::Rgb([x as u8 * 9, y as u8 * 13, 77]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, format)
        .unwrap();
    out.into_inner()
}

#[test]
fn damaged_pictures_of_every_format_are_read_or_refused() {
    use image::ImageFormat::{Bmp, Gif, Jpeg, Png, WebP};
    let png = picture(Png, 9, 7);
    let seeds = vec![
        with_text(&png, "novira", r#"{"positivePrompt":"a cat"}"#).unwrap(),
        picture(Jpeg, 9, 7),
        picture(WebP, 9, 7),
        picture(Gif, 9, 7),
        picture(Bmp, 9, 7),
        xmp::add(&png, Png).unwrap(),
    ];
    fuzz("picture", &seeds, |bytes| {
        let _ = check_limits(bytes);
        if let Ok(converted) = to_png(bytes) {
            assert!(
                image::load_from_memory(&converted).is_ok(),
                "a kept picture decodes"
            );
        }
        let _ = read_text(bytes, "novira");
        let _ = xmp::digital_source_type(bytes);
    });
}

#[test]
fn damaged_content_credentials_are_read_or_refused() {
    let identity = credentials::Identity::generate().unwrap();
    let png = picture(image::ImageFormat::Png, 16, 16);
    let jpeg = picture(image::ImageFormat::Jpeg, 16, 16);
    let seeds = vec![
        credentials::sign(
            &png,
            "image/png",
            &identity,
            Some(("com.adobe.trustmark.Q", "0101")),
        )
        .unwrap(),
        credentials::sign(&jpeg, "image/jpeg", &identity, None).unwrap(),
    ];
    assert!(credentials::read(&seeds[0], "image/png", Some(&identity)).present);
    fuzz("credentials", &seeds, |bytes| {
        for mime in ["image/png", "image/jpeg"] {
            let found = credentials::read(bytes, mime, Some(&identity));
            assert!(
                found.present || !found.valid,
                "a missing manifest is not valid"
            );
        }
    });
}

/// A safetensors file: the header's length, the JSON header, then the tensor bytes.
fn safetensors(header: &str, data: usize) -> Vec<u8> {
    let mut out = (header.len() as u64).to_le_bytes().to_vec();
    out.extend_from_slice(header.as_bytes());
    out.extend(std::iter::repeat_n(0u8, data));
    out
}

#[test]
fn damaged_model_headers_are_read_or_refused() {
    let seeds = vec![
        safetensors(
            r#"{"__metadata__":{"modelspec.architecture":"stable-diffusion-xl-v1-base"},"conditioner.embedders.1.model.ln_final.weight":{"dtype":"F16","shape":[1280],"data_offsets":[0,2560]},"model.diffusion_model.input_blocks.0.0.weight":{"dtype":"F16","shape":[320,4,3,3],"data_offsets":[2560,25600]}}"#,
            25600,
        ),
        safetensors(
            r#"{"lora_unet_down_blocks_0_attentions_0_proj_in.lora_down.weight":{"dtype":"F16","shape":[8,320],"data_offsets":[0,5120]},"lora_unet_down_blocks_0_attentions_0_proj_in.alpha":{"dtype":"F32","shape":[],"data_offsets":[5120,5124]}}"#,
            5124,
        ),
    ];
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("m.safetensors");
    fuzz("model-header", &seeds, |bytes| {
        let parsed = parse_header(bytes);
        std::fs::write(&path, bytes).unwrap();
        let read = read_header(&path);
        for header in [parsed.as_ref(), read.as_ref()].into_iter().flatten() {
            let kind = detect_kind(header).unwrap_or(ModelType::Main);
            let base = detect_base(kind, Some(header), "m.safetensors");
            let _ = detect_variant(base, Some(header), "m.safetensors");
        }
    });
}

/// A backup zip as novira writes one: the manifest, the database, the screen state, a picture and its thumbnail.
fn backup_zip() -> Vec<u8> {
    let made = tempfile::tempdir().unwrap();
    drop(Db::open(made.path()).unwrap());
    let manifest = serde_json::json!({
        "format": "novira-backup", "version": 1, "appVersion": "0.0.0", "createdAt": 1,
        "images": 1, "boards": 0, "workflows": 0
    });
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    for (name, bytes) in [
        (MANIFEST, serde_json::to_vec(&manifest).unwrap()),
        (DATABASE, std::fs::read(made.path().join(DATABASE)).unwrap()),
        (UI_STATE, br#"{"novira.settings":"{}"}"#.to_vec()),
        ("outputs/a.png", picture(image::ImageFormat::Png, 4, 4)),
        ("thumbnails/a.thumb", b"thumb".to_vec()),
    ] {
        zip.start_file(name, zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(&bytes).unwrap();
    }
    zip.finish().unwrap().into_inner()
}

/// Every file under `dir`, as paths relative to it.
fn files_under(dir: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
        let path = entry.path();
        if path.is_dir() {
            out.extend(
                files_under(&path)
                    .into_iter()
                    .map(|p| PathBuf::from(entry.file_name()).join(p)),
            );
        } else {
            out.push(PathBuf::from(entry.file_name()));
        }
    }
    out
}

#[test]
fn damaged_backups_are_unpacked_into_the_staging_folder_or_refused_leaving_nothing() {
    let seeds = vec![backup_zip()];
    let root = tempfile::tempdir().unwrap();
    let zip_path = root.path().join("backup.zip");
    let data = root.path().join("data");
    std::fs::create_dir_all(&data).unwrap();
    fuzz("backup", &seeds, |bytes| {
        std::fs::write(&zip_path, bytes).unwrap();
        match stage(&zip_path, &data, |_, _| {}) {
            Ok(_) => {
                // Only the staging folder was written, and only names a backup is made of.
                for file in files_under(&data) {
                    assert!(
                        file.starts_with(STAGING),
                        "{} outside the staging folder",
                        file.display()
                    );
                }
            }
            Err(_) => assert!(
                files_under(&data).is_empty(),
                "a refused backup left files behind"
            ),
        }
        let _ = std::fs::remove_dir_all(data.join(STAGING));
    });
}
