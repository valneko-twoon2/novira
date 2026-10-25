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

    pub fn delete_images(&self, names: &[String]) -> Result<()> {
        let picked = Picked::new(names);
        self.state().images.retain(|i| !picked.contains(&i.name));
        self.db().delete(
            Table::Images,
            &names.iter().map(String::as_str).collect::<Vec<_>>(),
        )?;
        for n in names {
            self.inner.files.delete(n);
        }
        Ok(())
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
    use super::Picked;

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
