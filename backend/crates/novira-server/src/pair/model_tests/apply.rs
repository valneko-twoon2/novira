//! Applying one operation to the store and the model, and comparing the results.
use super::model::*;
use super::ops::*;
use super::run::*;
use super::*;

impl Run {
    pub(super) fn apply(&mut self, op: &Op) -> Result<(), TestCaseError> {
        let now = self.at();
        match *op {
            Op::Advance(secs) => self.now += secs,
            Op::NewCode => {
                let code = self.p.new_code(now);
                prop_assert_eq!(code.len(), 32);
                prop_assert!(!self.codes.contains(&code), "a code repeated");
                self.m.prune(self.now);
                if self.m.codes.len() >= 4 {
                    self.m.codes.remove(0);
                }
                self.m.codes.push(MCode {
                    code: code.clone(),
                    expires: self.now + 120,
                });
                self.codes.push(code);
            }
            Op::Request { peer, code, label } => {
                let peer = peer_addr(peer);
                let code = self.code_arg(code);
                let got = self.p.request(now, peer, &code, &label_text(label));
                self.m.prune(self.now);
                let expected = if !self.m.allow(self.now, peer) {
                    Err(Refused::RateLimited)
                } else {
                    self.admitted.entry(peer).or_default().push(self.now);
                    match label_expected(label) {
                        None => Err(Refused::BadLabel),
                        Some(clean) => match self.m.codes.iter().position(|c| c.code == code) {
                            None => Err(Refused::BadCode),
                            Some(_) if self.m.requests.len() >= 8 => Err(Refused::Busy),
                            Some(at) => {
                                self.m.codes.remove(at);
                                Ok(clean)
                            }
                        },
                    }
                };
                match (got, expected) {
                    (Err(g), Err(e)) => prop_assert_eq!(g, e),
                    (Ok(ticket), Ok(clean)) => {
                        let (pending, _) = self.shown();
                        let last = pending.last().cloned().unwrap_or(Value::Null);
                        prop_assert_eq!(last["confirm"].as_str(), Some(ticket.confirm.as_str()));
                        let id = last["id"].as_str().unwrap_or_default().to_string();
                        self.polls.push((peer, ticket.poll.clone()));
                        self.m.requests.push(MRequest {
                            id,
                            poll: ticket.poll,
                            peer,
                            label: clean,
                            confirm: ticket.confirm,
                            created: self.now,
                            decision: Decided::Pending,
                        });
                    }
                    (g, e) => prop_assert!(false, "request: store {:?}, model {:?}", g, e),
                }
            }
            Op::Status { peer, poll } => {
                let peer = peer_addr(peer);
                let (_, poll) = match poll {
                    Which::Known(n) => pick(&self.polls, n).unwrap_or((peer, "1".repeat(64))),
                    Which::Garbage => (peer, "d".repeat(64)),
                };
                let got = self.p.status(now, peer, &poll);
                self.m.prune(self.now);
                let at = self
                    .m
                    .requests
                    .iter()
                    .position(|r| r.poll == poll && r.peer == peer);
                let Some(at) = at else {
                    prop_assert_eq!(got, Status::Unknown);
                    return self.finish();
                };
                match self.m.requests[at].decision {
                    Decided::Pending => prop_assert_eq!(got, Status::Pending),
                    Decided::Denied => {
                        self.m.requests.remove(at);
                        prop_assert_eq!(got, Status::Denied);
                    }
                    Decided::Approved => {
                        let request = self.m.requests.remove(at);
                        if self.m.sessions.len() >= 16 {
                            prop_assert_eq!(got, Status::Denied);
                        } else {
                            let Status::Approved(secret) = got else {
                                return Err(TestCaseError::fail(format!(
                                    "approved request gave {got:?}"
                                )));
                            };
                            prop_assert!(
                                self.approved.contains(&request.id),
                                "a session without an approval"
                            );
                            prop_assert!(
                                !self.denied.contains(&request.id),
                                "a denied request became a session"
                            );
                            self.m
                                .sessions
                                .retain(|s| !(s.peer == peer && s.label == request.label));
                            self.secrets.push((peer, secret.clone()));
                            self.m.sessions.push(MSession {
                                id: request.id,
                                secret,
                                peer,
                                label: request.label,
                                created: self.now,
                                last: self.now,
                                may_enrol: true,
                                passkey: None,
                            });
                        }
                    }
                }
            }
            Op::Approve { n, target } | Op::Deny { n, target } => {
                let approving = matches!(op, Op::Approve { .. });
                let id = self.request_id(n, target);
                let got = if approving {
                    self.p.approve(now, &id)
                } else {
                    self.p.deny(now, &id)
                };
                self.m.prune(self.now);
                let waiting = self
                    .m
                    .requests
                    .iter()
                    .position(|r| r.id == id && r.decision == Decided::Pending);
                let capped = approving && self.m.sessions.len() >= 16;
                prop_assert_eq!(got, waiting.is_some() && !capped);
                if let (Some(i), false) = (waiting, capped) {
                    if approving {
                        self.m.requests[i].decision = Decided::Approved;
                        self.approved.insert(id);
                    } else {
                        self.m.requests[i].decision = Decided::Denied;
                        self.denied.insert(id);
                    }
                }
            }
            Op::Grant {
                peer,
                passkey,
                label,
            } => {
                let peer = peer_addr(peer);
                let passkey = format!("key{passkey}");
                let name = label_text(label);
                let got = self.p.grant(now, peer, &name, &passkey);
                self.m.prune(self.now);
                self.m.sessions.retain(|s| {
                    !(s.peer == peer && s.passkey.as_deref() == Some(passkey.as_str()))
                });
                if self.m.sessions.len() >= 16 {
                    prop_assert_eq!(got, None);
                } else {
                    let Some(secret) = got else {
                        return Err(TestCaseError::fail(
                            "grant refused below the cap".to_string(),
                        ));
                    };
                    let (_, devices) = self.shown();
                    let id = devices
                        .last()
                        .and_then(|d| d["id"].as_str())
                        .unwrap_or_default()
                        .to_string();
                    self.granted.insert(id.clone());
                    self.secrets.push((peer, secret.clone()));
                    self.m.sessions.push(MSession {
                        id,
                        secret,
                        peer,
                        label: name,
                        created: self.now,
                        last: self.now,
                        may_enrol: false,
                        passkey: Some(passkey),
                    });
                }
            }
            Op::Session { peer, secret } | Op::Touch { peer, secret } => {
                let peer = peer_addr(peer);
                // A known secret is tried from its own address, or from the one named when the operation is `Session`.
                let (own, secret) = self.secret_arg(secret, peer);
                let touching = matches!(op, Op::Touch { .. });
                let from = if !touching && peer != own { peer } else { own };
                let got = if touching {
                    self.p.touch(now, from, &digest(&secret))
                } else {
                    self.p.session(now, from, &secret).is_some()
                };
                self.m.prune(self.now);
                let found = self
                    .m
                    .sessions
                    .iter_mut()
                    .find(|s| s.secret == secret && s.peer == from);
                prop_assert_eq!(got, found.is_some());
                if let Some(s) = found {
                    // Independent of the model's own pruning: a session passes only while it is young and in use.
                    prop_assert!(self.now - s.last < 1800, "an idle session passed");
                    prop_assert!(self.now - s.created < 14400, "an old session passed");
                    s.last = self.now;
                }
            }
            Op::Enrolling { peer, secret } | Op::Enrolled { peer, secret, .. } => {
                let peer = peer_addr(peer);
                let (own, secret) = self.secret_arg(secret, peer);
                let from = if self.now.is_multiple_of(2) {
                    own
                } else {
                    peer
                };
                let wanted = digest(&secret);
                if let Op::Enrolled { passkey, .. } = *op {
                    let passkey = format!("key{passkey}");
                    let got = self.p.enrolled(now, from, &wanted, &passkey);
                    self.m.prune(self.now);
                    let found = self
                        .m
                        .sessions
                        .iter_mut()
                        .find(|s| s.secret == secret && s.peer == from && s.may_enrol);
                    prop_assert_eq!(got, found.is_some());
                    if let Some(s) = found {
                        s.may_enrol = false;
                        s.passkey = Some(passkey);
                    }
                } else {
                    let got = self.p.enrolling(now, from, &wanted);
                    self.m.prune(self.now);
                    let found = self
                        .m
                        .sessions
                        .iter()
                        .find(|s| s.secret == secret && s.peer == from && s.may_enrol);
                    prop_assert_eq!(got, found.map(|s| s.label.clone()));
                }
            }
            Op::Revoke { n, bogus } => {
                // The ids come from the model: the store's own view would prune first.
                let ids: Vec<String> = self.m.sessions.iter().map(|s| s.id.clone()).collect();
                let id = match (bogus, pick(&ids, n)) {
                    (false, Some(id)) => id,
                    _ => "00000000deadbeef".to_string(),
                };
                let got = self.p.revoke(&id);
                let before = self.m.sessions.len();
                self.m.sessions.retain(|s| s.id != id);
                prop_assert_eq!(got, self.m.sessions.len() != before);
            }
            Op::RevokePasskey(k) => {
                let passkey = format!("key{k}");
                let got = self.p.revoke_passkey(&passkey);
                let before = self.m.sessions.len();
                self.m
                    .sessions
                    .retain(|s| s.passkey.as_deref() != Some(passkey.as_str()));
                prop_assert_eq!(got, self.m.sessions.len() != before);
            }
            Op::Reset => {
                self.p.reset();
                self.m.codes.clear();
                self.m.requests.clear();
                self.m.sessions.clear();
            }
            Op::Busy => {
                let got = self.p.busy(now);
                self.m.prune(self.now);
                let expected = !self.m.codes.is_empty()
                    || self
                        .m
                        .requests
                        .iter()
                        .any(|r| r.decision == Decided::Pending);
                prop_assert_eq!(got, expected);
            }
            Op::View => {
                self.shown();
            }
        }
        self.finish()
    }
}
