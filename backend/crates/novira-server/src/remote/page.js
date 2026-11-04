// The phone's side of the remote listener of novira-server (served as /remote.js; the strings are put in by the server
// from strings.json). With a pairing code in the address's fragment it sets the device up: it asks to pair, shows the
// confirmation number the PC also shows, waits for the PC's approval, then makes a passkey for this listener. Without a
// code it signs in with a passkey made before. Either way the server's session cookie then opens the app. A passkey is
// made and used only on a press, as Safari asks.
'use strict';
(function () {
  var STRINGS = __STRINGS__;
  var lang = (navigator.language || 'en').toLowerCase().indexOf('ja') === 0 ? 'ja' : 'en';
  var t = function (key) {
    return STRINGS[lang][key];
  };
  var $ = function (id) {
    return document.getElementById(id);
  };
  var say = function (key) {
    $('message').textContent = t(key);
  };
  var code = location.hash.slice(1);
  document.documentElement.lang = lang;
  $('title').textContent = t('title');
  $('label-text').textContent = t('deviceName');
  $('send').textContent = t('pair');
  $('make').textContent = t('make');
  $('sign-in').textContent = t('signIn');
  if (!window.PublicKeyCredential || !navigator.credentials) {
    say('unsupported');
    return;
  }
  if (/^[0-9a-f]{32}$/.test(code)) pairFirst();
  else signIn();

  function signIn() {
    say('signInIntro');
    var button = $('sign-in');
    button.hidden = false;
    button.addEventListener('click', function () {
      button.disabled = true;
      post('/remote/sign-in/begin', {})
        .then(function (reply) {
          if (!reply.ok) throw reply;
          return reply.json();
        })
        .then(function (o) {
          return navigator.credentials.get({
            publicKey: { challenge: bytes(o.challenge), rpId: o.rpId, timeout: o.timeout, userVerification: 'required', allowCredentials: [] },
          });
        })
        .then(function (credential) {
          var r = credential.response;
          return post('/remote/sign-in/finish', {
            id: b64(credential.rawId),
            clientDataJSON: b64(r.clientDataJSON),
            authenticatorData: b64(r.authenticatorData),
            signature: b64(r.signature),
          });
        })
        .then(function (reply) {
          if (!reply.ok) throw reply;
          say('signedIn');
          location.replace('/');
        })
        .catch(function (e) {
          say(problem(e, 'refused'));
          button.disabled = false;
        });
    });
  }

  function pairFirst() {
    say('intro');
    $('label').value = guessLabel();
    $('form').hidden = false;
    $('form').addEventListener('submit', function (event) {
      event.preventDefault();
      $('send').disabled = true;
      post('/pair/request', { code: code, label: $('label').value.trim() })
        .then(function (reply) {
          // A code that was used, or refused as wrong, is no use in another browser either.
          if (reply.ok || reply.status === 403) history.replaceState(null, '', '/remote');
          if (!reply.ok) {
            say(reply.status === 429 ? 'tooMany' : reply.status === 400 ? 'badLabel' : 'badCode');
            $('send').disabled = reply.status === 403;
            return;
          }
          return reply.json().then(function (ticket) {
            $('form').hidden = true;
            $('confirm').textContent = ticket.confirm.slice(0, 3) + ' ' + ticket.confirm.slice(3);
            $('confirm').hidden = false;
            say('waiting');
            wait(ticket.poll);
          });
        })
        .catch(function () {
          say('failed');
          $('send').disabled = false;
        });
    });
  }

  function wait(poll) {
    setTimeout(function () {
      post('/pair/status', { poll: poll })
        .then(function (reply) {
          if (reply.status === 404) {
            $('confirm').hidden = true;
            say('expired');
            return;
          }
          if (!reply.ok) return wait(poll);
          return reply.json().then(function (status) {
            if (status.state === 'approved') {
              $('confirm').hidden = true;
              offerPasskey();
            } else if (status.state === 'denied') {
              $('confirm').hidden = true;
              say('denied');
            } else {
              wait(poll);
            }
          });
        })
        .catch(function () {
          wait(poll);
        });
    }, 2000);
  }

  function offerPasskey() {
    say('makeIntro');
    var button = $('make');
    button.hidden = false;
    button.addEventListener('click', function () {
      button.disabled = true;
      post('/remote/enrol/begin', {})
        .then(function (reply) {
          if (!reply.ok) throw reply;
          return reply.json();
        })
        .then(function (o) {
          return navigator.credentials.create({
            publicKey: {
              challenge: bytes(o.challenge),
              rp: { id: o.rpId, name: 'novira' },
              user: { id: bytes(o.userId), name: o.userName, displayName: o.userName },
              pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
              authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
              attestation: 'none',
              timeout: o.timeout,
            },
          });
        })
        .then(function (credential) {
          var r = credential.response;
          var key = r.getPublicKey && r.getPublicKey();
          if (!key || !r.getAuthenticatorData) throw new Error('unsupported');
          return post('/remote/enrol/finish', {
            id: b64(credential.rawId),
            clientDataJSON: b64(r.clientDataJSON),
            authenticatorData: b64(r.getAuthenticatorData()),
            publicKey: b64(key),
            algorithm: r.getPublicKeyAlgorithm(),
          });
        })
        .then(function (reply) {
          if (!reply.ok) throw reply;
          button.hidden = true;
          say('enrolled');
          location.replace('/');
        })
        .catch(function (e) {
          say(e && e.message === 'unsupported' ? 'unsupported' : problem(e, 'notMade'));
          button.disabled = false;
        });
    });
  }

  // What went wrong, as a string key: a cancelled prompt, too many tries, the PC out of reach, else `fallback`.
  function problem(e, fallback) {
    if (e && e.name === 'NotAllowedError') return 'cancelled';
    if (e && e.status === 429) return 'tooMany';
    if (e instanceof TypeError) return 'failed';
    return fallback;
  }

  function post(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  }

  function b64(buffer) {
    var bytes = new Uint8Array(buffer);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function bytes(text) {
    var s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function guessLabel() {
    var ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    return t('defaultName');
  }
})();
