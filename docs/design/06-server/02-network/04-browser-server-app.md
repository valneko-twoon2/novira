---
covers:
  - backend/crates/novira-server/src/embedded.rs
  - backend/crates/novira-server/src/embedded/**
  - backend/src-tauri/src/home_network.rs
  - frontend/src/backend/tauri/lan.ts
---
# スマホとデスクトップアプリ

デスクトップアプリは、`novira-server` と同じように、家庭内ネットワークのスマホから使える（[01-browser-server-lan.md](01-browser-server-lan.md)、[02-browser-server-pairing.md](02-browser-server-pairing.md)）。サイドバーの QR の項目が家庭内ネットワークを開き、スマホがコードを読み取り、アプリが許可する。このために、`novira-server` のサーバーがアプリの中で、家庭内ネットワークのリスナーだけを付けて動く。

## 動作

- 起動時、バックエンドが開いた後で、シェルは `novira_server::embed` で、アプリ自身のバックエンドの上にサーバーを作る。この PC 上のリスナーは付けない（ウィンドウは IPC のまま）。続けて、アプリのデータフォルダ上の同じ `Control` で家庭内ネットワークを有効にする（そのため CA、信頼したネットワーク、リスナーのポートは、そのフォルダで `novira-server` が使うものと同じ）。リモートのリスナーも同じように有効にする（[03-browser-server-remote.md](03-browser-server-remote.md)。オンならすぐ開く）。ウィンドウの QR の項目は、コマンド `lan_state`、`lan_open`、`lan_close`、`lan_trust`、`lan_untrust`、`lan_pair_code`、`lan_approve`、`lan_deny`、`lan_revoke` と、`remote_state`、`remote_enable`、`remote_disable`、`remote_code`、`remote_approve`、`remote_deny`、`remote_revoke`、`remote_forget` でこれらを操作する（`frontend/src/backend/tauri/lan.ts`）。各コマンドは `Embedded::manage` を通して固定の 1 ルートを実行する。`Embedded::manage` は、サーバー自身のルーターに、この PC が起動トークンを持つ形でリクエストをプロセス内で送り、ルートが返したとおりに `{status, body}` で答える（管理ルートでないパスはそこでは 404）。ペアリング済みのスマホには、アプリに組み込まれたフロントエンドを配信する（アセットリゾルバー。ビルドにあるファイルだけで、リゾルバーの `index.html` へのフォールバックは使わない）。アプリのバックエンドは自分のスキームの画像 URL（`http://novira-image.localhost/...`）を渡す。サーバーは、コマンドの応答、アップロード、イベントの中で、そのベースで始まる文字列をすべて `/novira-image/...` に書き換え、コマンドの引数では逆に書き戻す（`embedded.rs`）。バックエンドのイベントはウィンドウとスマホの `/events` の両方に行く（両方を呼ぶ 1 つのシンク）。アプリを閉じると両方のリスナーが閉じる。
- これらのコマンドは `api::SHELL_ONLY` に載っている（ブラウザ用サーバーは提供しないものとして答える。そのページにはルートがある）。フロントエンドのコマンド名と引数が Rust 側と等しいことを、テストが保つ（`frontend/src/backend/tauri/lan.test.ts`）。

## 境界

| 境界 | 守り |
|---|---|
| ウィンドウ | そのサーバーにはこの PC 上のリスナーがない。ウィンドウが家庭内ネットワークとリモートのリスナーに届くのは、メインウィンドウの権限が挙げる 9 つの `lan_*` と 8 つの `remote_*` コマンドを通してだけ。各コマンドは固定の管理ルートで、引数の長さは入口で上限をかけ、形はルートが検査する。端末が得るものは、`novira-server` から得るものとまったく同じ。 |
| 画像 URL | 書き換えるのは、アプリのベースで始まる文字列（出力）か `/novira-image/` で始まる文字列（入力）だけ。バックエンドは、渡された名前をそれでも検査する。 |

テスト: `backend/crates/novira-server/src/embedded/tests.rs`（管理呼び出しと断られるもの、それらを通してペアリングしたスマホが組み込みのページとファイルを得ること、そのコマンドとこのサーバーの画像ベースでのアップロード、ウィンドウからの閉鎖、URL の書き換え）、`backend/crates/novira-server/src/embedded/fuzz.rs`（壊れた管理呼び出し、URL の書き換え用に生成した JSON、ペアリング済みスマホの壊れたファイルパス。それぞれ 300 ケースで、`NOVIRA_FUZZ_ITERATIONS` と `NOVIRA_FUZZ_SEED` で増やせる）、`backend/src-tauri/src/home_network.rs`（引数の上限、両方のイベントシンク）。

## 既知の限界

- スマホがコマンドの引数で送る文字列が `/novira-image/` で始まると、画像 URL として読まれ、アプリのスキームで書かれる。自由入力の中（そう始まるプロンプトなど）でも同じ。含むだけのものはそのまま。
- Windows は、リスナーが初めて開くときに、`novira.exe` が接続を受けてよいかを 1 度尋ねる。
