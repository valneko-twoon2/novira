//! Fact look-up for the assistant: a few paragraphs of Wikipedia about a word (a period, a garment, a place, a trade).
//!
//! This is the one place where text the model wrote leaves the PC for a website, so everything is fixed here and nothing
//! comes from the caller but the search words: the host is chosen from the [`Lang`] enum (`ja.wikipedia.org` or
//! `en.wikipedia.org`, never from input), the request is an HTTPS GET of the MediaWiki action API with the words as one
//! encoded parameter, a redirect is followed only inside the same origin, no cookies are kept, time and answer size are
//! capped, and the result is cut back to at most [`MAX_RESULTS`] entries of plain text. The window asks the user before
//! it calls (the read gating in `tools.rs`); this module does not decide that.
use crate::endpoints::{self, Service};
use reqwest::Url;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

/// The longest search text, in characters (the tool schema says the same).
pub const MAX_QUERY_CHARS: usize = 100;
/// The most entries returned.
pub const MAX_RESULTS: usize = 3;
/// The most characters of one entry's text.
pub const MAX_EXTRACT_CHARS: usize = 1500;
const MAX_TITLE_CHARS: usize = 200;
/// The most bytes of an answer read (after decompression). A real answer for three intros is a few kilobytes.
const MAX_BODY_BYTES: usize = 1024 * 1024;
const MAX_REDIRECTS: usize = 3;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(20);
const USER_AGENT: &str = concat!(
    "novira/",
    env!("CARGO_PKG_VERSION"),
    " (desktop app; +https://github.com/valneko-twoon2/novira) reqwest"
);

/// The Wikipedia language editions the look-up may read. Anything else is refused before a request exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lang {
    Ja,
    En,
}

impl Lang {
    /// Exactly `ja` or `en` (no case folding, no spaces, nothing else).
    pub fn parse(s: &str) -> Result<Lang, String> {
        match s {
            "ja" => Ok(Lang::Ja),
            "en" => Ok(Lang::En),
            _ => Err("language must be \"ja\" or \"en\"".into()),
        }
    }

    fn service(self) -> Service {
        match self {
            Lang::Ja => Service::WikipediaJa,
            Lang::En => Service::WikipediaEn,
        }
    }

    fn host(self) -> &'static str {
        match self {
            Lang::Ja => "ja.wikipedia.org",
            Lang::En => "en.wikipedia.org",
        }
    }
}

/// One article of the answer. The text is Wikipedia's (CC BY-SA); `url` is where it came from.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceHit {
    pub title: String,
    pub extract: String,
    pub url: String,
}

/// The search words as sent: control characters become spaces, runs of white space become one space. Empty or longer
/// than [`MAX_QUERY_CHARS`] is refused.
pub fn clean_query(query: &str) -> Result<String, String> {
    let spaced: String = query
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let cleaned = spaced.split_whitespace().collect::<Vec<_>>().join(" ");
    let n = cleaned.chars().count();
    if n == 0 {
        return Err("query is empty".into());
    }
    if n > MAX_QUERY_CHARS {
        return Err(format!("query is longer than {MAX_QUERY_CHARS} characters"));
    }
    Ok(cleaned)
}

/// Whether `url` is the HTTPS address of `lang`'s Wikipedia. A debug build also takes the loopback test address
/// (`NOVIRA_TEST_WIKIPEDIA_*_BASE`).
fn is_wikipedia(url: &Url, lang: Lang) -> bool {
    if url.scheme() == "https" {
        return url.host_str() == Some(lang.host())
            && url.port().is_none()
            && url.username().is_empty()
            && url.password().is_none();
    }
    cfg!(debug_assertions) && is_loopback(url)
}

fn is_loopback(url: &Url) -> bool {
    url.scheme() == "http" && matches!(url.host_str(), Some("127.0.0.1" | "localhost"))
}

/// The request for the articles that match `query` best, with the start of their text.
pub fn search_url(lang: Lang, query: &str) -> Result<Url, String> {
    let words = clean_query(query)?;
    let mut url = Url::parse(&endpoints::url(lang.service(), "/w/api.php"))
        .map_err(|_| "the address of the look-up is not valid".to_string())?;
    if !is_wikipedia(&url, lang) {
        return Err("the address of the look-up is not Wikipedia".into());
    }
    let limit = MAX_RESULTS.to_string();
    url.query_pairs_mut()
        .append_pair("action", "query")
        .append_pair("format", "json")
        .append_pair("formatversion", "2")
        .append_pair("generator", "search")
        .append_pair("gsrsearch", &words)
        .append_pair("gsrnamespace", "0")
        .append_pair("gsrlimit", &limit)
        .append_pair("prop", "extracts")
        .append_pair("exintro", "1")
        .append_pair("explaintext", "1")
        .append_pair("exlimit", &limit);
    Ok(url)
}

