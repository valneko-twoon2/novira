---
covers:
  - backend/crates/novira-server/src/pair.rs
  - backend/crates/novira-server/src/pair/**
  - backend/crates/novira-server/src/lan_tests.rs
  - backend/crates/novira-server/src/lan/**
  - frontend/src/app/NetworkButton.tsx
  - frontend/src/app/LanPanel.tsx
  - frontend/src/app/LanApprovals.tsx
  - frontend/src/state/lan.ts
  - frontend/src/backend/http/lan.ts
  - frontend/src/backend/mock/mockLan.ts
---
# スマホとブラウザ用サーバーのペアリング

一覧に戻る: [README.md](README.md)

家庭内ネットワーク（[01-browser-server-lan.md](01-browser-server-lan.md)）の端末が入れるのは、この PC が承認したセッションを持つときだけ。ペアリングはサーバーの起動ごとに 1 度（またはセッションが終わった後）。この PC に表示したコードをスマホが読み取り、この PC が許可すると、スマホのブラウザがそのアドレスに結びついたセッション Cookie を持つ。起動トークンはこの PC から出ない。

## 動作

- **コード。** この PC のページ（ループバック、トークン付き）が `POST /pair/code`（`backend/crates/novira-server/src/pair.rs` の `CODE_ROUTE`）に `{url, size, modules, expiresIn}` を求める。128 ビットのランダムなペアリングコードで、有効なのは 2 分間とリクエスト 1 回。アドレスは `https://<home address>:<port>/pair#<code>`、その QR モジュールも返す。コードはフラグメントにあり、ブラウザはこれを送らない。同時に有効なコードは最大 4 つで、新しいものが古いものを押し出す。サイドバーのネットワークの項目（下記）は、開くたびと、切れたときに新しいコードを求める。リスナーが閉じている間は 404 `no_home_network`。
- **スマホのページ。** `GET /pair` と `GET /pair.js` は、アプリとは別の小さな静的ページ（`backend/crates/novira-server/src/pair/page.html`、`page.js`）で、ペアリングまでアプリのものは何も表示しない。スクリプトはフラグメントからコードを読み、リクエストを送るまではアドレスに残す（QR リーダー自身のビューから別のブラウザへページを渡せるようにするため）。サーバーがコードを受け取った、または誤り・使用済みとして断った時点で、アドレスバーと履歴から消す（名前が断られたときは、再試行のために残す）。端末の名前の候補（ブラウザから推測: iPhone、iPad、Android）、`/ca.crt` へのリンク、折りたたんだ「証明書をインストールする」ボックスを出す。ボックスには、使っているスマホの分だけ手順が入る。iPhone は、プロファイルをダウンロードし、インストールし、設定 > 一般 > 情報 > 証明書信頼設定。Android Chrome は、設定 > セキュリティ > 証明書のインストール > CA 証明書。文言は `backend/crates/novira-server/src/pair/strings.json` に日本語と英語であり、ブラウザの言語で選ぶ。このページは、i18n カタログの外に画面の文言がある唯一の場所（フロントエンドではなくサーバーが配信するため）。テストが、2 言語のキーが等しいこと、すべてのキーが使われていること、"novira" が小文字であることを保つ。
- **リクエスト。** スマホが `{code, label}` を `POST /pair/request` に送る。有効なコードは使い切りになり、6 桁の確認番号とポーリング用の秘密（256 ビット）を持つ待機中のリクエストを作る。スマホはそれを受け取って番号を表示する。待機中のリクエストの寿命は 5 分。
- **判断。** この PC は `GET /pair/state`（`{open, codes, pending: [{id, label, peer, confirm, waitingSecs}], devices: [{id, label, peer, pairedSecs, idleSecs}]}`。秘密は含まない）を読み、`POST /pair/approve` か `POST /pair/deny` に `{id}` を付けて答える。この PC の画面（下記）がこれらを使う。
- **セッション。** スマホは 2 秒ごとに `{poll}` を付けて `POST /pair/status` をポーリングする。応答は `pending`、`denied`、または Cookie `novira_session_<port>` つきの `approved`（`HttpOnly`、`SameSite=Strict`、`Secure`、`Max-Age` 4 時間。秘密は 256 ビットのランダム値で、1 度だけ渡す）で、その後ページが `/` を開く。セッションが使えるのは作られたアドレスからだけで、リクエストなしで 30 分、またはペアリングから 4 時間で終わる。また、この PC が `{id}` 付きで `POST /pair/revoke` を送ったとき、リスナーが閉じたとき（この PC が閉じた、アイドル上限、ネットワークの変化: [01-browser-server-lan.md](01-browser-server-lan.md)）、サーバーが止まったときにも終わる。端末の開いているイベントソケットは使用に数え、リスナーがアイドルで閉じるのを防ぐ。1 分ごとと、取り消し時にはすぐに検査され、セッションとともに終わる。
- セッションなしで `/` を開いた端末は `/pair` へ送る（303）。
- リモートのリスナー（[03-browser-server-remote.md](03-browser-server-remote.md)）は、スマホの登録用に専用の `Pairing` を持ち、コード、リクエスト、セッションは同じ。そこでの承認で作られたセッションは passkey を 1 つ作れるが（`Pairing::enrolling`、`Pairing::enrolled`）、passkey のサインインで作られたセッション（`Pairing::grant`）は作れない。passkey を忘れると、そのセッションが終わる（`Pairing::revoke_passkey`）。サーバーがリモートのリスナーを持つとき、ネットワークの項目はメニューを開き、「自宅」が家庭内ネットワーク、「外出先」がリモートのリスナーで、選んだものが別々のダイアログで開く。

### この PC の画面

サイドバーのネットワークの項目（`NetworkButton.tsx`、`LanPanel.tsx`）があるのは、ページが状態を読めるときだけ（`state/lan.ts`）。つまり、自分の PC 上の `novira-server` のページ（`GET /lan/state`）と、デスクトップアプリ（`lan_state` コマンド、[01-browser-server-lan.md](01-browser-server-lan.md)）。スマホ（`/lan/*` は 403）と、`?lan` なしのブラウザモックは状態を得られず、項目も出ない。スマホのレイアウトは項目をマウントしない。項目を押すことが開く要求になる。家庭内ネットワークが閉じているときに「自宅」のダイアログが現れると開き、まだ信頼していないネットワーク（`409 untrusted_network`）では、先にゲートウェイを信頼する（`/lan/trust`、既定の名前で）。確認はしない。項目を押すのが持ち主の選択だからである。ダイアログには、残り時間つきのペアリングコード（切れたら**新しいコード**）と、Windows の「パブリック」警告が出る。家庭内アドレスやゲートウェイがなければ理由を表示し、操作に失敗した後は開くボタンを表示する。開いているときは、接続を求めているスマホ（名前、アドレス、番号、**許可**と**断る**）と、ペアリング済みのスマホ（切断ボタン）を一覧する。状態はダイアログが開いている間は 2 秒ごと、家庭内ネットワークが開いている間は 4 秒ごとに読む。閉じていて表示もしていないときは読まない。

ポップオーバーが閉じている間にスマホが求めてきたときは、このページにだけ確認を出す（`LanApprovals.tsx`）。名前、アドレス、番号、**許可**と**断る**を持つトーストで、答えるか、リクエストがなくなるまで残る。ダイアログを開くと、リクエストはそちらに引き継がれる。ブラウザモックには、試験用の疑似の家庭内ネットワークがある（`?lan`、`?lan=open`、`?lan=public`。`mockLan.ts`）。

## 境界

| 境界 | 守り |
|---|---|
| 資格情報 | ループバック以外の相手が入れるのは、自分のアドレスからの有効なセッションがあるときだけ。起動トークン（ヘッダー、Cookie、アドレス）はここでは資格情報ではない。コード、ポーリング用の秘密、セッションの秘密は SHA-256 ダイジェストだけをメモリに保つ。秘密はシステムの生成器（ring）から作る。 |
| 公開ルート | TLS リスナーのみ: `GET /ca.crt`、`GET /pair`、`GET /pair.js`、`POST /pair/request`、`POST /pair/status`（`is_public`）。ほかのルートと同じ `Host`、`Origin`、`Sec-Fetch-Site` の検査を通るが、`GET /pair` だけは別のサイトからのトップレベルのナビゲーション（`Sec-Fetch-Mode: navigate`）で開いてよい。スキャンした QR コードはこの形で届く。ループバックのリスナーではトークンが要り、2 つの呼び出しは 404 で答える。 |
| 管理 | `/pair/code`、`/pair/state`、`/pair/approve`、`/pair/deny`、`/pair/revoke`（`is_management`）が答えるのは、トークン付きのループバックの相手だけ。端末は、セッションがあってもトークンがあっても 403 になるので、自分を承認することも、ほかの端末を一覧することもできない。 |
| リクエストの本体 | `application/json` のみ（違えば 415）、最大 1 KiB（超えれば 413）、文字列フィールドの JSON オブジェクト（違えば 400）。端末名は 1 〜 40 文字で、制御文字・方向文字を含まない（違えば 400 `bad_label`）。断られたリクエストはコードを使い切らない。 |
| 推測と大量送信 | コードは 128 ビットでリクエスト 1 回だけ有効。誤り・使用済み・期限切れは 403 `bad_code`。ペアリングのリクエストはアドレスごとに 1 分あたり 5 回まで（429 `rate_limited`）、追跡するアドレスは最大 256、待機中のリクエストは最大 8（503 `busy`）、ペアリング済みの端末は最大 16。 |
| 結果を知る者 | 尋ねたアドレスからのポーリング用の秘密だけ。それ以外は 404 `unknown`。判断は確定で、セッションの秘密は 1 度しか渡さない。 |

テスト: `backend/crates/novira-server/src/pair/tests.rs`（手動で進める時計でのストア: 使い切り、コード・リクエスト・セッションの期限、アイドルと絶対の上限、アドレスへの結びつき、レート制限、上限、名前、取り消し、文言）、`backend/crates/novira-server/src/lan_tests.rs`（別のアドレスの端末としてルーター経由でプロセス内に流すリクエスト: トークンの拒否、リダイレクト、公開と管理のルート、悪意ある本体とヘッダー、レート制限、別のアドレスでの結果、取り消しと閉鎖、取り消しで終わるイベントソケット）、`backend/crates/novira-server/tests/lan_tls.rs`（TLS 上のやり取り全体、`Secure` Cookie）、`frontend/src/backend/http/lan.test.ts`、`frontend/src/backend/mock/mockLan.test.ts`、`frontend/src/state/lan.test.ts`、`frontend/src/app/NetworkButton.test.tsx`、`frontend/src/app/RemotePanel.test.tsx`、`frontend/src/app/LanApprovals.test.tsx`、`frontend/e2e/lan.spec.ts`（モックに対する項目: 1 度の信頼、コード、ダイアログとプロンプトでのスマホの要求、自宅と外出先の選び方、スマホ大のウィンドウでは出ないこと）。

## 既知の限界

- 確認番号が守りになるのは、人が見比べたときだけ。待っているものを何でも承認すると、先にコードを読み取った者にセッションを与えてしまう。
- 使われるまで、コードはアドレスと、それを開いたブラウザの履歴に残る。それでも有効なのは 2 分間でリクエスト 1 回だけ。
- 2 分の間に QR コードを見た者（画面の写真など）は、スマホより先にそれを使える。その場合、待機中のリクエストには、この PC が予期しない名前とアドレスが出る。
- セッションは端末ではなくアドレスに結びつく。そのアドレスを引き継いだ別の端末は（Cookie があれば）入れる。アドレスが変わったスマホはペアリングし直す。
- セッションはメモリ上にあるので、再起動やリスナーを閉じることで、すべてのスマホがペアリングし直しになる。
