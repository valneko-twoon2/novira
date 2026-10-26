//! Images: upload, edit, delete and serve.
use super::*;

impl Backend {
    /// Stores an uploaded or rendered image. Settings embedded by novira come back as metadata.
    pub async fn upload_image(&self, bytes: Vec<u8>, opts: ImageOptions) -> Result<ImageDTO> {
        let this = self.clone();
        let image = tokio::task::spawn_blocking(move || -> Result<ImageDTO> {
            let png = images::to_png(&bytes).map_err(|e| BackendError::Invalid(e.to_string()))?;
            let metadata = images::read_text(&png, images::METADATA_KEY)
                .and_then(|t| serde_json::from_str(&t).ok());
            let workflow = images::read_text(&png, images::WORKFLOW_KEY)
                .and_then(|t| serde_json::from_str(&t).ok());
            let name = images::new_name();
            let (width, height) = this
                .inner
                .files
                .store(&name, &png)
                .map_err(|e| BackendError::Invalid(e.to_string()))?;
            Ok(this.image_dto(ImageDTO {
                name,
                media_type: MediaType::Image,
                url: String::new(),
                thumbnail_url: String::new(),
                width,
                height,
                created_at: now(),
                board_id: opts.board_id,
                starred: false,
                is_intermediate: opts.is_intermediate.unwrap_or(false),
                category: opts.category.unwrap_or(ImageCategory::General),
                metadata,
                workflow,
            }))
        })
        .await
        .map_err(internal)??;
        self.insert_image(&image)?;
        self.emit(BackendEvent::ImageAdded {
            image: image.clone(),
            item: None,
        });
        Ok(image)
    }

    pub(super) fn insert_image(&self, image: &ImageDTO) -> Result<()> {
        self.db()
            .put(Table::Images, &image.name, image.created_at, image)?;
        self.state().images.insert(0, image.clone());
        Ok(())
    }

    pub fn update_images(&self, names: &[String], patch: ImagePatch) -> Result<Vec<ImageDTO>> {
        let picked = Picked::new(names);
        let mut s = self.state();
        let mut out = Vec::new();
        for img in s.images.iter_mut().filter(|i| picked.contains(&i.name)) {
            if let Some(b) = &patch.board_id {
                img.board_id = b.clone();
            }
            if let Some(v) = patch.starred {
                img.starred = v;
            }
            if let Some(v) = patch.is_intermediate {
                img.is_intermediate = v;
            }
            out.push(img.clone());
        }
        drop(s);
        self.db().put_many(
            Table::Images,
            out.iter().map(|i| (i.name.as_str(), i.created_at, i)),
        )?;
        Ok(out)
    }

    /// Takes pictures out of the gallery into the trash, where they wait to be brought back with `restore_images`.
    /// A name the gallery does not know has its files deleted for good (a stray file).
    pub fn delete_images(&self, names: &[String]) -> Result<()> {
        let picked = Picked::new(names);
        let trashed: Vec<ImageDTO> = {
            let mut s = self.state();
            let gone = s
                .images
                .iter()
                .filter(|i| picked.contains(&i.name))
                .cloned()
                .collect();
            s.images.retain(|i| !picked.contains(&i.name));
            gone
        };
        self.move_to_trash(&trashed)?;
        let strays: Vec<&String> = names
            .iter()
            .filter(|n| !trashed.iter().any(|i| &i.name == *n))
            .collect();
        self.db().delete(
            Table::Images,
            &strays.iter().map(|n| n.as_str()).collect::<Vec<_>>(),
        )?;
        for n in strays {
            self.inner.files.delete(n);
        }
        Ok(())
    }

    /// Writes the pictures into the trash table, moves their files there and drops what has waited too long.
    pub(super) fn move_to_trash(&self, images: &[ImageDTO]) -> Result<()> {
        if images.is_empty() {
            return Ok(());
        }
        let at = now();
        let rows: Vec<TrashedImage> = images
            .iter()
            .map(|i| TrashedImage {
                image: i.clone(),
                trashed_at: at,
            })
            .collect();
        {
            let mut db = self.db();
            db.put_many(
                Table::Trash,
                rows.iter().map(|r| (r.image.name.as_str(), at, r)),
            )?;
            db.delete(
                Table::Images,
                &images.iter().map(|i| i.name.as_str()).collect::<Vec<_>>(),
            )?;
        }
        for i in images {
            self.inner.files.trash(&i.name);
        }
        self.purge_trash();
        Ok(())
    }

    /// Brings trashed pictures back into the gallery; the ones that were already purged are left out of the answer.
    pub fn restore_images(&self, names: &[String]) -> Result<Vec<ImageDTO>> {
        let picked = Picked::new(names);
        let rows: Vec<TrashedImage> = self.db().load(Table::Trash)?;
        let mut back = Vec::new();
        let mut gone = Vec::new();
        for row in rows.into_iter().filter(|r| picked.contains(&r.image.name)) {
            gone.push(row.image.name.clone());
            if !self.inner.files.restore(&row.image.name) {
                continue;
            }
            let mut image = self.image_dto(row.image);
            // Its board may have been deleted since.
            if let Some(b) = &image.board_id {
                if !self.state().boards.iter().any(|x| &x.id == b) {
                    image.board_id = None;
                }
            }
            back.push(image);
        }
        {
            let mut db = self.db();
            db.put_many(
                Table::Images,
                back.iter().map(|i| (i.name.as_str(), i.created_at, i)),
            )?;
            db.delete(
                Table::Trash,
                &gone.iter().map(String::as_str).collect::<Vec<_>>(),
            )?;
        }
        let mut s = self.state();
        s.images.retain(|i| !back.iter().any(|b| b.name == i.name));
        s.images.extend(back.iter().cloned());
        s.images.sort_by_key(|i| std::cmp::Reverse(i.created_at));
        Ok(back)
    }