/// Text from outside: control characters dropped (a line break stays), long runs of blank lines folded, cut to `max`
/// characters (with an ellipsis when cut).
fn clean_text(s: &str, max: usize) -> String {
    let kept: String = s
        .chars()
        .filter(|c| *c == '\n' || !c.is_control())
        .collect();
    let mut out = String::new();
    let mut breaks = 0;
    for c in kept.trim().chars() {
        if c == '\n' {
            breaks += 1;
            if breaks > 2 {
                continue;
            }
        } else {
            breaks = 0;
        }
        out.push(c);
    }
    if out.chars().count() > max {
        let mut cut: String = out.chars().take(max.saturating_sub(1)).collect();
        cut = cut.trim_end().to_string();
        cut.push('…');
        return cut;
    }
    out
}

/// The address of an article: the language's own `/wiki/<title>`.
fn article_url(lang: Lang, title: &str) -> Option<String> {
    let mut url = Url::parse(&endpoints::origin(lang.service())).ok()?;
    url.path_segments_mut()
        .ok()?
        .push("wiki")
        .push(&title.replace(' ', "_"));
    Some(url.to_string())
}

/// The entries of an answer of [`search_url`], best match first, cut to the limits. No match is an empty list; an answer
/// that is not the expected shape is an error.
pub fn parse_response(lang: Lang, body: &[u8]) -> Result<Vec<ReferenceHit>, String> {
    let v: Value = serde_json::from_slice(body)
        .map_err(|_| "Wikipedia's answer was not understood".to_string())?;
    if !v.is_object() {
        return Err("Wikipedia's answer was not understood".into());
    }
    if v["error"].is_object() {
        return Err("Wikipedia refused the search".into());
    }
    if v["query"].is_null() {
        return Ok(Vec::new());
    }
    let pages = v["query"]["pages"]
        .as_array()
        .ok_or("Wikipedia's answer had no list of articles")?;
    let mut ranked: Vec<(u64, &Value)> = pages
        .iter()
        .map(|p| (p["index"].as_u64().unwrap_or(u64::MAX), p))
        .collect();
    ranked.sort_by_key(|(i, _)| *i);
    Ok(ranked
        .into_iter()
        .filter_map(|(_, p)| {
            let title = clean_text(p["title"].as_str()?, MAX_TITLE_CHARS).replace('\n', " ");
            let extract = clean_text(p["extract"].as_str()?, MAX_EXTRACT_CHARS);
            if title.is_empty() || extract.is_empty() {
                return None;
            }
            let url = article_url(lang, &title)?;
            Some(ReferenceHit {
                title,
                extract,
                url,
            })
        })
        .take(MAX_RESULTS)
        .collect())
}

/// The client: no cookies (the feature is off), no proxy for a loopback test address, a redirect only inside the same
/// origin and at most [`MAX_REDIRECTS`] times, and the time limits.
fn client(first: &Url) -> Result<reqwest::Client, String> {
    let policy = reqwest::redirect::Policy::custom(|attempt| {
        let same = attempt
            .previous()
            .last()
            .is_some_and(|from| from.origin() == attempt.url().origin());
        if same && attempt.previous().len() <= MAX_REDIRECTS {
            attempt.follow()
        } else {
            attempt.stop()
        }
    });
    let mut builder = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(TOTAL_TIMEOUT)
        .user_agent(USER_AGENT)
        .redirect(policy);
    if is_loopback(first) {
        builder = builder.no_proxy();
    }
    builder
        .build()
        .map_err(|e| format!("cannot prepare the connection: {e}"))
}

