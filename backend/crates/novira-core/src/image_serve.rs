//! Serving stored pictures by name, for every shell: `/<full|thumb>/<image name>`. URLs carry names only, never paths;
//! anything unknown is a 404. The decision is a pure function so it is tested without a window or a socket.
use crate::Backend;

pub struct Served {
    pub status: u16,
    pub content_type: &'static str,
    pub body: Vec<u8>,
    /// `bytes first-last/total` of a partial answer (status 206), or `bytes */total` of a refused range (416).
    pub content_range: Option<String>,
}

/// The inclusive byte range a `Range: bytes=...` header asks for in a body of `len` bytes: `Some(Ok)` to serve,
/// `Some(Err)` when it cannot be satisfied, `None` when there is no (usable) range header. Only one range is served.
pub fn parse_range(header: &str, len: usize) -> Option<Result<(usize, usize), ()>> {
    let spec = header.trim().strip_prefix("bytes=")?;
    if spec.contains(',') {
        return None;
    }
    let (first, last) = spec.split_once('-')?;
    if len == 0 {
        return Some(Err(()));
    }
    let (start, end) = match (first.trim(), last.trim()) {
        // `-N`: the last N bytes.
        ("", n) => {
            let n: usize = n.parse().ok()?;
            if n == 0 {
                return Some(Err(()));
            }
            (len.saturating_sub(n), len - 1)
        }
        (s, "") => (s.parse().ok()?, len - 1),
        (s, e) => (s.parse().ok()?, e.parse::<usize>().ok()?.min(len - 1)),
    };
    Some(if start > end || start >= len {
        Err(())
    } else {
        Ok((start, end))
    })
}

pub fn serve(backend: &Backend, path: &str, range: Option<&str>) -> Served {
    let not_found = Served {
        status: 404,
        content_type: "text/plain",
        body: Vec::new(),
        content_range: None,
    };
    let parts: Vec<&str> = path.trim_matches('/').split('/').collect();
    let [variant, name] = parts[..] else {
        return not_found;
    };
    let Some((body, content_type)) = backend.read_image(variant, name) else {
        return not_found;
    };
    // Audio and video elements ask for pieces of a file (to play from the middle, or to know the length).
    match range.and_then(|r| parse_range(r, body.len())) {
        Some(Ok((start, end))) => Served {
            status: 206,
            content_type,
            content_range: Some(format!("bytes {start}-{end}/{}", body.len())),
            body: body[start..=end].to_vec(),
        },
        Some(Err(())) => Served {
            status: 416,
            content_type: "text/plain",
            content_range: Some(format!("bytes */{}", body.len())),
            body: Vec::new(),
        },
        None => Served {
            status: 200,
            content_type,
            body,
            content_range: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const BASE: &str = "http://novira-image.localhost";
    use crate::engine::{Engine, EngineError, EngineJob, ProgressFn};
    use crate::{BackendConfig, Settings};
    use std::sync::Arc;

    struct NoEngine;
    #[async_trait::async_trait]
    impl Engine for NoEngine {
        async fn generate(
            &self,
            _: &EngineJob,
            _: ProgressFn<'_>,
            _: &tokio_util::sync::CancellationToken,
        ) -> Result<crate::engine::EngineOutput, EngineError> {
            Err(EngineError::Failed("none".into()))
        }
    }

    #[tokio::test]
    async fn serves_stored_images_and_refuses_everything_else() {
        let dir = tempfile::tempdir().unwrap();
        let backend = Backend::open_with_engine(
            BackendConfig {
                data_dir: dir.path().into(),
                image_url_base: BASE.into(),
                settings: Settings {
                    gpu_lock: String::new(),
                    ..Settings::default()
                },
            },
            Arc::new(NoEngine),
        )
        .unwrap();
        let mut png = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(4, 4)
            .write_to(&mut png, image::ImageFormat::Png)
            .unwrap();
        let img = backend
            .upload_image(png.into_inner(), Default::default())
            .await
            .unwrap();
        assert!(img.url.starts_with(BASE));

        let full = serve(&backend, &format!("/full/{}", img.name), None);
        assert_eq!((full.status, full.content_type), (200, "image/png"));
        assert_eq!(
            serve(&backend, &format!("/thumb/{}", img.name), None).status,
            200
        );
        for bad in [
            "/full/../novira.sqlite",
            "/full",
            "/other/x.png",
            &format!("/full/{}/x", img.name),
            "/full/..%2Fx.png",
        ] {
            assert_eq!(serve(&backend, bad, None).status, 404, "{bad}");
        }

        // A range request gets just that piece, with the information a media element needs.
        let whole = serve(&backend, &format!("/full/{}", img.name), None).body;
        let piece = serve(&backend, &format!("/full/{}", img.name), Some("bytes=2-5"));
        assert_eq!(piece.status, 206);
        assert_eq!(piece.body, whole[2..=5]);
        assert_eq!(
            piece.content_range,
            Some(format!("bytes 2-5/{}", whole.len()))
        );
        let beyond = serve(
            &backend,
            &format!("/full/{}", img.name),
            Some("bytes=999999-"),
        );
        assert_eq!(beyond.status, 416);
    }

    #[test]
    fn ranges_are_read_strictly() {
        assert_eq!(parse_range("bytes=0-9", 100), Some(Ok((0, 9))));
        assert_eq!(parse_range("bytes=90-", 100), Some(Ok((90, 99))));
        assert_eq!(parse_range("bytes=-10", 100), Some(Ok((90, 99))));
        assert_eq!(parse_range("bytes=50-5000", 100), Some(Ok((50, 99))));
        assert_eq!(parse_range("bytes=100-", 100), Some(Err(())));
        assert_eq!(parse_range("bytes=9-3", 100), Some(Err(())));
        assert_eq!(parse_range("bytes=-0", 100), Some(Err(())));
        assert_eq!(parse_range("bytes=0-1", 0), Some(Err(())));
        // Not a single byte range: the whole file is served.
        assert_eq!(parse_range("bytes=0-1,5-6", 100), None);
        assert_eq!(parse_range("items=0-1", 100), None);
        assert_eq!(parse_range("bytes=a-b", 100), None);
    }
}
