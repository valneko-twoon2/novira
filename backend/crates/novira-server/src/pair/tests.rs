//! The pairing store with the clock moved by hand: codes, requests, decisions, sessions, the rate limit, and the
//! phone page's strings.
use super::*;
use std::net::Ipv4Addr;

fn ip(last: u8) -> IpAddr {
    IpAddr::V4(Ipv4Addr::new(192, 168, 1, last))
}

const PHONE: u8 = 20;
const SECS: fn(u64) -> Duration = Duration::from_secs;

/// A paired device: its session secret and the store, at `now`.
fn paired(p: &mut Pairing, now: Instant, peer: IpAddr) -> String {
    let code = p.new_code(now);
    let ticket = p.request(now, peer, &code, "phone").unwrap();
    let id = pending_id(p, now);
    assert!(p.approve(now, &id));
    match p.status(now, peer, &ticket.poll) {
        Status::Approved(secret) => secret,
        other => panic!("{other:?}"),
    }
}

fn pending_id(p: &mut Pairing, now: Instant) -> String {
    p.view(now)["pending"][0]["id"]
        .as_str()
        .unwrap()
        .to_string()
}

#[test]
fn a_code_is_good_for_one_request_within_two_minutes() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    let code = p.new_code(t0);
    assert_eq!(code.len(), 32, "128 bits as hex");
    assert!(code.chars().all(|c| c.is_ascii_hexdigit()));
    assert_ne!(code, p.new_code(t0), "random");
    let ticket = p
        .request(t0 + SECS(119), ip(PHONE), &code, "phone")
        .unwrap();
    assert_eq!(ticket.poll.len(), 64);
    assert_eq!(ticket.confirm.len(), 6);
    assert!(ticket.confirm.chars().all(|c| c.is_ascii_digit()));
    // Used up.
    assert_eq!(
        p.request(t0 + SECS(119), ip(21), &code, "phone").err(),
        Some(Refused::BadCode)
    );
    // Expired at two minutes.
    let late = p.new_code(t0);
    assert_eq!(
        p.request(t0 + CODE_TTL, ip(22), &late, "phone").err(),
        Some(Refused::BadCode)
    );
    // Wrong, empty, or the code with a letter changed.
    let good = p.new_code(t0);
    let mut near = good.clone().into_bytes();
    near[0] = if near[0] == b'a' { b'b' } else { b'a' };
    for bad in [
        String::new(),
        "0".repeat(32),
        String::from_utf8(near).unwrap(),
        good.to_uppercase(),
    ] {
        assert_eq!(
            p.request(t0, ip(23), &bad, "phone").err(),
            Some(Refused::BadCode),
            "{bad}"
        );
    }
}

#[test]
fn only_the_newest_codes_stay_good() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    let codes: Vec<String> = (0..MAX_CODES + 1).map(|_| p.new_code(t0)).collect();
    assert_eq!(
        p.request(t0, ip(30), &codes[0], "a").err(),
        Some(Refused::BadCode),
        "the oldest was dropped"
    );
    for (i, code) in codes.iter().enumerate().skip(1) {
        assert!(p.request(t0, ip(31 + i as u8), code, "a").is_ok(), "{i}");
    }
}

#[test]
fn an_address_gets_five_requests_a_minute() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    for _ in 0..REQUESTS_PER_WINDOW {
        assert_eq!(
            p.request(t0, ip(PHONE), "wrong", "phone").err(),
            Some(Refused::BadCode)
        );
    }
    // Over the limit even with a good code, which stays good.
    let code = p.new_code(t0);
    assert_eq!(
        p.request(t0 + SECS(59), ip(PHONE), &code, "phone").err(),
        Some(Refused::RateLimited)
    );
    // Another address is not held back, and the window ends.
    assert_eq!(
        p.request(t0, ip(21), "wrong", "phone").err(),
        Some(Refused::BadCode)
    );
    assert!(p
        .request(t0 + RATE_WINDOW, ip(PHONE), &code, "phone")
        .is_ok());
}

