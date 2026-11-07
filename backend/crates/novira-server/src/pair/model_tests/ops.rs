//! The operations of the model test, their generators, and the device names they use.
use super::*;
use std::net::Ipv4Addr;

pub(super) const PEERS: u8 = 3;

pub(super) fn peer_addr(k: u8) -> IpAddr {
    IpAddr::V4(Ipv4Addr::new(192, 168, 1, 10 + k))
}

/// Device names and what a store must make of them (written out, not computed with `clean_label`).
pub(super) const LABELS: &[(&str, Option<&str>)] = &[
    ("phone", Some("phone")),
    ("tablet", Some("tablet")),
    ("  padded  ", Some("padded")),
    ("", None),
    ("   ", None),
    ("a\nb", None),
    ("\u{202e}x", None),
    ("日本語の端末", Some("日本語の端末")),
];

pub(super) fn label_text(i: u8) -> String {
    match i as usize % (LABELS.len() + 2) {
        n if n < LABELS.len() => LABELS[n].0.to_string(),
        n if n == LABELS.len() => "x".repeat(40),
        _ => "x".repeat(41),
    }
}

pub(super) fn label_expected(i: u8) -> Option<String> {
    match i as usize % (LABELS.len() + 2) {
        n if n < LABELS.len() => LABELS[n].1.map(str::to_string),
        n if n == LABELS.len() => Some("x".repeat(40)),
        _ => None,
    }
}

#[derive(Clone, Copy, Debug)]
pub(super) enum Which {
    /// The n-th one ever made (modulo how many there are; live, used, expired or dead alike).
    Known(u8),
    /// A value nobody was given.
    Garbage,
}

#[derive(Clone, Copy, Debug)]
pub(super) enum Target {
    Waiting,
    Decided,
    Bogus,
}

#[derive(Clone, Debug)]
pub(super) enum Op {
    Advance(u64),
    NewCode,
    Request {
        peer: u8,
        code: Which,
        label: u8,
    },
    Status {
        peer: u8,
        poll: Which,
    },
    /// The n-th waiting request, the n-th already decided one, or a made-up id.
    Approve {
        n: u8,
        target: Target,
    },
    Deny {
        n: u8,
        target: Target,
    },
    Grant {
        peer: u8,
        passkey: u8,
        label: u8,
    },
    Session {
        peer: u8,
        secret: Which,
    },
    Touch {
        peer: u8,
        secret: Which,
    },
    Enrolling {
        peer: u8,
        secret: Which,
    },
    Enrolled {
        peer: u8,
        secret: Which,
        passkey: u8,
    },
    Revoke {
        n: u8,
        bogus: bool,
    },
    RevokePasskey(u8),
    Reset,
    Busy,
    View,
}

pub(super) fn which() -> impl Strategy<Value = Which> {
    prop_oneof![5 => any::<u8>().prop_map(Which::Known), 1 => Just(Which::Garbage)]
}

pub(super) fn target() -> impl Strategy<Value = Target> {
    prop_oneof![4 => Just(Target::Waiting), 2 => Just(Target::Decided), 1 => Just(Target::Bogus)]
}

pub(super) fn op() -> impl Strategy<Value = Op> {
    let peer = 0..PEERS;
    // The edges of the 120 s code life, 60 s rate window, 300 s request life, 30 min idle and 4 h session limits.
    let secs = prop::sample::select(vec![
        0u64, 0, 1, 5, 59, 60, 61, 119, 120, 121, 299, 300, 301, 1799, 1800, 1801, 14399, 14400,
        14401,
    ]);
    prop_oneof![
        4 => secs.prop_map(Op::Advance),
        3 => Just(Op::NewCode),
        8 => (peer.clone(), which(), any::<u8>()).prop_map(|(peer, code, label)| Op::Request { peer, code, label }),
        6 => (peer.clone(), which()).prop_map(|(peer, poll)| Op::Status { peer, poll }),
        4 => (any::<u8>(), target()).prop_map(|(n, target)| Op::Approve { n, target }),
        2 => (any::<u8>(), target()).prop_map(|(n, target)| Op::Deny { n, target }),
        2 => (peer.clone(), 0u8..2, any::<u8>()).prop_map(|(peer, passkey, label)| Op::Grant { peer, passkey, label }),
        4 => (peer.clone(), which()).prop_map(|(peer, secret)| Op::Session { peer, secret }),
        2 => (peer.clone(), which()).prop_map(|(peer, secret)| Op::Touch { peer, secret }),
        2 => (peer.clone(), which()).prop_map(|(peer, secret)| Op::Enrolling { peer, secret }),
        2 => (peer, which(), 0u8..2).prop_map(|(peer, secret, passkey)| Op::Enrolled { peer, secret, passkey }),
        2 => (any::<u8>(), any::<bool>()).prop_map(|(n, bogus)| Op::Revoke { n, bogus }),
        1 => (0u8..2).prop_map(Op::RevokePasskey),
        1 => Just(Op::Reset),
        1 => Just(Op::Busy),
        1 => Just(Op::View),
    ]
}
