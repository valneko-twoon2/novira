//! Export requests with options that are out of range are refused before anything is written.
use super::common::*;
use novira_core::media::export::{ExportFormat, ExportOptions};
use std::sync::Arc;

#[tokio::test]
async fn export_options_out_of_range_are_refused_with_the_reason() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let names = vec!["a.png".to_string()];
    for (quality, max_side) in [(0, None), (101, None), (90, Some(4)), (90, Some(100_000))] {
        let options = ExportOptions {
            format: ExportFormat::Jpeg,
            quality,
            max_side,
            remove_info: true,
            watermark: false,
        };
        assert!(backend.check_export(&names, &options).is_err());
        let err = backend
            .export_images(names.clone(), options, out.path().to_path_buf())
            .await
            .unwrap_err();
        assert!(err.to_string().contains("must be between"), "{err}");
    }
    assert_eq!(std::fs::read_dir(out.path()).unwrap().count(), 0);
    backend.shutdown();
}
