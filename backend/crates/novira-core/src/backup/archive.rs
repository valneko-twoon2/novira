//! Writing a backup zip. Files are streamed from disk into the archive one at a time, never held in memory whole.
use super::{
    BackupInfo, Manifest, DATABASE, FORMAT, MANIFEST, OUTPUTS, THUMBNAILS, UI_STATE, VERSION,
};
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Everything one backup is made of.
pub struct Contents<'a> {
    pub info: BackupInfo,
    /// The consistent copy of the database (made with `VACUUM INTO`).
    pub database: &'a Path,
    /// The frontend's saved state (already checked).
    pub ui_state: &'a str,
    /// Gallery files to include: (entry name inside `outputs/`, file on disk). Thumbnails likewise.
    pub originals: Vec<(String, PathBuf)>,
    pub thumbnails: Vec<(String, PathBuf)>,
}

impl Contents<'_> {
    /// How many entries the archive gets (for progress).
    pub fn total(&self) -> u32 {
        (3 + self.originals.len() + self.thumbnails.len()) as u32
    }
}

fn options(method: CompressionMethod, size: u64) -> SimpleFileOptions {
    SimpleFileOptions::default()
        .compression_method(method)
        .large_file(size >= u64::from(u32::MAX))
}

fn add_file(
    zip: &mut ZipWriter<BufWriter<File>>,
    name: &str,
    path: &Path,
    method: CompressionMethod,
) -> std::io::Result<()> {
    let mut file = File::open(path)?;
    let size = file.metadata()?.len();
    zip.start_file(name, options(method, size))
        .map_err(std::io::Error::other)?;
    std::io::copy(&mut file, zip)?;
    Ok(())
}

/// Writes the zip to `target` through a temporary file beside it, renamed into place once complete. `progress` gets
/// (entries done, entries in all). Gallery files that disappeared meanwhile are left out.
pub fn write(
    target: &Path,
    contents: &Contents<'_>,
    mut progress: impl FnMut(u32, u32),
) -> std::io::Result<u64> {
    let partial = target.with_extension("zip.partial");
    let result = (|| {
        let mut zip = ZipWriter::new(BufWriter::new(File::create(&partial)?));
        let total = contents.total();
        let manifest = Manifest {
            format: FORMAT.into(),
            version: VERSION,
            info: contents.info.clone(),
        };
        let manifest = serde_json::to_vec_pretty(&manifest).map_err(std::io::Error::other)?;
        zip.start_file(MANIFEST, options(CompressionMethod::Deflated, 0))
            .map_err(std::io::Error::other)?;
        zip.write_all(&manifest)?;
        zip.start_file(
            UI_STATE,
            options(CompressionMethod::Deflated, contents.ui_state.len() as u64),
        )
        .map_err(std::io::Error::other)?;
        zip.write_all(contents.ui_state.as_bytes())?;
        add_file(
            &mut zip,
            DATABASE,
            contents.database,
            CompressionMethod::Deflated,
        )?;
        let mut done = 3;
        progress(done, total);
        // Pictures, videos and audio are compressed already: stored as they are.
        for (folder, files) in [
            (OUTPUTS, &contents.originals),
            (THUMBNAILS, &contents.thumbnails),
        ] {
            for (name, path) in files {
                match add_file(
                    &mut zip,
                    &format!("{folder}/{name}"),
                    path,
                    CompressionMethod::Stored,
                ) {
                    Ok(()) => {}
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                        crate::applog::warn("backup", format!("{name} was gone, left out"));
                    }
                    Err(e) => return Err(e),
                }
                done += 1;
                progress(done, total);
            }
        }
        let mut out = zip.finish().map_err(std::io::Error::other)?;
        out.flush()?;
        out.into_inner().map_err(|e| e.into_error())?.sync_all()?;
        std::fs::rename(&partial, target)?;
        Ok(std::fs::metadata(target)?.len())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&partial);
    }
    result
}
