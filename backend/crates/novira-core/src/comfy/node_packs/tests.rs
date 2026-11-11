use super::*;

// tags: equivalence, error-guessing
#[test]
fn repo_info_reads_the_author_and_licence_and_survives_missing_fields() {
    let repo = parse_github("https://github.com/someone/Fancy").unwrap();
    let full = br#"{"owner":{"login":"RealOwner"},"license":{"spdx_id":"GPL-3.0"},"description":"Does things","stargazers_count":7}"#;
    let info = parse_repo_info(full, &repo);
    assert_eq!(info.author, "RealOwner");
    assert_eq!(info.license.as_deref(), Some("GPL-3.0"));
    assert_eq!(info.stars, 7);
    // GitHub says NOASSERTION for a licence file it cannot name, and null for no licence at all.
    let unknown = parse_repo_info(br#"{"license":{"spdx_id":"NOASSERTION"}}"#, &repo);
    assert_eq!(unknown.license, None);
    assert_eq!(unknown.author, "someone");
    assert_eq!(parse_repo_info(br#"{"license":null}"#, &repo).license, None);
    assert_eq!(parse_repo_info(b"not json", &repo).author, "someone");
}

// tags: equivalence, error-guessing
#[test]
fn tags_are_put_into_an_address_only_when_plain() {
    for ok in ["v1.2.3", "1.0", "release-2024_01", "v1.0+build.5"] {
        assert!(valid_tag(ok), "{ok}");
    }
    for bad in [
        "", "-x", ".x", "a..b", "a/b", "a b", "a?b", "a%2e", "v1\\2", "x#y",
    ] {
        assert!(!valid_tag(bad), "{bad}");
    }
    let repo = parse_github("https://github.com/o/r").unwrap();
    assert_eq!(
        repo.archive_url_for(Some("v1.2")),
        "https://codeload.github.com/o/r/zip/refs/tags/v1.2"
    );
}

// tags: equivalence, error-guessing
#[test]
fn a_tags_answer_gives_the_valid_names_in_order() {
    let body = br#"[{"name":"v2.0"},{"name":"../evil"},{"name":"v1.9"},{"other":1}]"#;
    assert_eq!(parse_tags(body), vec!["v2.0", "v1.9"]);
    assert!(parse_tags(b"not json").is_empty());
}

// tags: condition
#[test]
fn the_comfyui_version_is_read_from_its_version_file() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(comfyui_version(dir.path()), None);
    std::fs::write(
        dir.path().join("comfyui_version.py"),
        "# comment\n__version__ = \"0.3.50\"\n",
    )
    .unwrap();
    assert_eq!(comfyui_version(dir.path()).as_deref(), Some("0.3.50"));
}

// tags: state-transition
#[test]
fn the_installed_version_is_remembered_in_the_marker() {
    let dir = tempfile::tempdir().unwrap();
    let pack = dir.path().join("p");
    std::fs::create_dir_all(&pack).unwrap();
    std::fs::write(
        pack.join(MARKER),
        br#"{"url":"https://github.com/o/p","version":"v3"}"#,
    )
    .unwrap();
    let other = dir.path().join("q");
    std::fs::create_dir_all(&other).unwrap();
    std::fs::write(other.join(MARKER), br#"{"url":"https://github.com/o/q"}"#).unwrap();
    let listed = list(dir.path());
    assert_eq!(listed[0].version.as_deref(), Some("v3"));
    assert_eq!(listed[1].version, None);
}

// tags: equivalence, error-guessing
#[test]
fn only_plain_github_repositories_are_accepted() {
    let r = parse_github("https://github.com/Nekodificador/ComfyUI-NKD-Basic-Tools.git/").unwrap();
    assert_eq!(r.owner, "Nekodificador");
    assert_eq!(r.repo, "ComfyUI-NKD-Basic-Tools");
    assert_eq!(
        r.url(),
        "https://github.com/Nekodificador/ComfyUI-NKD-Basic-Tools"
    );
    assert_eq!(
        r.archive_url(),
        "https://codeload.github.com/Nekodificador/ComfyUI-NKD-Basic-Tools/zip/HEAD"
    );
    for bad in [
        "http://github.com/a/b",
        "https://gitlab.com/a/b",
        "https://github.com/a",
        "https://github.com/a/b/tree/main",
        "https://github.com/../b",
        "https://github.com/a/b c",
        "file:///C:/x",
    ] {
        assert!(parse_github(bad).is_err(), "{bad}");
    }
}

// tags: condition, error-guessing
#[test]
fn listing_skips_caches_and_disabled_packs_and_reads_where_a_pack_came_from() {
    let dir = tempfile::tempdir().unwrap();
    for f in [
        "b-pack",
        "A-pack",
        "__pycache__",
        ".novira-tmp",
        "old.disabled",
    ] {
        std::fs::create_dir_all(dir.path().join(f)).unwrap();
    }
    std::fs::write(dir.path().join("example_node.py"), b"").unwrap();
    std::fs::write(
        dir.path().join("b-pack").join(MARKER),
        br#"{"url":"https://github.com/x/b-pack"}"#,
    )
    .unwrap();
    assert_eq!(
        list(dir.path()),
        vec![
            InstalledNodePack {
                folder: "A-pack".into(),
                url: None,
                version: None
            },
            InstalledNodePack {
                folder: "b-pack".into(),
                url: Some("https://github.com/x/b-pack".into()),
                version: None
            },
        ]
    );
    assert!(remove(dir.path(), "..").is_err());
    assert!(remove(dir.path(), "a/../b-pack").is_err());
    assert!(remove(dir.path(), "missing").is_err());
    remove(dir.path(), "b-pack").unwrap();
    assert!(!dir.path().join("b-pack").exists());
}

// tags: equivalence, error-guessing
#[test]
fn only_listed_pack_routes_are_callable() {
    assert!(route_allowed("nkd/facerig/preview"));
    assert!(route_allowed("nkd/facerig/library"));
    for bad in [
        "prompt",
        "nkd/other",
        "nkd/facerig/../../prompt",
        "nkd/facerig//x",
        "nkd/facerig/x?y=1",
        "/nkd/facerig/preview",
        "system_stats",
    ] {
        assert!(!route_allowed(bad), "{bad}");
    }
}

// tags: equivalence
#[test]
fn submodules_are_read_from_gitmodules() {
    let text = "[submodule \"repositories/x\"]\n\tpath = repositories/x\n\turl = https://github.com/a/x\n[submodule \"y\"]\n\turl = https://github.com/a/y.git\n\tpath = y\n";
    assert_eq!(
        parse_gitmodules(text),
        vec![
            (
                "repositories/x".to_string(),
                "https://github.com/a/x".to_string()
            ),
            ("y".to_string(), "https://github.com/a/y.git".to_string()),
        ]
    );
}

// tags: condition
#[test]
fn packs_that_miss_a_library_get_it_added() {
    let nkd = parse_github("https://github.com/Nekodificador/ComfyUI-NKD-Basic-Tools").unwrap();
    assert_eq!(extra_requirements(&nkd), &["opencv-python-headless"]);
    let other = parse_github("https://github.com/a/b").unwrap();
    assert!(extra_requirements(&other).is_empty());
}

// tags: condition, equivalence
#[test]
fn the_pose_pack_leaves_out_mediapipe_and_albumentationsx_and_other_packs_leave_out_nothing() {
    let aux = parse_github("https://github.com/Fannovel16/comfyui_controlnet_aux").unwrap();
    assert_eq!(
        skipped_requirements(&aux),
        &["mediapipe", "albumentationsx"]
    );
    // GitHub addresses do not care about case.
    let typed = parse_github("https://github.com/fannovel16/ComfyUI_ControlNet_Aux").unwrap();
    assert_eq!(
        skipped_requirements(&typed),
        &["mediapipe", "albumentationsx"]
    );
    let other = parse_github("https://github.com/a/b").unwrap();
    assert!(skipped_requirements(&other).is_empty());
}

// tags: equivalence
#[test]
fn skipped_libraries_are_dropped_by_name_and_everything_else_stays() {
    let text = "torch\nmediapipe>=0.8.0\n# mediapipe is for faces\nMediaPipe[extra] ; python_version > '3'\n-r more.txt\nmediapipe_tools\nnumpy==1.26\n\nopencv-python\n";
    assert_eq!(
            without_requirements(text, &["mediapipe"]),
            "torch\n# mediapipe is for faces\n-r more.txt\nmediapipe_tools\nnumpy==1.26\n\nopencv-python\n"
        );
    // Names are compared the way pip does: case, `-`, `_` and `.` do not matter.
    assert_eq!(
        without_requirements(
            "Opencv_Contrib.python==4.9\nscipy\n",
            &["opencv-contrib-python"]
        ),
        "scipy\n"
    );
    assert_eq!(without_requirements("a\r\nb\r\n", &[]), "a\nb\n");
}

// tags: error-guessing
#[test]
fn requirements_cannot_replace_comfyuis_pytorch() {
    let freeze = "numpy==1.26.4\ntorch==2.7.0+cu128\ntorchvision==0.22.0+cu128\nTorchaudio==2.7.0\nxformers @ file:///x.whl\npillow==11.0\n";
    assert_eq!(
        constraints(freeze),
        "torch==2.7.0+cu128\ntorchvision==0.22.0+cu128\nTorchaudio==2.7.0\n"
    );
}

// tags: equivalence
#[test]
fn portable_builds_pin_their_wheels_by_the_version_in_the_file_name() {
    // The lines as the portable build's `pip freeze` writes them (the hash after `#` is not needed).
    let freeze = "albucore==0.0.24\n\
            torch @ file:///D:/a/ComfyUI/cu130_python_deps/torch-2.14.0%2Bcu130-cp313-cp313-win_amd64.whl#sha256=a980c9\n\
            torchvision @ file:///D:/a/ComfyUI/cu130_python_deps/torchvision-0.29.0%2Bcu130-cp313-cp313-win_amd64.whl#sha256=6bb8\n\
            torchsde @ file:///D:/a/ComfyUI/cu130_python_deps/torchsde-0.2.6-py3-none-any.whl#sha256=19bf\n\
            torchaudio @ file:///D:/x/other_pkg-2.11.0-py3-none-any.whl\n";
    assert_eq!(
        constraints(freeze),
        "torch==2.14.0+cu130\ntorchvision==0.29.0+cu130\n"
    );
    // A plain (not local) version pins too, with the name as the freeze wrote it; a URL without a version does not.
    assert_eq!(
            constraints("Torchaudio @ https://h/Torchaudio-2.11.0-py3-none-any.whl\nxformers @ https://h/x.whl\n"),
            "Torchaudio==2.11.0\n"
        );
}

// tags: boundary
#[test]
fn a_version_file_with_an_empty_or_overlong_value_gives_no_version() {
    let dir = tempfile::tempdir().unwrap();
    let write = |text: &str| std::fs::write(dir.path().join("comfyui_version.py"), text).unwrap();
    write("__version__ = \"\"\n");
    assert_eq!(comfyui_version(dir.path()), None);
    write(&format!("__version__ = \"{}\"\n", "9".repeat(40)));
    assert_eq!(
        comfyui_version(dir.path()).as_deref(),
        Some("9".repeat(40).as_str())
    );
    write(&format!("__version__ = \"{}\"\n", "9".repeat(41)));
    assert_eq!(comfyui_version(dir.path()), None);
}

// tags: decision-table
#[test]
fn only_the_named_repository_of_the_named_owner_has_libraries_left_out_or_added() {
    let repo = |o: &str, r: &str| GithubRepo {
        owner: o.into(),
        repo: r.into(),
    };
    // Owner and repository must both match, whatever the case.
    assert!(!skipped_requirements(&repo("Fannovel16", "comfyui_controlnet_aux")).is_empty());
    assert!(!skipped_requirements(&repo("fannovel16", "ComfyUI_ControlNet_Aux")).is_empty());
    assert!(skipped_requirements(&repo("Fannovel16", "other")).is_empty());
    assert!(skipped_requirements(&repo("someone", "comfyui_controlnet_aux")).is_empty());
    // The RMBG pack gets its Windows-only triton package, and only there.
    let rmbg = extra_requirements(&repo("1038lab", "ComfyUI-RMBG"));
    if cfg!(windows) {
        assert_eq!(rmbg, &["triton-windows"]);
    } else {
        assert!(rmbg.is_empty());
    }
    assert!(extra_requirements(&repo("1038lab", "other")).is_empty());
}

// tags: boundary, equivalence
#[test]
fn a_frozen_line_pins_only_with_both_a_name_and_a_version() {
    assert_eq!(
        pin("numpy==1.26.4"),
        Some(("numpy".into(), "1.26.4".into()))
    );
    assert_eq!(pin("numpy=="), None);
    assert_eq!(pin("==1.0"), None);
    assert_eq!(pin("numpy"), None);
    assert_eq!(pin("  "), None);
}

/// A `custom_nodes` folder with the work folder of a pack install cut off after the installed pack moved aside.
fn cut_off_install(custom_nodes: &Path, replaces: Option<&str>) -> PathBuf {
    let work = custom_nodes.join(".novira-0123abcd");
    std::fs::create_dir_all(work.join("previous")).unwrap();
    std::fs::write(work.join("previous/nodes.py"), "old pack").unwrap();
    std::fs::create_dir_all(work.join("sub0")).unwrap();
    if let Some(folder) = replaces {
        std::fs::write(work.join(REPLACES), folder).unwrap();
    }
    work
}

// tags: state-transition, error-guessing
#[test]
fn a_start_after_a_pack_install_was_cut_off_puts_the_pack_back_and_clears_the_work_folder() {
    let dir = tempfile::tempdir().unwrap();
    let work = cut_off_install(dir.path(), Some("my-pack"));
    recover_installs(dir.path());
    assert_eq!(
        std::fs::read_to_string(dir.path().join("my-pack/nodes.py")).unwrap(),
        "old pack"
    );
    assert!(!work.exists());
}

// tags: state-transition
#[test]
fn a_start_after_the_new_pack_was_placed_keeps_it_and_clears_the_work_folder() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join("my-pack")).unwrap();
    std::fs::write(dir.path().join("my-pack/nodes.py"), "new pack").unwrap();
    let work = cut_off_install(dir.path(), Some("my-pack"));
    // A work folder with nothing moved aside (cut off while downloading) goes too.
    let fetching = dir.path().join(".novira-fetching");
    std::fs::create_dir_all(fetching.join("sub0")).unwrap();
    recover_installs(dir.path());
    assert_eq!(
        std::fs::read_to_string(dir.path().join("my-pack/nodes.py")).unwrap(),
        "new pack"
    );
    assert!(!work.exists() && !fetching.exists());
}

// tags: error-guessing
#[test]
fn a_work_folder_whose_pack_cannot_be_named_is_kept() {
    for replaces in [
        None,
        Some(""),
        Some("../outside"),
        Some(".hidden"),
        Some("a/b"),
        Some("C:x"),
    ] {
        let dir = tempfile::tempdir().unwrap();
        let work = cut_off_install(dir.path(), replaces);
        recover_installs(dir.path());
        assert!(work.join("previous/nodes.py").is_file(), "{replaces:?}");
    }
    // Folders that are not novira's are never touched.
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join("someone/previous")).unwrap();
    std::fs::create_dir_all(dir.path().join(".git")).unwrap();
    recover_installs(dir.path());
    assert!(dir.path().join("someone/previous").is_dir() && dir.path().join(".git").is_dir());
}

