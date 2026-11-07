//! Serving stored pictures by name, for every shell: `/<full|thumb>/<image name>`. URLs carry names only, never paths;
//! anything unknown is a 404. The decision is a pure function so it is tested without a window or a socket.
use crate::media::images;
use crate::Backend;
use std::io::{Read, Seek, SeekFrom};

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
    let Some(file) = backend.open_image(variant, name) else {
        return not_found;
    };
    // The length and the bytes come from the same open file, so a picture replaced meanwhile cannot mix two files.
    let Ok(len) = file.metadata().map(|m| m.len()) else {
        return not_found;
    };
    answer(file, len, range).unwrap_or(not_found)
}

/// Bytes enough to tell the type (`images::sniff_content_type` looks at 12 at most).
const SNIFF_BYTES: usize = 16;

/// The answer to a request for a file of `len` bytes, reading from it only what the answer carries and the first
/// `SNIFF_BYTES`: a range of a 200 MB video read the whole file before (about 0.1 s and 200 MB of memory a request).
fn answer<R: Read + Seek>(mut file: R, len: u64, range: Option<&str>) -> std::io::Result<Served> {
    let len = usize::try_from(len).map_err(std::io::Error::other)?;
    let mut head = Vec::with_capacity(SNIFF_BYTES);
    (&mut file)
        .take(SNIFF_BYTES as u64)
        .read_to_end(&mut head)?;
    let content_type = images::sniff_content_type(&head);
    // Audio and video elements ask for pieces of a file (to play from the middle, or to know the length).
    Ok(match range.and_then(|r| parse_range(r, len)) {
        Some(Ok((start, end))) => {
            let want = end - start + 1;
            file.seek(SeekFrom::Start(start as u64))?;
            let mut body = Vec::with_capacity(want);
            file.take(want as u64).read_to_end(&mut body)?;
            if body.len() != want {
                return Err(std::io::ErrorKind::UnexpectedEof.into());
            }
            Served {
                status: 206,
                content_type,
                content_range: Some(format!("bytes {start}-{end}/{len}")),
                body,
            }
        }
        Some(Err(())) => Served {
            status: 416,
            content_type: "text/plain",
            content_range: Some(format!("bytes */{len}")),
            body: Vec::new(),
        },
        None => {
            // The head is already read; the rest follows it.
            let mut body = head;
            body.reserve(len.saturating_sub(body.len()));
            file.read_to_end(&mut body)?;
            Served {
                status: 200,
                content_type,
                body,
                content_range: None,
            }
        }
    })
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

        // A video in the gallery's folder: a piece from its end, read from the file itself.
        let name = "0123456789abcdef0123456789abcdef.mp4";
        let body = video(1 << 20);
        std::fs::write(dir.path().join("outputs").join(name), &body).unwrap();
        let tail = serve(&backend, &format!("/full/{name}"), Some("bytes=-1000"));
        assert_eq!((tail.status, tail.content_type), (206, "video/mp4"));
        assert_eq!(tail.body, body[body.len() - 1000..]);
        assert_eq!(
            tail.content_range,
            Some(format!(
                "bytes {}-{}/{}",
                body.len() - 1000,
                body.len() - 1,
                body.len()
            ))
        );
        assert_eq!(serve(&backend, &format!("/full/{name}"), None).body, body);
        // A folder with a picture's name is no picture.
        std::fs::create_dir(
            dir.path()
                .join("outputs")
                .join("fedcba9876543210fedcba9876543210.png"),
        )
        .unwrap();
        assert_eq!(
            serve(&backend, "/full/fedcba9876543210fedcba9876543210.png", None).status,
            404
        );
    }

    /// Counts the bytes read through it.
    struct Counting {
        inner: std::io::Cursor<Vec<u8>>,
        read: usize,
    }

    impl Read for Counting {
        fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
            let n = self.inner.read(buf)?;
            self.read += n;
            Ok(n)
        }
    }

    impl Seek for Counting {
        fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
            self.inner.seek(pos)
        }
    }

    fn video(len: usize) -> Vec<u8> {
        let mut body: Vec<u8> = (0..len).map(|i| (i % 251) as u8).collect();
        body[..12].copy_from_slice(b"\0\0\0\x18ftypisom");
        body
    }

    #[test]
    fn a_range_reads_only_its_own_bytes_and_the_head_of_the_file() {
        let body = video(4 << 20);
        let len = body.len() as u64;
        for (range, piece) in [
            ("bytes=3000000-3000099", 3_000_000..=3_000_099),
            // The end of the file, which a player asks for when the index of a video is there.
            ("bytes=-100", body.len() - 100..=body.len() - 1),
            ("bytes=0-1", 0..=1),
        ] {
            let mut file = Counting {
                inner: std::io::Cursor::new(body.clone()),
                read: 0,
            };
            let served = answer(&mut file, len, Some(range)).unwrap();
            assert_eq!((served.status, served.content_type), (206, "video/mp4"));
            assert_eq!(served.body, body[piece.clone()], "{range}");
            assert_eq!(
                served.content_range,
                Some(format!("bytes {}-{}/{len}", piece.start(), piece.end()))
            );
            assert!(
                file.read <= served.body.len() + SNIFF_BYTES,
                "{range} read {} bytes for a piece of {}",
                file.read,
                served.body.len()
            );
        }
        // A whole answer reads the file once; a refused range only its head.
        let mut file = Counting {
            inner: std::io::Cursor::new(body.clone()),
            read: 0,
        };
        let whole = answer(&mut file, len, None).unwrap();
        assert_eq!((whole.status, whole.body == body), (200, true));
        assert_eq!(file.read, body.len());
        let mut file = Counting {
            inner: std::io::Cursor::new(body.clone()),
            read: 0,
        };
        let refused = answer(&mut file, len, Some("bytes=99999999-")).unwrap();
        assert_eq!(refused.status, 416);
        assert!(file.read <= SNIFF_BYTES, "{}", file.read);
        // A file shorter than the head is still typed and served whole.
        let mut tiny = Counting {
            inner: std::io::Cursor::new(b"\x89PNG".to_vec()),
            read: 0,
        };
        let short = answer(&mut tiny, 4, None).unwrap();
        assert_eq!(
            (short.status, short.body.as_slice()),
            (200, &b"\x89PNG"[..])
        );
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
