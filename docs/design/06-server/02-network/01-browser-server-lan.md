---
covers:
  - backend/crates/novira-server/src/home_network.rs
  - backend/crates/novira-server/src/tls.rs
  - backend/crates/novira-server/src/lan.rs
  - backend/crates/novira-server/src/lan/**
  - backend/crates/novira-server/src/trusted.rs
  - backend/crates/novira-server/src/main.rs
  - scripts/server.bat
  - scripts/release/package.bat
---
# 家庭内ネットワークのブラウザ用サーバー

ブラウザ用サーバー（[01-browser-server.md](../01-local/01-browser-server.md)）は、家庭内ネットワークの端末向けに 2 つ目のリスナーも開ける。同じ Wi-Fi のスマホが、ブラウザで novira を使える。このリスナーは TLS のみで、証明書はこの PC で作った CA が出す。開くのはこの PC の持ち主が信頼したネットワークだけで、使われなくなれば閉じ、端末が入れるのはこの PC がペアリングを承認した後だけ（[02-browser-server-pairing.md](02-browser-server-pairing.md)）。この PC のページが開くまでは何も待ち受けず、サーバーはこの PC の中にとどまる。デスクトップアプリは同じサーバーを、このリスナーだけ付けて自分の中で動かす（[04-browser-server-app.md](04-browser-server-app.md)）ので、スマホはアプリとも同じ手順でペアリングする。

## 動作

- `novira-server`（毎回の起動。オプションなし）は、ループバックのリスナー（`127.0.0.1` の平文 HTTP）をそのままにして、家庭内ネットワークのリスナーを使える状態にする（`backend/crates/novira-server/src/lan.rs` の `Control` を付けた `Server::enable_lan`）。起動時には決して開かない。開くのはこの PC のページの QR の項目（下記）。リスナー（`backend/crates/novira-server/src/lib.rs` の `Server::open_lan`）が bind するのはこの PC の家庭内アドレスだけで、専用のポートを使う（前回のポートをデータフォルダの `server-lan-port` に保存し、なければ空きポート）。開閉は一体で、閉じるとポートが空き、接続とイベントソケットが終わり、すべてのセッションとペアリングコードが無効になる。
- 家庭内アドレスは、ローカルネットワークの外のアドレスに対してルーティングテーブルが選ぶもの。UDP ソケットを `192.0.2.1`（ドキュメント用のブロック）に connect するだけで、何も送らない（`backend/crates/novira-server/src/home_network.rs` の `home_address`）。このアドレスが家庭用ルーターの割り当てるものでなければ、この PC だけがページを開けるという表示になる。
- TLS（`backend/crates/novira-server/src/tls.rs`）: ring プロバイダーの rustls、TLS 1.2 と 1.3、HTTP/1.1 のみ。「novira local CA」（ECDSA P-256、10 年、パス長 0、keyCertSign と cRLSign）はデータフォルダごとに 1 度作る。その鍵と証明書は DPAPI の秘密（`Secret::LanCa`、`novira-data/secrets/lan-ca.key`）で、証明書はデータフォルダの `lan/ca.pem` にも書く。名前制約が許すのは IP サブネット `10/8`、`172.16/12`、`192.168/16`、`100.64/10` だけで、DNS 名はすべて除外する。開くたびに、現在のアドレス向けの新しいリーフ（90 日、serverAuth、名前は家庭内アドレスだけ、common name なし）を署名するので、アドレスが変わっても新しい CA は要らない。秘密が読めなければ新しい CA を作り、スマホは入れ直す。
- **信頼したネットワーク**（`backend/crates/novira-server/src/trusted.rs`）。ネットワークは、家庭内アドレスを持つインターフェースのゲートウェイのハードウェアアドレス（MAC）で見分ける。デフォルトルートのネクストホップ（`GetIpForwardTable`）を、ネイバーテーブルから探すか ARP で尋ねる（`home_network.rs` の `gateway_mac`）。持ち主が確認したネットワークは `<data>/lan-trusted.json` に `[{gatewayMac, label, addedAt}]` として保存する（一時名を経由して丸ごと書く。読めないファイルは何も信頼せず、形の崩れた項目は捨てる。最大 32 件）。リスナーは、ゲートウェイが分からないアドレス（Windows 以外、デフォルトルートなし、応答なし）でも、一覧にないゲートウェイでも開かない。Windows がネットワークを「パブリック」とみなしていることは、状態のフラグにすぎない。
- **必要なときに開く**（`/lan/*`。この PC のページ専用。`Control` が設定されていないと 404 `no_lan_control` で答える。`novira-server` は CA が作れなかった場合を除き、必ず設定する）。`GET /lan/state` は `{open, address, port, network: {gatewayMac, trusted, label}, windowsPublic, idleSecs, idleLimitSecs, codes, devices, pending, trustedNetworks}` で答える（`address` は開いているリスナーのもの、閉じていれば開くとしたらそのアドレス。秘密は含まない）。`POST /lan/trust` に `{gatewayMac, label}` を渡すと、この PC が今いるネットワークを信頼する。これは持ち主が `gatewayMac` として見たものを指す（その間に別のネットワークになっていれば 409 `network_changed`。ほかに 409 `unknown_network`、`no_home_network`）。`POST /lan/untrust` に `{gatewayMac}` を渡すと 1 件を外し、そのネットワークで開いていればすぐ閉じる。`POST /lan/open` は信頼したネットワークで開く（409 `untrusted_network` は確認すべきゲートウェイつき。ほかに `unknown_network`、`no_home_network`。開いているリスナーはそのまま）。`POST /lan/close` は閉じる。
- **自動で閉じる**（`lan.rs` の `maintain`。30 秒ごと）: ペアリング済みの端末から 30 分間リクエストがなく（その端末の開いているイベントソケットは使用に数える）、まだ使えるペアリングコードも承認待ちのリクエストもないとき。家庭内アドレスがなくなった・変わったとき、またはゲートウェイが分かっていて信頼されなくなったときは、すぐに閉じる。ゲートウェイが一時的に分からなくても閉じない。ペアリングしていない相手からのリクエストは使用に数えない。
- `GET /ca.crt`（`CA_ROUTE`）は CA の証明書（PEM、`application/x-x509-ca-cert`）を、リスナーが答える相手なら誰にでもトークンなしで返す。スマホはリスナーを信頼する前にこれを取得する。
- コンソールに出るのはいつもの `novira-server: http://127.0.0.1:<port>/?token=<token>` の 1 行だけ。この PC のサイドバーの QR の項目がリスナーを開き、今いるネットワークを信頼し（項目を押すのは持ち主の選択）、新しいペアリングコードと、スマホが表示するものと見比べるための CA の SHA-256 フィンガープリントを表示する（02-browser-server-pairing.md）。
- ペアリングが済んだスマホのページは、同じアプリで、保存された画面の状態も同じ（01-settings-engine.md）。レイアウトはスマホ向けのもの（[02-phone-layout.md](../../01-app/02-screens/02-phone-layout.md)）。フロントエンドは、`https:` のページでは `/events` に `wss:` を選ぶ。

## 境界

| 境界 | 守り |
|---|---|
| 応答する相手 | ループバックのリスナーが答えるのはループバックだけで、平文の HTTP リスナーはほかの端末には決して答えない。家庭内ネットワークのリスナーが相手に答えるのは、接続が入ってきたアドレスが家庭用ルーターの割り当てるもの（プライベートの `10/8`、`172.16/12`、`192.168/16`、または共有の `100.64/10`）であり、かつ相手がそのアドレスのサブネットにいるときだけ。マスクはシステムのアドレステーブル（`GetIpAddrTable`）から接続ごとに 1 度読む。1 が連続していないマスク、`/8` より広いマスク、単一アドレスのマスクは誰にも答えない。Windows 以外ではマスクを読まないので、ほかの端末には答えない。それ以外は、資格情報を見る前に 403。 |
| 通信路 | 家庭内ネットワークのリスナーは TLS のみ。接続はヘッダータイムアウト内にハンドシェイクを終えなければならず、平文の HTTP や無言のソケットは応答なしで切る。専用の `MAX_CONNECTIONS` があるので、ネットワークからの大量接続でこの PC 自身のページが使えなくなることはない。 |
| 証明書 | CA の名前制約により、名前制約を守るクライアントでは、CA の鍵のコピーがあっても DNS 名や公開アドレスを証明できない（`tls.rs` のテストが rustls-webpki で、家庭内アドレスのリーフは検証に通り、`example.com`、単一ラベル、ワイルドカード、`8.8.8.8` のリーフは通らないことを確かめる）。鍵は DPAPI の秘密から出ない。`/ca.crt` と `lan/ca.pem` にあるのは公開証明書だけ。 |
| `Host`、`Origin` | `Host` は、接続が入ってきたアドレスとポートそのもの（`127.0.0.1:<port>`/`localhost:<port>` はループバックのみ）。この PC を指す DNS 名、別のポート、アドレスだけの `Host` は 403。`Origin` を送る場合は、TLS リスナーでは `https://<その Host>`、ループバックでは `http://` でなければならない。 |
| ページの内容 | `connect-src` は `'self'` に加えて、TLS リスナーでは `wss://<検査済みの Host>`（ループバックでは `ws://`）を挙げる。 |
| 資格情報 | 端末（ループバック以外の相手）が入れるのは、この PC が承認したセッションを、ペアリングしたアドレスから使うときだけ。起動トークンはここでは資格情報ではなく、この PC の外に出ない（02-browser-server-pairing.md）。セッションなしで通るルートは `/ca.crt` とペアリングのページおよびその呼び出しだけ。TLS リスナーが設定する Cookie は `Secure`。 |
| 端末が実行できるもの | 家庭内ネットワークの端末（ループバック以外のすべての相手）は、`LOOPBACK_ONLY` のコマンド（`backend/crates/novira-server/src/lib.rs`）を断られる。ソフトウェアのインストールと実行（モデル、パック、ComfyUI バージョンの変更、エンジンの再起動）、エンジンとモデルフォルダの設定、API キー、アシスタントの設定（サインイン、サーバーのアドレス）が対象。使えるのは、生成、キュー、ギャラリー、ボード、ワークフロー、画面の状態、読み取り、そしてこの PC で設定済みのアシスタントとの会話（`agent_chat` とそのツール応答、キャンセル、事実の調べ物）。アシスタントの `claude`/`codex` はそれ自身のツールをオフにして動き、アプリのツールを通してのみ作用し、そのどれもインストールも削除もしない（01-assistant.md）。拒否は 403 `not_available_over_network`。この PC 自身のループバックのページは完全なアクセスを保つ。 |
| どのネットワークか | リスナーが開くのは、家庭内アドレスのインターフェースのゲートウェイが信頼済みのときだけ（`trusted.rs`、`lan.rs`）。未知のゲートウェイや Windows 以外では決して開かず、ネットワークが変わるか信頼されなくなれば閉じる。`/lan/trust` は持ち主に見せたゲートウェイを指名し、ネットワークが移っていれば断る。`/lan/*` はトークン付きのループバックだけ（端末にはセッションがあってもなくても 403）。 |

テスト: `backend/crates/novira-server/src/home_network.rs`（範囲、サブネット、マスク、ループバックでのシステムテーブル、ゲートウェイ）、`backend/crates/novira-server/src/trusted.rs`（ファイル、壊れたファイル、上限）、`backend/crates/novira-server/src/lan/tests.rs`（信頼されていない・未知・存在しないネットワーク、悪意ある本体での信頼、端末に断るルート、閉じる処理、アイドルでの閉鎖、ネットワークの変化）、`backend/crates/novira-server/src/tls.rs`（名前制約、データフォルダごとに保つ CA）、`backend/crates/novira-server/src/lan_tests.rs`（端末のリクエストをプロセス内でルーター経由で流す。サブネット、平文リスナー）、`backend/crates/novira-server/tests/lan_tls.rs`（ループバック上の rustls クライアントが家庭内アドレスの証明書を検査する。ハンドシェイク、ほかの名前や CA、TLS ポートへの平文 HTTP、`/ca.crt`、オリジンと Cookie、開閉）、`backend/crates/novira-server/tests/home_network_live.rs`（実際の家庭内アドレス。ネットワークで待ち受けるため、テストを新しくビルドするたびに Windows がファイアウォールについて尋ねる。そのため `cargo test -p novira-server --test home_network_live -- --ignored` で実行する）。

## 既知の限界

- スマホが CA をインストールするまでは証明書の警告が出る。その間に（共有 Wi-Fi で）なりすまして答える者がいても検出できない。2 つの画面で CA のフィンガープリントを突き合わせる仕組みは今はなく、信頼できない Wi-Fi で証明書をインストールするスマホは、それが正しいものか判別できない。Android の Firefox は既定でユーザー CA を無視する。
- 名前制約が拘束するのはそれを守るクライアントだけで、盗まれた CA の鍵は家庭内アドレスに対して署名できる。鍵の安全性はほかの DPAPI の秘密と同じ（03-security.md）。
- 同じサブネットのすべての端末は、ネットワークの水準ではリスナー（CA、ペアリングのページとその呼び出し）に届く。アプリに入れないようにしているのはセッション。同じサブネットにあるゲストネットワークは、サーバーから見れば家庭内ネットワーク。
- ゲートウェイのハードウェアアドレスは秘密ではなく、偽のアクセスポイントがコピーできる。持ち主のネットワークをほかと区別するものであって、ゲートウェイを証明するものではない。30 秒に 1 度読むので、別のネットワークへ移ると、その時間内にリスナーが閉じる。
- Windows は、`novira-server.exe`（アプリでは `novira.exe`）が接続を受けてよいかをプログラムごとに 1 度尋ねる。Windows が家庭内ネットワークをパブリックとしている場合は、パブリックネットワークでの許可が要る（設定でプライベートに変えることもできる）。
- セッションはサーバーとともに終わるので、スマホは起動のたびにペアリングし直す。
- IPv4 のみ。VPN（Tailscale など）経由のスマホは別のサブネットから来るため、このリスナーは断る。Tailscale 経由では、代わりにリモートのリスナーが答える（[03-browser-server-remote.md](03-browser-server-remote.md)）。家庭内アドレスが新しくなったときは、リスナーの再起動（新しいリーフ）が要る。