/// Looks `query` up on the Wikipedia of `lang` (`ja` or `en`). Errors are sentences for the model.
pub async fn lookup(lang: &str, query: &str) -> Result<Vec<ReferenceHit>, String> {
    let lang = Lang::parse(lang)?;
    let url = search_url(lang, query)?;
    let http = client(&url)?;
    let mut resp = http
        .get(url)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Wikipedia did not answer in time".to_string()
            } else {
                "Cannot reach Wikipedia".to_string()
            }
        })?;
    if !is_wikipedia(resp.url(), lang) {
        return Err("Wikipedia answered from another address".into());
    }
    if !resp.status().is_success() {
        return Err(format!(
            "Wikipedia did not answer (HTTP {})",
            resp.status().as_u16()
        ));
    }
    if resp
        .content_length()
        .is_some_and(|n| n > MAX_BODY_BYTES as u64)
    {
        return Err("Wikipedia's answer is unexpectedly large".into());
    }
    let mut body: Vec<u8> = Vec::new();
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|_| "Wikipedia's answer was cut off".to_string())?
    {
        if body.len() + chunk.len() > MAX_BODY_BYTES {
            return Err("Wikipedia's answer is unexpectedly large".into());
        }
        body.extend_from_slice(&chunk);
    }
    parse_response(lang, &body)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn pairs(url: &Url) -> Vec<(String, String)> {
        url.query_pairs()
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect()
    }

    #[test]
    fn only_ja_and_en_are_languages() {
        assert_eq!(Lang::parse("ja"), Ok(Lang::Ja));
        assert_eq!(Lang::parse("en"), Ok(Lang::En));
        for bad in [
            "",
            "JA",
            "En",
            " ja",
            "ja ",
            "fr",
            "zh",
            "ja.wikipedia.org",
            "evil.example/ja",
            "ja@evil.example",
            "ja\n",
            "ja,en",
            "../en",
        ] {
            assert!(Lang::parse(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn the_host_comes_from_the_language_and_the_words_are_one_parameter() {
        for (lang, host) in [
            (Lang::Ja, "ja.wikipedia.org"),
            (Lang::En, "en.wikipedia.org"),
        ] {
            let url = search_url(lang, "samurai armor").unwrap();
            assert_eq!(url.scheme(), "https");
            assert_eq!(url.host_str(), Some(host));
            assert_eq!(url.path(), "/w/api.php");
            assert!(url.fragment().is_none());
        }
        let url = search_url(Lang::Ja, "鎧").unwrap();
        let names: Vec<_> = pairs(&url).into_iter().map(|(k, _)| k).collect();
        assert_eq!(
            names,
            [
                "action",
                "format",
                "formatversion",
                "generator",
                "gsrsearch",
                "gsrnamespace",
                "gsrlimit",
                "prop",
                "exintro",
                "explaintext",
                "exlimit"
            ]
        );
    }

    #[test]
    fn hostile_words_stay_inside_their_one_parameter() {
        let words = "a&action=parse&gsrsearch=x#frag?y=1 %26 \\ ../ @evil.example";
        let url = search_url(Lang::En, words).unwrap();
        assert_eq!(url.host_str(), Some("en.wikipedia.org"));
        assert_eq!(url.path(), "/w/api.php");
        assert!(url.fragment().is_none());
        let all = pairs(&url);
        assert_eq!(all.iter().filter(|(k, _)| k == "action").count(), 1);
        assert_eq!(all.iter().find(|(k, _)| k == "action").unwrap().1, "query");
        assert_eq!(all.iter().filter(|(k, _)| k == "gsrsearch").count(), 1);
        let sent = &all.iter().find(|(k, _)| k == "gsrsearch").unwrap().1;
        assert_eq!(sent, words);
        // The raw query string has no unescaped separator from the words.
        let raw = url.query().unwrap();
        assert_eq!(raw.matches("gsrsearch=").count(), 1);
        assert!(!raw.contains('#'));
    }

    #[test]
    fn line_breaks_and_control_characters_become_spaces() {
        assert_eq!(clean_query("a\r\nb\tc\u{0}d\u{7f}e").unwrap(), "a b c d e");
        assert_eq!(clean_query("  江戸　時代 \n").unwrap(), "江戸 時代");
        let url = search_url(Lang::Ja, "x\r\nHost: evil.example").unwrap();
        assert!(!url.as_str().contains('\n') && !url.as_str().contains('\r'));
        assert_eq!(url.host_str(), Some("ja.wikipedia.org"));
    }

    #[test]
    fn an_empty_or_long_query_is_refused() {
        for bad in ["", "   ", "\n\t\r", "\u{0}\u{1}"] {
            assert!(clean_query(bad).is_err(), "{bad:?}");
            assert!(search_url(Lang::En, bad).is_err(), "{bad:?}");
        }
        assert!(clean_query(&"a".repeat(MAX_QUERY_CHARS)).is_ok());
        assert!(clean_query(&"a".repeat(MAX_QUERY_CHARS + 1)).is_err());
        // Characters, not bytes.
        assert!(clean_query(&"鎧".repeat(MAX_QUERY_CHARS)).is_ok());
        assert!(clean_query(&"鎧".repeat(MAX_QUERY_CHARS + 1)).is_err());
        assert!(search_url(Lang::En, &"x".repeat(100_000)).is_err());
    }

    #[test]
    fn only_wikipedia_over_https_passes_the_address_check() {
        let ok = |s: &str, l| is_wikipedia(&Url::parse(s).unwrap(), l);
        assert!(ok("https://ja.wikipedia.org/w/api.php", Lang::Ja));
        assert!(!ok("https://en.wikipedia.org/w/api.php", Lang::Ja));
        assert!(!ok("https://ja.wikipedia.org.evil.example/", Lang::Ja));
        assert!(!ok("https://evil.example/ja.wikipedia.org", Lang::Ja));
        assert!(!ok("https://user@ja.wikipedia.org/", Lang::Ja));
        assert!(!ok("https://ja.wikipedia.org:8443/", Lang::Ja));
        assert!(!ok("http://ja.wikipedia.org/", Lang::Ja));
        assert!(!ok("http://127.0.0.1.evil.example:80/", Lang::Ja));
    }

    fn answer(pages: Value) -> Vec<u8> {
        serde_json::to_vec(&json!({"batchcomplete": true, "query": {"pages": pages}})).unwrap()
    }

    #[test]
    fn a_normal_answer_becomes_ranked_entries_with_article_addresses() {
        let body = answer(json!([
            {"pageid": 2, "title": "Second", "index": 2, "extract": "two"},
            {"pageid": 1, "title": "Edo period", "index": 1, "extract": "The Edo period\n\n\n\n\nwas long."},
            {"pageid": 3, "title": "A/B ?x#y", "index": 3, "extract": "three"},
            {"pageid": 4, "title": "Fourth", "index": 4, "extract": "four"},
        ]));
        let hits = parse_response(Lang::En, &body).unwrap();
        assert_eq!(hits.len(), MAX_RESULTS);
        assert_eq!(hits[0].title, "Edo period");
        assert_eq!(hits[0].extract, "The Edo period\n\nwas long.");
        assert_eq!(hits[0].url, "https://en.wikipedia.org/wiki/Edo_period");
        assert_eq!(hits[1].title, "Second");
        // The title cannot leave its path segment.
        assert_eq!(hits[2].url, "https://en.wikipedia.org/wiki/A%2FB_%3Fx%23y");
        let ja = parse_response(
            Lang::Ja,
            &answer(json!([{"title": "江戸時代", "index": 1, "extract": "x"}])),
        )
        .unwrap();
        assert!(ja[0].url.starts_with("https://ja.wikipedia.org/wiki/"));
    }

    #[test]
    fn text_is_cut_and_stripped() {
        let long = "あ".repeat(5000);
        let body = answer(json!([
            {"title": format!("T\u{0}{}", "t".repeat(500)), "index": 1, "extract": format!("a\u{1b}[31m\u{0}b{long}")},
        ]));
        let hits = parse_response(Lang::Ja, &body).unwrap();
        assert!(hits[0].extract.chars().count() <= MAX_EXTRACT_CHARS);
        assert!(hits[0].extract.ends_with('…'));
        assert!(hits[0].extract.starts_with("a[31mb"));
        assert!(!hits[0].extract.chars().any(|c| c.is_control() && c != '\n'));
        assert!(hits[0].title.chars().count() <= MAX_TITLE_CHARS);
        assert!(!hits[0].title.contains('\u{0}'));
    }

    #[test]
    fn entries_without_text_or_title_are_left_out() {
        let body = answer(json!([
            {"title": "Empty", "index": 1, "extract": "  \n "},
            {"title": "", "index": 2, "extract": "x"},
            {"index": 3, "extract": "x"},
            {"title": "No text", "index": 4},
            {"title": "Number", "index": 5, "extract": 5},
            {"title": "Good", "index": 6, "extract": "ok"},
        ]));
        let hits = parse_response(Lang::En, &body).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Good");
    }

    #[test]
    fn no_match_is_an_empty_list_and_a_wrong_shape_is_an_error() {
        assert_eq!(
            parse_response(Lang::En, br#"{"batchcomplete":true}"#).unwrap(),
            vec![]
        );
        assert_eq!(
            parse_response(Lang::En, &answer(json!([]))).unwrap(),
            vec![]
        );
        for bad in [
            &b""[..],
            b"not json",
            b"[]",
            b"null",
            br#"{"query":{"pages":"x"}}"#,
            br#"{"query":{"pages":{"1":{"title":"a","extract":"b"}}}}"#,
            br#"{"query":5}"#,
            br#"{"error":{"code":"x","info":"y"}}"#,
            b"{\"query\":{\"pages\":[",
        ] {
            assert!(
                parse_response(Lang::En, bad).is_err(),
                "{:?}",
                String::from_utf8_lossy(bad)
            );
        }
    }

    #[test]
    fn the_client_allows_a_redirect_only_inside_the_same_origin() {
        // The policy is a closure over reqwest's attempt type, which cannot be built by hand: the behaviour is covered by
        // the fake-server test (`tests/reference_fake.rs`). Here, only that the client builds for both kinds of address.
        assert!(client(&Url::parse("https://ja.wikipedia.org/").unwrap()).is_ok());
        assert!(client(&Url::parse("http://127.0.0.1:9/").unwrap()).is_ok());
    }
}
