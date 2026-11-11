//! Phones with passkeys: enrolling once after an approval, signing in, the refusals, the address binding, forgetting,
//! what a signed-in phone may run, the rate limit, and the home network's pairing kept apart.
use super::*;

// tags: scenario
#[tokio::test]
async fn a_paired_phone_makes_one_passkey_and_signs_in_with_it_later() {
    let a = Away::start().await;
    a.on().await;
    let phone = Authenticator::new();
    let cookie = a.pair(PHONE).await;
    assert_eq!(a.bootstrap(PHONE, &cookie).await, StatusCode::OK);
    let (status, answer) = a.make_passkey(PHONE, &cookie, &phone).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    // One passkey per approval.
    let (status, answer) = a.make_passkey(PHONE, &cookie, &Authenticator::new()).await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::FORBIDDEN, Some("not_enrolling"))
    );
    let state = a.remote_state().await;
    let passkeys = state["passkeys"].as_array().unwrap();
    assert_eq!(passkeys.len(), 1);
    assert_eq!(passkeys[0]["label"], "iPhone");
    assert_eq!(state["log"][0]["what"], "enrolled");
    assert!(
        !state.to_string().contains(&passkey::encode(&phone.point())),
        "no key material on the screen"
    );
    // Later, from the same phone: its passkey signs it in.
    let mut phone = phone;
    for d in state["devices"].as_array().unwrap() {
        a.manage(REVOKE_ROUTE, &json!({ "id": d["id"] }).to_string())
            .await;
    }
    assert_eq!(a.bootstrap(PHONE, &cookie).await, StatusCode::UNAUTHORIZED);
    let (status, signed_in) = a.sign_in(PHONE, &mut phone).await;
    assert_eq!(status, StatusCode::OK);
    let signed_in = signed_in.expect("a session cookie");
    assert_eq!(a.bootstrap(PHONE, &signed_in).await, StatusCode::OK);
    let state = a.remote_state().await;
    assert_eq!(state["log"][0]["what"], "signedIn");
    assert_eq!(state["log"][0]["peer"], PHONE.to_string());
    assert!(state["passkeys"][0]["lastUsedAt"].is_string());
    assert_eq!(state["devices"].as_array().unwrap().len(), 1);
    // A session that signed in may not make a passkey.
    let (status, _) = a
        .make_passkey(PHONE, &signed_in, &Authenticator::new())
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    a.stop().await;
}

// tags: error-guessing, state-transition
#[tokio::test]
async fn a_passkey_that_does_not_check_out_is_not_kept_and_the_session_may_try_again() {
    let a = Away::start().await;
    a.on().await;
    let cookie = a.pair(PHONE).await;
    let (_, options, _) = a
        .post(PHONE, ENROL_BEGIN_ROUTE, json!({}), Some(&cookie))
        .await;
    let challenge = passkey::decode(options["challenge"].as_str().unwrap()).unwrap();
    let phone = Authenticator::new();
    // Made for another origin.
    let made = phone.create(
        passkey::Party {
            rp_id: NAME,
            origin: "https://evil.example",
        },
        &challenge,
    );
    let body = json!({
        "id": passkey::encode(&made.id),
        "clientDataJSON": passkey::encode(&made.client_data),
        "authenticatorData": passkey::encode(&made.auth_data),
        "publicKey": passkey::encode(&made.spki),
        "algorithm": passkey::ES256,
    });
    let (status, answer, _) = a
        .post(PHONE, ENROL_FINISH_ROUTE, body.clone(), Some(&cookie))
        .await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::BAD_REQUEST, Some("refused"))
    );
    // The challenge is used up either way.
    let (status, _, _) = a.post(PHONE, ENROL_FINISH_ROUTE, body, Some(&cookie)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    // Hostile bodies.
    for bad in [
        json!({}),
        json!({ "id": "***", "clientDataJSON": "", "authenticatorData": "", "publicKey": "" }),
        json!({ "id": "", "clientDataJSON": "", "authenticatorData": "", "publicKey": "" }),
    ] {
        let (status, _, _) = a
            .post(PHONE, ENROL_FINISH_ROUTE, bad.clone(), Some(&cookie))
            .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{bad}");
    }
    let (status, _, _) = a
        .phone(
            PHONE,
            "POST",
            ENROL_FINISH_ROUTE,
            &"x".repeat(MAX_BODY + 1),
            Some(&cookie),
        )
        .await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert!(a.remote_state().await["passkeys"]
        .as_array()
        .unwrap()
        .is_empty());
    // The session can still make one.
    let (status, answer) = a.make_passkey(PHONE, &cookie, &phone).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    a.stop().await;
}