// tags: equivalence
#[test]
fn any_opencv_distribution_counts_as_cv2_being_there() {
    assert!(opencv_installed(
        "numpy==2.1\nopencv-python-headless==5.0.0.93\n"
    ));
    assert!(opencv_installed(
        "OpenCV_Contrib.Python @ file:///x/opencv_contrib_python-4.10.0-cp313-win_amd64.whl\n"
    ));
    assert!(!opencv_installed("numpy==2.1\nopencv-tools==1.0\n"));
    assert!(!opencv_installed(""));
}

/// A pip install report (`--report`, format 1) with the given items.
fn plan(items: &[(&str, &str, bool)]) -> String {
    let install: Vec<serde_json::Value> = items
        .iter()
        .map(|(name, version, direct)| {
            serde_json::json!({
                "download_info": {"url": format!("https://files.pythonhosted.org/{name}.whl"), "archive_info": {}},
                "is_direct": direct,
                "requested": false,
                "metadata": {"name": name, "version": version}
            })
        })
        .collect();
    serde_json::json!({"version": "1", "install": install}).to_string()
}

// tags: condition
#[test]
fn a_second_opencv_is_left_out_of_the_plan_and_the_rest_is_pinned() {
    // What ComfyUI-Impact-Subpack's requirements pulled in on 2026-11-03 next to opencv-python-headless 5.0.
    let report = plan(&[
        ("polars", "2.1.0", false),
        ("opencv-python", "4.12.0.88", false),
        ("ultralytics-thop", "2.2.4", false),
        ("ultralytics", "8.3.162", false),
    ]);
    assert_eq!(
        plan_without_second_opencv(&report, true).unwrap(),
        [
            "polars==2.1.0",
            "ultralytics-thop==2.2.4",
            "ultralytics==8.3.162"
        ]
    );
    // Only OpenCV planned: nothing is left to install.
    let only = plan(&[("opencv_contrib_python", "4.10.0.84", false)]);
    assert_eq!(plan_without_second_opencv(&only, true), Some(vec![]));
}

