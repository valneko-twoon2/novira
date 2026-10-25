// The phone's side of pairing with novira-server (served as /pair.js; the strings are put in by the server from
// strings.json). The code comes in the address's fragment, which a browser never sends; it is dropped from the address
// bar and the history at once. The phone asks to pair, shows the confirmation number the PC also shows, and waits
// until the PC allows or refuses; then the server's session cookie opens the app.
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
  var code = location.hash.slice(1);
  history.replaceState(null, '', '/pair');
  document.documentElement.lang = lang;
  $('title').textContent = t('title');
  $('ca').textContent = t('installCa');
  $('ca-title').textContent = t('caTitle');
  $('ca-why').textContent = t('caWhy');
  $('ca-ios').textContent = t('caIos');
  $('ca-android').textContent = t('caAndroid');
  var ua = navigator.userAgent;
  // The steps of the other kind of phone are not shown.
  if (/iPhone|iPad/.test(ua)) $('ca-android').hidden = true;
  else if (/Android/.test(ua)) $('ca-ios').hidden = true;
  $('label-text').textContent = t('deviceName');
  $('send').textContent = t('pair');
  var say = function (key) {
    $('message').textContent = t(key);
  };
  if (!/^[0-9a-f]{32}$/.test(code)) {
    say('noCode');
    return;
  }
  say('intro');
  $('label').value = guessLabel();
  $('form').hidden = false;
  $('form').addEventListener('submit', function (event) {
    event.preventDefault();
    $('send').disabled = true;
    post('/pair/request', { code: code, label: $('label').value.trim() })
      .then(function (reply) {
        if (!reply.ok) {
          say(reply.status === 429 ? 'tooMany' : reply.status === 400 ? 'badLabel' : 'badCode');
          // A used or wrong code stays wrong; a name or a pause can be fixed here.
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
              say('approved');
              location.replace('/');
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

  function post(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  }

  function guessLabel() {
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    return t('defaultName');
  }
})();
