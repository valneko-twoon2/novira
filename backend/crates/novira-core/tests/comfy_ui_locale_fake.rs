//! Reading the words of ComfyUI's own screens from the frontend it serves, against a fake server that answers the way a
//! real one can fail: a page that errors, a script that is too large or not text, a frontend laid out otherwise, and
//! words that cannot be read. A failed read is an error to the caller; a frontend that is merely different is "no words".
use axum::extract::{Path, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{Engine, EngineError};
use serde_json::json;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    /// A frontend laid out as expected, with readable words.
    Good,
    /// The page answers HTTP 500.
    PageFails,
    /// The page has no entry script.
    NoEntry,
    /// The entry script names no language map.
    NoMap,
    /// The map does not know the language.
    NoLanguage,
    /// The words file is not a module of data.
    UnreadableWords,
    /// The words file is larger than a script may be.
    TooLarge,
    /// The words file is not text.
    NotText,
    /// The words file is missing (HTTP 404).
    MissingFile,
}

const MAIN: &str = "var t={nodeLibraryTab:{sections:{comfyNodes:`Core`,extensions:`Add-ons`}}},n={model:`Modèle`};\
export{t as sideToolbar,n as nodeCategories};";
const NODES: &str = "var e={display_name:`Échantillonneur`},n={KSampler:e};export{n as default};";

async fn page(State(m): State<Mode>) -> impl IntoResponse {
    match m {
        Mode::PageFails => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        Mode::NoEntry => "<html></html>".into_response(),
        _ => "<script src=\"./assets/index-abc123.js\"></script>".into_response(),
    }
}

async fn asset(State(m): State<Mode>, Path(name): Path<String>) -> impl IntoResponse {
    let text =
        |s: &str| ([(header::CONTENT_TYPE, "text/javascript")], s.to_string()).into_response();
    match name.as_str() {
        "index-abc123.js" if m == Mode::NoMap => text("console.log(1)"),
        "index-abc123.js" => text("import(`./i18n-def456.js`)"),
        "i18n-def456.js" if m == Mode::NoLanguage => text("{\"./de/main.json\":1}"),
        "i18n-def456.js" => text(
            "{\"./fr/main.json\":()=>import(`./main-fr.js`),\"./fr/nodeDefs.json\":()=>import(`./nodeDefs-fr.js`)}",
        ),
        "main-fr.js" => match m {
            Mode::MissingFile => StatusCode::NOT_FOUND.into_response(),
            Mode::UnreadableWords => text("this is not a module"),
            Mode::TooLarge => text(&"a".repeat(9 * 1024 * 1024)),
            Mode::NotText => ([(header::CONTENT_TYPE, "text/javascript")], vec![0xff, 0xfe, 0xfd]).into_response(),
            _ => text(MAIN),
        },
        "nodeDefs-fr.js" => text(NODES),
        _ => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn engine(mode: Mode) -> ComfyEngine {
    let app = Router::new()
        .route("/", get(page))
        .route("/assets/{name}", get(asset))
        .route(
            "/system_stats",
            get(|| async { Json(json!({ "system": {} })) }),
        )
        .with_state(mode);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    ComfyEngine::new(&url, None, Duration::from_secs(2)).unwrap()
}

async fn words(
    mode: Mode,
    locale: &str,
) -> Result<Option<novira_core::comfy::ui_locale::ComfyUiLocale>, EngineError> {
    engine(mode)
        .await
        .ui_locale(&CancellationToken::new(), locale)
        .await
}

#[tokio::test]
async fn the_words_of_a_language_are_read_from_the_frontend_the_server_serves() {
    let l = words(Mode::Good, "fr").await.unwrap().expect("words");
    assert_eq!(l.comfy_nodes_heading.as_deref(), Some("Core"));
    assert_eq!(
        l.categories.get("model").map(String::as_str),
        Some("Modèle")
    );
    assert_eq!(l.nodes["KSampler"].name.as_deref(), Some("Échantillonneur"));
}

#[tokio::test]
async fn a_frontend_laid_out_otherwise_gives_no_words_and_no_error() {
    for mode in [
        Mode::NoEntry,
        Mode::NoMap,
        Mode::NoLanguage,
        Mode::UnreadableWords,
    ] {
        assert_eq!(words(mode, "fr").await.unwrap(), None);
    }
    // A language ComfyUI has no files for is not even asked about.
    assert_eq!(words(Mode::Good, "xx").await.unwrap(), None);
}

#[tokio::test]
async fn a_script_that_cannot_be_fetched_is_an_error_that_names_what_failed() {
    let err = words(Mode::PageFails, "fr").await.unwrap_err().to_string();
    assert!(err.contains("answered 500"), "{err}");
    let err = words(Mode::MissingFile, "fr")
        .await
        .unwrap_err()
        .to_string();
    assert!(err.contains("main-fr.js") && err.contains("404"), "{err}");
    let err = words(Mode::TooLarge, "fr").await.unwrap_err().to_string();
    assert!(err.contains("too large"), "{err}");
    assert!(words(Mode::NotText, "fr").await.is_err());
}