// tags: condition, decision-table
#[test]
fn the_plan_is_kept_as_pip_made_it_unless_an_opencv_must_go_and_every_item_pins() {
    let report = plan(&[
        ("opencv-python", "4.12.0.88", false),
        ("polars", "2.1.0", false),
    ]);
    // No cv2 yet: the first OpenCV is welcome.
    assert_eq!(plan_without_second_opencv(&report, false), None);
    // No OpenCV in the plan.
    assert_eq!(
        plan_without_second_opencv(&plan(&[("polars", "2.1.0", false)]), true),
        None
    );
    // An item from a URL or a checkout cannot be pinned by version: pip installs as planned.
    let direct = plan(&[("opencv-python", "4.12.0.88", false), ("mine", "0.1", true)]);
    assert_eq!(plan_without_second_opencv(&direct, true), None);
    // A name or version that would not make a plain pin line.
    let odd = plan(&[("opencv-python", "4.12", false), ("x", "1.0; rm", false)]);
    assert_eq!(plan_without_second_opencv(&odd, true), None);
    // Not a report, or too large to read.
    assert_eq!(plan_without_second_opencv("not json", true), None);
    assert_eq!(plan_without_second_opencv("{}", true), None);
    let huge = " ".repeat(MAX_REPORT_BYTES + 1);
    assert_eq!(plan_without_second_opencv(&huge, true), None);
}
