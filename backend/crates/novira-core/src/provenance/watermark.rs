//! TrustMark (variant P, BCH_5) on the CPU through ONNX Runtime, loaded from the pinned DLL at run time.
//!
//! Variant P always works on the centred square of the picture (the shorter side by the shorter side): on a picture
//! that is not square, the strip outside that square carries no watermark. The residual is computed at 256 x 256 and
//! scaled up, so the strength does not depend on the picture's size.
use super::files::{self, Found};
use super::payload::{self, Decoded};
use image::DynamicImage;
use std::path::Path;
use std::sync::Arc;
use trustmark::{Trustmark, Variant, Version};

/// The watermark's strength: TrustMark's own scale, where 0.95 is its "normal". 1.0 is a little stronger.
pub const STRENGTH: f32 = 1.0;
/// The largest picture that is watermarked. TrustMark works on 32-bit floats per channel with several copies of the
/// picture, so a 4096 x 4096 picture already needs about a gigabyte.
pub const MAX_PIXELS: u64 = 4096 * 4096;
/// The C2PA soft-binding algorithm of variant P, from the C2PA soft-binding algorithm list.
pub const SOFT_BINDING_ALG: &str = "com.adobe.trustmark.P";

/// A loaded TrustMark encoder and decoder. `encode` and `decode` may run on several threads at once.
pub struct Watermarker {
    model: Trustmark,
}

impl std::fmt::Debug for Watermarker {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Watermarker")
    }
}

/// The DLL that was handed to ONNX Runtime, once per process (`ort` cannot load a second one).
static RUNTIME: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();

/// Loads the ONNX Runtime DLL first by itself, so a missing Visual C++ runtime becomes an error instead of a panic
/// inside `ort`, then points `ort` at it.
fn init_runtime(dll: &Path) -> Result<(), String> {
    // A runtime already loaded is the same pinned build (every copy is hash-checked), wherever it was found.
    if RUNTIME.get().is_some() {
        return Ok(());
    }
    // SAFETY: the DLL's size and SHA-256 were checked against the pinned values just before; loading it runs its
    // initialisation code, which is Microsoft's ONNX Runtime 1.22.0.
    let lib = unsafe { libloading::Library::new(dll) }.map_err(|e| {
        format!(
            "the watermark runtime (ONNX Runtime) could not be loaded; the Microsoft Visual C++ Redistributable may be missing: {e}"
        )
    })?;
    // Kept loaded for the life of the process; `ort` loads the same module again by path.
    std::mem::forget(lib);
    let _ = RUNTIME.set(dll.to_path_buf());
    ort::init_from(dll.display().to_string())
        .with_name("novira-trustmark")
        .commit()
        .map(|_| ())
        .map_err(|e| format!("the watermark runtime could not start: {e}"))
}

impl Watermarker {
    /// Checks the hashes of the files, loads the runtime and both models. Takes about a second on a CPU.
    pub fn load(found: &Found) -> Result<Arc<Self>, String> {
        files::verify(found)?;
        init_runtime(&found.runtime)?;
        let models = found.models.clone();
        // `ort` panics instead of returning an error when the DLL is unusable; keep that inside this call.
        let loaded = std::panic::catch_unwind(move || {
            Trustmark::new(&models, Variant::P, Version::Bch5).map_err(|e| e.to_string())
        })
        .map_err(|_| "the watermark runtime failed to start".to_string())??;
        Ok(Arc::new(Self { model: loaded }))
    }

    /// The picture with a watermark carrying `id`. The size, the colour type and the alpha channel are kept.
    pub fn embed(&self, picture: DynamicImage, id: u64) -> Result<DynamicImage, String> {
        check_size(&picture)?;
        let color = picture.color();
        let marked = self
            .model
            .encode(payload::bits(id), picture, STRENGTH)
            .map_err(|e| format!("the watermark could not be added: {e}"))?;
        // TrustMark answers in 32-bit floats; bring the picture back to its own type.
        Ok(match color {
            image::ColorType::Rgba8 | image::ColorType::La8 => {
                DynamicImage::ImageRgba8(marked.to_rgba8())
            }
            image::ColorType::Rgba16 | image::ColorType::La16 => {
                DynamicImage::ImageRgba16(marked.to_rgba16())
            }
            image::ColorType::Rgb16 | image::ColorType::L16 => {
                DynamicImage::ImageRgb16(marked.to_rgb16())
            }
            _ if color.has_alpha() => DynamicImage::ImageRgba8(marked.to_rgba8()),
            _ => DynamicImage::ImageRgb8(marked.to_rgb8()),
        })
    }

    /// What watermark the picture carries: `None` when there is none (or it is too damaged to read).
    pub fn read(&self, picture: DynamicImage) -> Result<Option<Decoded>, String> {
        check_size(&picture)?;
        match self.model.decode(picture) {
            Ok(bits) => Ok(Some(payload::parse(&bits))),
            Err(trustmark::Error::CorruptWatermark) => Ok(None),
            Err(e) => Err(format!("the watermark could not be read: {e}")),
        }
    }
}

/// Refuses pictures too large to watermark in memory.
pub fn check_size(picture: &DynamicImage) -> Result<(), String> {
    let pixels = u64::from(picture.width()) * u64::from(picture.height());
    if pixels > MAX_PIXELS {
        return Err(format!(
            "the picture is too large for the watermark ({}x{}); choose a smaller size",
            picture.width(),
            picture.height()
        ));
    }
    if picture.width() < 2 || picture.height() < 2 {
        return Err("the picture is too small for the watermark".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pictures_too_large_or_too_small_are_refused_before_any_work() {
        let big = DynamicImage::new_rgb8(4097, 4096);
        assert!(check_size(&big).unwrap_err().contains("4097x4096"));
        assert!(check_size(&DynamicImage::new_rgb8(4096, 4096)).is_ok());
        assert!(check_size(&DynamicImage::new_rgb8(1, 100)).is_err());
        assert!(check_size(&DynamicImage::new_rgb8(2, 2)).is_ok());
    }

    #[test]
    fn a_runtime_that_does_not_exist_is_an_error_not_a_panic() {
        let dir = tempfile::tempdir().unwrap();
        // No unit test loads the real runtime, so this is the first attempt of the process.
        let err = init_runtime(&dir.path().join("onnxruntime.dll")).unwrap_err();
        assert!(err.contains("Visual C++"), "{err}");
        assert!(RUNTIME.get().is_none(), "a failed load is not remembered");
    }
}