#[test]
fn the_rate_limit_follows_a_bounded_number_of_addresses() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    for i in 0..MAX_TRACKED {
        let peer = IpAddr::V4(Ipv4Addr::from(0x0a00_0000 + i as u32));
        assert_eq!(p.request(t0, peer, "x", "a").err(), Some(Refused::BadCode));
    }
    let code = p.new_code(t0);
    assert_eq!(
        p.request(t0, ip(PHONE), &code, "a").err(),
        Some(Refused::RateLimited),
        "a full table refuses a new address"
    );
    assert!(p.request(t0 + RATE_WINDOW, ip(PHONE), &code, "a").is_ok());
}

#[test]
fn a_device_name_is_one_to_forty_plain_characters() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    let long = "x".repeat(LABEL_MAX + 1);
    for (n, bad) in [
        "",
        "   ",
        &long,
        "a\u{0}b",
        "a\nb",
        "a\u{202e}b",
        "\u{2067}x",
        "a\u{7f}",
    ]
    .iter()
    .enumerate()
    {
        let code = p.new_code(t0);
        assert_eq!(
            p.request(t0, ip(40 + n as u8), &code, bad).err(),
            Some(Refused::BadLabel),
            "{bad:?}"
        );
        // A refused name does not use up the code.
        assert!(p.request(t0, ip(40 + n as u8), &code, "ok").is_ok());
        // Keep the waiting list short of its cap.
        p.reset();
    }
    let code = p.new_code(t0);
    let forty = "あ".repeat(LABEL_MAX);
    assert!(p.request(t0, ip(60), &code, &format!("  {forty} ")).is_ok());
    assert_eq!(
        p.view(t0)["pending"].as_array().unwrap().last().unwrap()["label"],
        forty
    );
}

#[test]
fn the_phone_learns_the_decision_with_its_secret_from_its_address_only() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    let code = p.new_code(t0);
    let ticket = p.request(t0, ip(PHONE), &code, "phone").unwrap();
    assert_eq!(p.status(t0, ip(PHONE), &ticket.poll), Status::Pending);
    let id = pending_id(&mut p, t0);
    assert_eq!(p.view(t0)["pending"][0]["confirm"], ticket.confirm.as_str());
    // A wrong secret, or the right one from another address, learns nothing.
    assert_eq!(p.status(t0, ip(PHONE), &"0".repeat(64)), Status::Unknown);
    assert_eq!(p.status(t0, ip(PHONE), &code), Status::Unknown);
    assert!(p.approve(t0, &id));
    assert_eq!(p.status(t0, ip(21), &ticket.poll), Status::Unknown);
    assert!(!p.approve(t0, &id), "decided once");
    assert!(!p.deny(t0, &id), "decided once");
    let Status::Approved(secret) = p.status(t0, ip(PHONE), &ticket.poll) else {
        panic!("approved");
    };
    assert_eq!(secret.len(), 64);
    // Handed out once.
    assert_eq!(p.status(t0, ip(PHONE), &ticket.poll), Status::Unknown);
    assert_eq!(p.view(t0)["devices"][0]["id"], id.as_str());
    assert!(p.view(t0)["pending"].as_array().unwrap().is_empty());
    // Nothing this computer reads holds a secret.
    let shown = p.view(t0).to_string();
    for secret in [&secret, &ticket.poll, &code] {
        assert!(!shown.contains(secret.as_str()));
    }
}

#[test]
fn a_denied_or_forgotten_request_gives_no_session() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    let code = p.new_code(t0);
    let ticket = p.request(t0, ip(PHONE), &code, "phone").unwrap();
    let id = pending_id(&mut p, t0);
    assert!(p.deny(t0, &id));
    assert!(!p.approve(t0, &id));
    assert_eq!(p.status(t0, ip(PHONE), &ticket.poll), Status::Denied);
    assert_eq!(p.status(t0, ip(PHONE), &ticket.poll), Status::Unknown);
    // Not decided in five minutes: gone, and too late to approve.
    let code = p.new_code(t0);
    let ticket = p.request(t0, ip(PHONE), &code, "phone").unwrap();
    let id = pending_id(&mut p, t0);
    assert_eq!(
        p.status(t0 + SECS(299), ip(PHONE), &ticket.poll),
        Status::Pending
    );
    assert!(!p.approve(t0 + PENDING_TTL, &id));
    assert_eq!(
        p.status(t0 + PENDING_TTL, ip(PHONE), &ticket.poll),
        Status::Unknown
    );
    // Approved but not collected in time: gone as well.
    let code = p.new_code(t0);
    let ticket = p.request(t0, ip(PHONE), &code, "phone").unwrap();
    let id = pending_id(&mut p, t0);
    assert!(p.approve(t0, &id));
    assert_eq!(
        p.status(t0 + PENDING_TTL, ip(PHONE), &ticket.poll),
        Status::Unknown
    );
    assert!(p.view(t0 + PENDING_TTL)["devices"]
        .as_array()
        .unwrap()
        .is_empty());
    assert!(!p.approve(t0, "nope") && !p.deny(t0, ""));
}