// tags: error-guessing, equivalence
#[tokio::test]
async fn a_sign_in_is_refused_for_an_unknown_passkey_another_address_a_used_challenge_or_a_bad_signature(
) {
    let a = Away::start().await;
    a.on().await;
    let mut phone = a.enrolled().await;
    // A passkey this computer never kept.
    let mut stranger = Authenticator::new();
    assert_eq!(
        a.sign_in(PHONE, &mut stranger).await,
        (StatusCode::FORBIDDEN, None)
    );
    // The challenge was given to another address: refused there, and still good for the address that asked.
    let body = a.sign_in_body(PHONE, &mut phone).await;
    let (status, _, _) = a
        .post(OTHER, SIGN_IN_FINISH_ROUTE, body.clone(), None)
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _, _) = a
        .post(PHONE, SIGN_IN_FINISH_ROUTE, body.clone(), None)
        .await;
    assert_eq!(status, StatusCode::OK);
    // A good sign-in, replayed.
    let (status, _, cookie) = a.post(PHONE, SIGN_IN_FINISH_ROUTE, body, None).await;
    assert_eq!((status, cookie), (StatusCode::FORBIDDEN, None));
    // A signature that does not verify is logged.
    let mut body = a.sign_in_body(PHONE, &mut phone).await;
    let mut signature = passkey::decode(body["signature"].as_str().unwrap()).unwrap();
    let last = signature.len() - 1;
    signature[last] ^= 1;
    body["signature"] = passkey::encode(&signature).into();
    let (status, _, _) = a.post(PHONE, SIGN_IN_FINISH_ROUTE, body, None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(a.remote_state().await["log"][0]["what"], "refused");
    a.stop().await;
}

// tags: condition
#[tokio::test]
async fn a_session_works_only_from_the_address_that_signed_in() {
    let a = Away::start().await;
    a.on().await;
    let mut phone = a.enrolled().await;
    let (_, cookie) = a.sign_in(PHONE, &mut phone).await;
    let cookie = cookie.unwrap();
    assert_eq!(a.bootstrap(PHONE, &cookie).await, StatusCode::OK);
    assert_eq!(a.bootstrap(OTHER, &cookie).await, StatusCode::UNAUTHORIZED);
    a.stop().await;
}

// tags: state-transition
#[tokio::test]
async fn forgetting_a_passkey_ends_its_sessions_and_it_cannot_sign_in_again() {
    let a = Away::start().await;
    a.on().await;
    let mut phone = a.enrolled().await;
    let (_, cookie) = a.sign_in(PHONE, &mut phone).await;
    let cookie = cookie.unwrap();
    let id = a.remote_state().await["passkeys"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let (status, _) = a
        .manage(FORGET_ROUTE, &json!({ "id": id }).to_string())
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(a.bootstrap(PHONE, &cookie).await, StatusCode::UNAUTHORIZED);
    assert_eq!(a.sign_in(PHONE, &mut phone).await.0, StatusCode::FORBIDDEN);
    let (status, _) = a
        .manage(FORGET_ROUTE, &json!({ "id": id }).to_string())
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(store::Store::load(a.bench.data()).passkeys.is_empty());
    a.stop().await;
}

// tags: condition, equivalence
#[tokio::test]
async fn a_signed_in_phone_runs_what_a_phone_at_home_runs_and_nothing_more() {
    let a = Away::start().await;
    a.on().await;
    let mut phone = a.enrolled().await;
    let (_, cookie) = a.sign_in(PHONE, &mut phone).await;
    let cookie = cookie.unwrap();
    for name in [
        "set_hf_token",
        "install_node_pack",
        "restart_engine",
        "agent_login",
    ] {
        let (status, _, text) = a
            .phone(PHONE, "POST", &format!("/api/{name}"), "{}", Some(&cookie))
            .await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{name}");
        assert_eq!(json_of(&text)["code"], "not_available_over_network");
    }
    let (status, _, _) = a
        .phone(PHONE, "POST", "/api/queue_snapshot", "", Some(&cookie))
        .await;
    assert_eq!(status, StatusCode::OK);
    a.stop().await;
}

// tags: boundary
#[tokio::test]
async fn asking_for_challenges_too_often_is_refused() {
    let a = Away::start().await;
    a.on().await;
    for i in 0..CEREMONIES_PER_WINDOW {
        let (status, _, _) = a.post(PHONE, SIGN_IN_BEGIN_ROUTE, json!({}), None).await;
        assert_eq!(status, StatusCode::OK, "{i}");
    }
    let (status, answer, _) = a.post(PHONE, SIGN_IN_BEGIN_ROUTE, json!({}), None).await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::TOO_MANY_REQUESTS, Some("rate_limited"))
    );
    // Another address has its own count.
    let (status, _, _) = a.post(OTHER, SIGN_IN_BEGIN_ROUTE, json!({}), None).await;
    assert_eq!(status, StatusCode::OK);
    a.stop().await;
}

// tags: condition
#[tokio::test]
async fn pairing_at_home_and_away_are_apart() {
    let a = Away::start().await;
    a.on().await;
    a.bench.open_lan().await;
    // A home-network code is no use on the remote listener.
    let home_code = a.bench.code().await;
    let (status, answer, _) = a
        .post(
            PHONE,
            pair::REQUEST_ROUTE,
            json!({ "code": home_code, "label": "x" }),
            None,
        )
        .await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::FORBIDDEN, Some("bad_code"))
    );
    // Closing the home network leaves a remote session alone.
    let mut phone = a.enrolled().await;
    let (_, cookie) = a.sign_in(PHONE, &mut phone).await;
    a.bench.server.close_lan().await;
    assert_eq!(a.bootstrap(PHONE, &cookie.unwrap()).await, StatusCode::OK);
    a.stop().await;
}
