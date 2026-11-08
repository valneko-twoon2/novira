---
covers:
  - backend/crates/novira-server/src/remote.rs
  - backend/crates/novira-server/src/remote/**
  - frontend/src/app/RemotePanel.tsx
---
# 外出先のスマホ（リモートのリスナー）

一覧に戻る: [README.md](README.md)

ブラウザ用サーバー（[01-browser-server.md](../01-local/01-browser-server.md)）は、この PC の持ち主自身のスマホが外出先から使えるよう、Tailscale 経由の 3 つ目のリスナーを開ける。この PC の tailnet アドレスで、Tailscale が MagicDNS 名に作る証明書を使うので、スマホのブラウザは何もインストールせずに信頼する。スマホが入れるのは、1 度作った passkey があるときだけで、その作成は、家でスマホがペアリングするのと同じようにこの PC でペアリングした後に行う（[02-browser-server-pairing.md](02-browser-server-pairing.md)）。以後は tailnet のどこからでも、顔・指紋・コードでサインインする。デスクトップアプリは、家庭内ネットワークと同じようにこれを自分の中で動かす（[04-browser-server-app.md](04-browser-server-app.md)）。この PC の持ち主がオンにするまではオフ。

## 動作

- **オンとオフ。** `novira-server` とアプリは起動のたびに有効にする（`Server::enable_remote` / `Embedded::enable_remote`。データフォルダ上の `RemoteControl` と `tailnet_source` を付ける）。オンかどうか、passkey、ログは `<data>/remote.json` に保存する（`backend/crates/novira-server/src/remote/store.rs`: 一時名を経由して丸ごと書く。形の崩れたファイルや項目は捨てるので、壊れたファイルで入れるスマホは減ることはあっても増えることはない。passkey は最大 `MAX_PASSKEYS`、ログは最大 `MAX_LOG` 行）。オンの間は、起動時と 30 秒ごとの確認（`lan::watch` が呼ぶ `remote::maintain`）で開く。この確認は、Tailscale が止まったときやこの PC の tailnet アドレス・名前が変わったときに閉じ（次の確認でまた開く）、1 日 1 度 Tailscale に新しい証明書を求め（`CERT_REFRESH`。その場で差し替える。`CertSlot`）、オンにしてから `UNUSED_DAYS` 日のあいだ登録もサインインもなければオフにする。確認は同時に 1 つだけ動く。オフにすると閉じるが、passkey は残る。ポートは `server-remote-port` に保存する。
- **Tailscale**（`backend/crates/novira-server/src/remote/tailnet.rs`）。実行するのは `%ProgramFiles%\Tailscale\tailscale.exe` だけ（`PATH` 上のものは決して実行しない）。直接、ウィンドウなしで、固定の引数とタイムアウトを付ける。`tailscale status --json` は `Running` を示し、tailnet の IPv4 アドレス（`100.64.0.0/10`）と、`CertDomains` に含まれる MagicDNS 名（`host.tailnet.ts.net`。`is_tailnet_name` で検査）を返さなければならない。そうでなければ問題は `tailscale_missing`、`tailscale_stopped`、`https_disabled`（tailnet の管理コンソールで MagicDNS または HTTPS 証明書がオフ）のどれかになる。`tailscale cert` は証明書と鍵を `<data>/remote/` の下の新しいフォルダに書き、読み終えたらフォルダを消す。鍵はメモリ上にだけ保つ。
- **リスナー**は tailnet アドレスの専用ポートに bind する（`Listener::Remote`）。TLS 1.2 と 1.3、HTTP/1.1、受け付けループ、ヘッダータイムアウト、接続数の上限は家庭内ネットワークのものと同じ。開閉は一体で、ポート、接続とイベントソケット、セッション、コード、チャレンジがまとめて閉じる。
- **スマホの登録。** この PC のページが `POST /remote/code` に、`https://<name>:<port>/remote#<code>` の形のペアリングコードとその QR コードを求める（リモートのリスナー専用の `Pairing`。家庭内ネットワークのものとは別）。tailnet にいるスマホがそれを開く。ページ（`backend/crates/novira-server/src/remote/page.html`、`page.js`。文言は `strings.json` に ja と en）は、このリスナーの `/pair/request` と `/pair/status` でペアリングを求め、6 桁の番号を表示し、この PC が許可（`/remote/approve`）すると、passkey を 1 つ作れるセッションを持つ。ボタンを押すと（Safari はこれを求める）`POST /remote/enrol/begin`（`{challenge, rpId, userId, userName, timeout}`）を得て、`navigator.credentials.create`（ES256 のみ、discoverable credential、ユーザー検証必須、attestation なし）を呼び、結果を `POST /remote/enrol/finish`（`{id, clientDataJSON, authenticatorData, publicKey, algorithm}`。base64url）に送る。検査を通った passkey（`backend/crates/novira-server/src/remote/passkey.rs` の `check_new`）は、ペアリングの名前で保存する。セッションは続くが、もう作れない。検査を通らなければ断り、セッションは再試行できる。
- **サインイン。** セッションのないスマホが `/` を開くと `/remote` へ送られ（303）、サインインを促される。`POST /remote/sign-in/begin` が `{challenge, rpId, timeout}` を返し、`navigator.credentials.get`（ユーザー検証必須、credential は指定しない。スマホが自分の分を出す）を呼び、`POST /remote/sign-in/finish`（`{id, clientDataJSON, authenticatorData, signature}`）に送る。そのアドレスのチャレンジに答えた保存済みの passkey（`check_sign_in`）は、スマホの tailnet アドレスに結びついたセッションを与え（`Pairing::grant`。リクエストなしで 30 分、最大 4 時間。家庭内ネットワークと同じ）、ページがアプリを開く。最後の使用とカウンターを保存し、保存済み passkey の登録・サインイン・断られたサインインはすべて、時刻、名前、アドレスとともにログに残す。
- **passkey の検査**（`passkey.rs`）: クライアントデータの type、challenge（base64url、パディングなし）、origin `https://<name>:<port>`（`crossOrigin` も `topOrigin` もなし）。authenticator data の relying party ハッシュ（tailnet 名）、ユーザーの存在とユーザー検証。新しい passkey では、attested data の credential id と、P-256 SPKI であり attested COSE 鍵が持つものと同じ公開鍵。サインインでは、authenticator data とクライアントデータのハッシュに対する ECDSA 署名と、カウントしていた場合は進むカウンター（同期される passkey は 0 のまま）。チャレンジは 32 バイトのランダム値で、有効期間は `CHALLENGE_TTL`、1 回限り、作られたアドレスと目的（サインイン、または 1 つのセッションでの passkey 作成）に結びつく。アドレスが求められる回数は 1 分あたり `CEREMONIES_PER_WINDOW` まで。
- **この PC の画面**（`frontend/src/app/RemotePanel.tsx`）: サーバーがリモートのリスナーを持つとき、サイドバーの QR の項目（`HomeLinkButton.tsx`）には 2 つのタブがあり、家の Wi-Fi が先（項目を押すとこれが開くのは従来どおり）、次が外出先。外出先のタブには、スイッチ、開けない理由、tailnet 名、登録コードのボタン（残り時間つき）、求めてきたスマホ（名前、アドレス、番号、許可、断る）、サインイン中のスマホ（切断）、最後の使用つきの passkey（消すには 2 度押す）、新しいほうから 5 行のログがある。`/remote/state` を、家庭内ネットワークの状態と一緒に読む（`state/lan.ts`）。ブラウザモックには `?lan&remote`（`&remote=on`、`&remote=missing`。`mockLan.ts`）で疑似のものがある。管理ルートは `/remote/state`、`/remote/enable`、`/remote/disable`、`/remote/code`、`/remote/approve`、`/remote/deny`、`/remote/revoke`（セッション）、`/remote/forget`（passkey: 二度とサインインできず、そのセッションは終わる）。アプリではコマンド `remote_state` から `remote_forget` まで。

## 境界

| 境界 | 守り |
|---|---|
| 応答する相手 | リモートのリスナーが答えるのは、その範囲のローカルアドレスに届いた `100.64.0.0/10` の相手だけ（ループバックからのループバックも）。それ以外は、資格情報を見る前に 403。そのアドレスを持つのは Tailscale 自身のインターフェースだけなので、届くのは tailnet の端末だけ。そのうちどれが届いてよいかは tailnet の ACL が決め、その先は passkey が決める。 |
| `Host`、`Origin` | `Host` は、開いているリスナーの `<tailnet name>:<port>` そのもの。アドレスだけ、別の名前、別のポートは 403。`Origin` を送る場合は `https://` にその Host を付けたもの。サイトをまたぐナビゲーションで開けるのは `/remote` だけ（スキャンした QR コード）。 |
| 資格情報 | 端末が入れるのはセッションがあるときだけ。この PC の承認によるもの（passkey を 1 つ作れる）か、passkey のサインインによるもので、いずれも作られたアドレスから使う。起動トークンはここでは資格情報ではない。公開ルートは `GET /remote`、`GET /remote.js`、`POST /pair/request`、`/pair/status`、`/remote/sign-in/begin`、`/remote/sign-in/finish`。`/remote/enrol/*` に届くのは、まだ登録できるセッションだけ（403 `not_enrolling`）。 |
| passkey | relying party は tailnet 名、origin はこのリスナーのもの。ユーザー検証はどちらのときも必須。チャレンジは 1 回限りで、アドレスと目的に結びつく。断られたサインインは理由によらず同じ 403 `refused`。入れる者はストアの公開鍵が決め、passkey がストアに入るのは承認された登録を通ったときだけ。 |
| 管理 | `/remote/state` などが答えるのは、ペアリングのものと同じく、トークン付きのループバックの相手だけ（端末は 403）。画面は鍵の素材を受け取らない。 |
| 端末が実行できるもの | 家のスマホと同じ。`LOOPBACK_ONLY` は断る（[01-browser-server-lan.md](01-browser-server-lan.md)）。 |
| Tailscale | プログラムのパスは 1 つに固定し、固定の引数と、報告された名前（検査済み）を付けて直接実行し、タイムアウトを置く。証明書の鍵はディスクに残らない。 |
| 本体 | `application/json`、passkey のルートでは最大 4 KiB、フィールドは base64url。 |

テスト: `backend/crates/novira-server/src/remote/passkey/tests.rs`（本物の P-256 鍵を持つ疑似 authenticator: 新しい passkey とサインインの各拒否、カウンター）、`backend/crates/novira-server/src/remote/store.rs`（ファイル、壊れたファイル、上限、ログ、未使用日数）、`backend/crates/novira-server/src/remote/tailnet.rs`（範囲、名前、状態、PEM）、`backend/crates/novira-server/src/remote/tests.rs`（疑似 Tailscale を付けたルーター経由: オンとオフ、問題、応答する相手、1 度だけの登録、サインイン、拒否、アドレスへの結びつき、忘れること、`LOOPBACK_ONLY`、レート制限、家庭内ネットワークとの分離、未使用日数、毎日の証明書、名前に対する本物の TLS ハンドシェイク）、`backend/crates/novira-server/src/pair/tests.rs` の登録関数、`frontend/src/app/RemotePanel.test.tsx`、`frontend/src/backend/http/lan.test.ts` と `frontend/src/backend/tauri/lan.test.ts` のリモート呼び出し、`frontend/e2e/lan.spec.ts` の外出先タブ。

## 既知の限界

- 本物の Tailscale と本物のスマホに対しては、テストで確かめていない。疑似の `tailscale` と疑似の authenticator を使っている。管理者でない Windows アカウントで `tailscale cert` が動くかは、Tailscale 自身の規則による。
- 証明書はこの PC の MagicDNS 名を名指すので、その名前と tailnet の名前は公開の Certificate Transparency ログに載る。
- tailnet のアカウントを握る者は、リスナーに届く端末を追加できる。passkey が同期されるアカウント（iCloud、Google）を握る者は、その passkey を持つ。両方が揃って初めて入れる。ロックを解除したスマホが他人の手にあれば、そのコードでサインインされる。
- ES256 の passkey のみ。attestation は読まない（承認がスマホを保証する）。カウンターが 0 のものでは、コピーを見分けられない。
- セッションはメモリ上にあるので、再起動、リスナーを閉じること、tailnet アドレスの変化のどれでも、スマホはサインインし直す。tailnet アドレスが変わったスマホもサインインし直す。
- スマホのページの状態はオリジンごと。リモートのリスナーのオリジン（`https://<name>:<port>`）は、家庭内ネットワークのものとは別。
- ログは新しい `MAX_LOG` 行を保つ。未知の passkey の拒否は記録しない（記録する名前がない）。