#[test]
fn too_many_waiting_requests_are_refused() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    for i in 0..MAX_PENDING {
        let code = p.new_code(t0);
        p.request(t0, ip(100 + i as u8), &code, "a").unwrap();
    }
    let code = p.new_code(t0);
    assert_eq!(
        p.request(t0, ip(PHONE), &code, "a").err(),
        Some(Refused::Busy)
    );
    // The refusal did not use up the code; once the waiting ones are gone a request is taken again.
    assert_eq!(p.view(t0)["codes"], 1);
    let later = t0 + PENDING_TTL;
    let code = p.new_code(later);
    assert!(p.request(later, ip(PHONE), &code, "a").is_ok());
}

#[test]
fn a_session_is_bound_to_its_address_and_ends_idle_or_at_four_hours() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    let secret = paired(&mut p, t0, ip(PHONE));
    assert!(p.session(t0, ip(PHONE), &secret).is_some());
    assert!(p.session(t0, ip(21), &secret).is_none(), "another address");
    assert!(p.session(t0, ip(PHONE), "").is_none());
    assert!(p.session(t0, ip(PHONE), &secret.to_uppercase()).is_none());
    // Each use moves the idle limit; 30 minutes without one ends it.
    let mut now = t0;
    for _ in 0..3 {
        now += SESSION_IDLE - SECS(1);
        assert!(p.session(now, ip(PHONE), &secret).is_some());
    }
    assert!(p.session(now + SESSION_IDLE, ip(PHONE), &secret).is_none());
    // In constant use it still ends four hours after pairing.
    let t1 = now + SESSION_IDLE;
    let secret = paired(&mut p, t1, ip(PHONE));
    let mut now = t1;
    while now + SECS(600) < t1 + SESSION_MAX {
        now += SECS(600);
        assert!(p.session(now, ip(PHONE), &secret).is_some());
    }
    assert!(p.session(t1 + SESSION_MAX, ip(PHONE), &secret).is_none());
}

#[test]
fn this_computer_revokes_one_device_or_all() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    let a = paired(&mut p, t0, ip(PHONE));
    let b = paired(&mut p, t0, ip(21));
    let id_a = p.view(t0)["devices"][0]["id"].as_str().unwrap().to_string();
    assert!(p.revoke(&id_a));
    assert!(!p.revoke(&id_a), "already gone");
    assert!(p.session(t0, ip(PHONE), &a).is_none());
    assert!(p.session(t0, ip(21), &b).is_some());
    let code = p.new_code(t0);
    p.reset();
    assert!(p.session(t0, ip(21), &b).is_none());
    assert_eq!(
        p.request(t0, ip(22), &code, "a").err(),
        Some(Refused::BadCode)
    );
}

#[test]
fn the_number_of_paired_devices_is_capped() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    for i in 0..MAX_SESSIONS {
        paired(&mut p, t0, ip(100 + i as u8));
    }
    let code = p.new_code(t0);
    p.request(t0, ip(PHONE), &code, "a").unwrap();
    let id = pending_id(&mut p, t0);
    assert!(!p.approve(t0, &id));
}

#[test]
fn the_session_cookie_is_named_per_port_and_locked_down() {
    assert_eq!(session_cookie(8443), "novira_session_8443");
    let cookie = session_set_cookie(8443, "abc").unwrap();
    let cookie = cookie.to_str().unwrap();
    for part in [
        "novira_session_8443=abc",
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        "Secure",
        "Max-Age=14400",
    ] {
        assert!(cookie.contains(part), "{cookie}");
    }
}

