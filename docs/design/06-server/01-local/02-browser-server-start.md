---
covers:
  - backend/crates/novira-server/src/main.rs
  - scripts/server.bat
  - scripts/release/package.bat
---
# ブラウザ用サーバーの起動

`novira-server`（[01-browser-server.md](01-browser-server.md)）の起動のしかた。オプション、開くデータフォルダ、起動するランチャーを扱う。

## 動作

`novira-server (--data <folder> | --app-data) --dist <folder> [--port N] [--engine] [--open]`。`--data` は省略すると `NOVIRA_DATA_DIR` を使う。`--app-data` は、隣にある `novira.exe` が開くフォルダを取る（`data_location::app_data`: 環境変数、ポインター、既定の順。アプリの初回起動前や、移動が待機中のときは終了コード 2）。どれもなければ停止する（終了コード 2）ので、アプリのデータを誤って開くことはない。ほかのプロセスが握っているデータフォルダは、終了コード 3 で断る。`--dist` はビルド済みの `frontend/dist`（なければ停止する）。`--port` の既定は前回の起動のポート（データフォルダの `server-port`。ページの保存状態はアドレスごとのため）で、なければ空きポート。`--engine` を付けると、アプリと同じくワーカー、エンジン、透かしの準備も起動する。準備ができると `novira-server: http://127.0.0.1:<port>/?token=<token>` を表示する。`--open` はそのアドレスを既定のブラウザにも渡す（`api::browser_command`。シェルは通さない）。Ctrl-C で停止する。`scripts/server.bat` はフロントエンドとサーバーをビルドし（`fast` で省略）、リポジトリの `novira-data` を `--engine --open` で起動する。`scripts/release/package.bat` は `novira-server.exe`、`dist/`、`server.bat`（これが書き出す。`--app-data` 付き）を `artifacts/` に入れる。

## 境界

| 境界 | 守り |
|---|---|
| 誰のデータか | 既定のフォルダはない。`--data`、`NOVIRA_DATA_DIR`、`--app-data` のどれかが指定する。`--app-data` はアプリ自身の選択を読むだけで、選択を作ることはしない。アプリの初回起動前や、アプリのデータ移動が待機中のときは、停止する。フォルダを作ると、アプリがそれを自分のデータと取り違えるため（`novira.exe` の隣のフォルダはアプリの既定）。フォルダごとに 1 プロセス（終了コード 3）。 |

テスト: `backend/crates/novira-server/src/main.rs`（オプション、`--app-data` と `--data` と環境変数の対比、拒否、リリース用ランチャーのコマンドライン）、`backend/crates/novira-core/src/data_location/tests.rs`（`app_data`、`default_data_dir`）、`backend/crates/novira-server/tests/lifecycle.rs`。

## 既知の限界

- `--app-data` は、自分と同じビルドのポインターを読む。リリース版のサーバーはリリース版アプリのポインターを、デバッグ版はデバッグ版アプリのポインターを読む。