    /// Deletes for good what has been in the trash longer than `TRASH_KEEP_MS`, and the oldest beyond `TRASH_KEEP_COUNT`.
    pub(super) fn purge_trash(&self) {
        let Ok(rows) = self.db().load::<TrashedImage>(Table::Trash) else {
            return;
        };
        let times: Vec<(String, i64)> = rows
            .iter()
            .map(|r| (r.image.name.clone(), r.trashed_at))
            .collect();
        let stale = stale_in_trash(times, now(), TRASH_KEEP_MS, TRASH_KEEP_COUNT);
        if stale.is_empty() {
            return;
        }
        for name in &stale {
            self.inner.files.purge(name);
        }
        let _ = self.db().delete(
            Table::Trash,
            &stale.iter().map(String::as_str).collect::<Vec<_>>(),
        );
    }

    /// Bytes and content type for the image URL scheme (`full` or `thumb`).
    pub fn read_image(&self, variant: &str, name: &str) -> Option<(Vec<u8>, &'static str)> {
        let bytes = match variant {
            "full" => self.inner.files.read_original(name)?,
            "thumb" => self.inner.files.read_thumbnail(name)?,
            _ => return None,
        };
        let ct = images::sniff_content_type(&bytes);
        Some((bytes, ct))
    }

    /// The stored image an URL from this backend points at.
    pub(super) fn image_name_from_url(&self, url: &str) -> Option<String> {
        let rest = url.strip_prefix(&self.inner.image_url_base)?;
        let name = rest.rsplit('/').next()?;
        images::is_valid_name(name).then(|| name.to_string())
    }
}

/// How long a deleted picture can be taken back, and how many wait at most.
const TRASH_KEEP_MS: i64 = 14 * 24 * 60 * 60 * 1000;
const TRASH_KEEP_COUNT: usize = 500;

/// The names to drop from the trash: the ones trashed before `now - keep_ms`, and, of the rest, every one past the newest
/// `keep_count`.
fn stale_in_trash(
    mut rows: Vec<(String, i64)>,
    now: i64,
    keep_ms: i64,
    keep_count: usize,
) -> Vec<String> {
    rows.sort_by_key(|(_, at)| std::cmp::Reverse(*at));
    rows.into_iter()
        .enumerate()
        .filter(|(i, (_, at))| *i >= keep_count || *at < now - keep_ms)
        .map(|(_, (name, _))| name)
        .collect()
}

/// A picture in the trash: its gallery record and when it was deleted (milliseconds).
#[derive(serde::Serialize, serde::Deserialize)]
struct TrashedImage {
    image: ImageDTO,
    trashed_at: i64,
}

/// The names of picked pictures, asked once per picture of the gallery. A long list is a set: among 2400 pictures, 100
/// names took 0.5 ms as a list and all of them 6 ms, against 0.03 and 0.09 ms as a set. A short one stays a list:
/// hashing every name of the gallery costs more than comparing it with a few (one name: 0.007 ms, as a set 0.03 ms).
pub(super) enum Picked<'a> {
    Few(&'a [String]),
    Many(HashSet<&'a str>),
}

impl<'a> Picked<'a> {
    const SET_FROM: usize = 8;

    pub(super) fn new(names: &'a [String]) -> Self {
        if names.len() < Self::SET_FROM {
            Picked::Few(names)
        } else {
            Picked::Many(names.iter().map(String::as_str).collect())
        }
    }

    pub(super) fn contains(&self, name: &str) -> bool {
        match self {
            Picked::Few(names) => names.iter().any(|n| n == name),
            Picked::Many(set) => set.contains(name),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{stale_in_trash, Picked};

    #[test]
    fn the_trash_drops_what_is_old_and_what_is_beyond_the_newest_few() {
        let row = |n: &str, at: i64| (n.to_string(), at);
        let rows = vec![row("old", 100), row("a", 900), row("b", 950), row("c", 990)];
        // Nothing is too old and all fit: nothing goes.
        assert!(stale_in_trash(rows.clone(), 1000, 10_000, 4).is_empty());
        // Older than the keep time goes, whatever the count (a row at exactly the limit stays).
        assert_eq!(stale_in_trash(rows.clone(), 1000, 800, 4), ["old"]);
        assert!(stale_in_trash(rows.clone(), 1000, 900, 4).is_empty());
        assert!(stale_in_trash(rows.clone(), 1000, 900, 4)
            .iter()
            .all(|n| n != "a"));
        // Beyond the newest two goes: the oldest ones, in the order of age.
        assert_eq!(stale_in_trash(rows.clone(), 1000, 10_000, 2), ["a", "old"]);
        assert_eq!(stale_in_trash(rows, 1000, 10_000, 0).len(), 4);
        assert!(stale_in_trash(Vec::new(), 1000, 10, 5).is_empty());
    }

    #[test]
    fn a_short_and_a_long_pick_answer_alike() {
        for count in [0, 1, Picked::SET_FROM - 1, Picked::SET_FROM, 40] {
            let names: Vec<String> = (0..count).map(|i| format!("{i}.png")).collect();
            let picked = Picked::new(&names);
            assert_eq!(
                matches!(picked, Picked::Many(_)),
                count >= Picked::SET_FROM,
                "{count}"
            );
            for i in 0..count {
                assert!(picked.contains(&format!("{i}.png")), "{count} {i}");
            }
            assert!(!picked.contains(&format!("{count}.png")));
            assert!(!picked.contains(""));
        }
    }
}