#[test]
fn the_routes_split_into_public_and_this_computers() {
    use axum::http::Method;
    for (method, path) in [
        (Method::GET, PAGE_ROUTE),
        (Method::GET, SCRIPT_ROUTE),
        (Method::GET, crate::CA_ROUTE),
        (Method::POST, REQUEST_ROUTE),
        (Method::POST, STATUS_ROUTE),
    ] {
        assert!(is_public(&method, path), "{method} {path}");
        assert!(!is_management(path));
    }
    for (method, path) in [
        (Method::POST, PAGE_ROUTE),
        (Method::GET, REQUEST_ROUTE),
        (Method::GET, "/pair/"),
        (Method::GET, "/pair.js/x"),
        (Method::GET, "/"),
        (Method::POST, CODE_ROUTE),
    ] {
        assert!(!is_public(&method, path), "{method} {path}");
    }
    for path in [
        CODE_ROUTE,
        STATE_ROUTE,
        APPROVE_ROUTE,
        DENY_ROUTE,
        REVOKE_ROUTE,
    ] {
        assert!(is_management(path), "{path}");
    }
}

/// The page's strings: ja and en have the same keys, none empty, each one used by the script and each one the script
/// uses defined.
#[test]
fn the_phone_page_has_the_same_strings_in_japanese_and_english() {
    let strings: Value = serde_json::from_str(STRINGS).unwrap();
    let keys = |lang: &str| {
        let map = strings[lang].as_object().unwrap();
        for (key, value) in map {
            let text = value.as_str().unwrap_or_else(|| panic!("{lang}.{key}"));
            assert!(!text.trim().is_empty(), "{lang}.{key}");
            // The spelling of the name is checked over the whole repository (`tools/check-name.mjs`).
            assert!(!text.contains("NOVIRA"), "{lang}.{key}: {text}");
        }
        let mut keys: Vec<&String> = map.keys().collect();
        keys.sort();
        keys.into_iter().cloned().collect::<Vec<String>>()
    };
    assert_eq!(keys("ja"), keys("en"));
    assert_eq!(strings.as_object().unwrap().len(), 2, "ja and en only");
    let source = include_str!("page.js");
    let defined = keys("en");
    for key in &defined {
        assert!(
            source.contains(&format!("'{key}'")),
            "{key} is not used by the script"
        );
    }
    for call in ["t('", "say('"] {
        for (at, _) in source.match_indices(call) {
            // `post('` ends in `t('` too: only a call of its own counts.
            let before = source[..at].chars().next_back();
            if before.is_some_and(|c| c.is_alphanumeric() || c == '_') {
                continue;
            }
            let key = source[at + call.len()..].split_once('\'').unwrap().0;
            assert!(
                defined.iter().any(|k| k == key),
                "the script uses {key}, which is not defined"
            );
        }
    }
    assert_eq!(source.matches("__STRINGS__").count(), 1);
}

#[tokio::test]
async fn the_script_carries_its_strings_and_the_page_loads_it_as_a_file() {
    let body = script_source();
    assert!(!body.contains("__STRINGS__"));
    assert!(body.contains("\"title\": \"novira とつなぐ\""));
    let page = include_str!("page.html");
    assert!(page.contains("<script src=\"/pair.js\"></script>"));
    assert!(
        !page.contains("<script>"),
        "no inline script (CSP script-src 'self')"
    );
}

#[test]
fn the_same_phone_pairing_again_replaces_its_earlier_session() {
    let mut p = Pairing::default();
    let t0 = Instant::now();
    let first = paired(&mut p, t0, ip(PHONE));
    let other = paired(&mut p, t0, ip(PHONE + 1));
    let second = paired(&mut p, t0, ip(PHONE));
    assert_eq!(p.view(t0)["devices"].as_array().unwrap().len(), 2);
    assert!(p.session(t0, ip(PHONE), &first).is_none());
    assert!(p.session(t0, ip(PHONE), &second).is_some());
    assert!(p.session(t0, ip(PHONE + 1), &other).is_some());
}
