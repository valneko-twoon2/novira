# backend/

一覧に戻る: [README.md](README.md)

Rust 側の作り: 3 つのクレート、`novira-core` の各モジュールの役割、ジョブの流れ、データの置き場、テストのしかた。上: [README.md](README.md)。詳しい仕組み: [../design/README.md](../design/README.md)。何をどう守るか: [03-security.md](../design/01-app/01-core/03-security.md)。境界を変える規則: `.claude/rules/security.md`。

Cargo ワークスペースの根は `backend/`（`Cargo.toml`、`Cargo.lock`、`rust-toolchain.toml`、`rustfmt.toml`、ビルド出力は `target/`）。Rust バックエンドは、アプリが Tauri の中で動くとき `frontend/src/backend/mock/` のモックに代わり、すべてをアプリの隣の `novira-data/` に保存し、自分でインストールして起動した ComfyUI を動かす。

## クレート

| クレート | パス | 中身 |
|---|---|---|
| `novira-core` | `backend/crates/novira-core/` | バックエンド全体を普通のライブラリにしたもの。Tauri を含まないので、ウィンドウなしでテストできる |
| `novira-server` | `backend/crates/novira-server/` | このコンピューター上で、普通の Web ブラウザ向けに HTTP で出す本物のバックエンド（テストや検査は Playwright で動かす）。さらにページからの要求で開く、家庭内ネットワーク向けの TLS 専用リスナー（ローカル CA が証明書に署名する。要求で開き、持ち主が信頼したネットワークでだけ開く。スマホがペアリングし、このコンピューターが承認する）。持ち主がオンにしている間は、外出先のスマホ向けに Tailscale アドレス上に 3 つ目の TLS リスナーも開く（Tailscale の証明書、パスキー。`src/remote/`）。`frontend/dist` を配信し、`novira_core::api` を通して `POST /api/<command>`、画像のアップロードと名前による画像、バックエンドのイベントを WebSocket（`/events`）で出す。起動ごとのトークン、`Host`/`Origin` の検査。`build.rs` が Windows の exe にアプリの製品名・バージョン・アイコンを付ける。[01-browser-server.md](../design/06-server/01-local/01-browser-server.md) |
| `novira` | `backend/src-tauri/` | 薄い Tauri 2 のシェル: ウィンドウ設定、IPC コマンド、capabilities、`novira-image://` URL スキーム。WebView が送るものを検証してサービスを呼ぶ。アプリの中でスマホ向けの家庭内ネットワークリスナーを動かすため `novira-server` をリンクする |

シェル（`backend/src-tauri/src/`）: `commands.rs` は IPC コマンド（薄く、共有レイヤーの `novira_core::api::call` を呼ぶ。同期のものは `commands::guard` を通すので panic でメインスレッドは死なない。ダイアログとウィンドウのコマンドはここに書く）、`command_list.rs` は登録した名前、`dialogs.rs` はネイティブのフォルダ・保存・開くダイアログ（シェル自身が開くので、WebView はパスを送らず受け取らない）、`events.rs` はバックエンドのイベントから `novira://event` チャンネルへの橋渡し、`image_scheme.rs` は画像の URL スキーム（名前だけでパスは使わない。判断は `novira_core::image_serve`）、`home_network.rs` はアプリ内のスマホ向けサーバー（`novira_server::embed`。家庭内ネットワークのリスナーだけ）と QR 項目の `lan_*` コマンド、`startup.rs` は起動に失敗したときに出すダイアログ（データフォルダのロックで 2 つ目のコピーを断るのは `novira_core::startup`）。

## novira-core

`backend/crates/novira-core/src/`。最上位のファイルはどの部分からも共有される:

| ファイル | 中身 |
|---|---|
| `api.rs` | 両シェルが呼ぶ唯一のコマンドレイヤー。全コマンドを（名前、名前付き JSON 引数、検査）一度だけ書き、Tauri 向けには型付き関数、ブラウザサーバー向けには `dispatch` として出す |
| `strict.rs`（`strict/`） | `from_value`、`from_str`、`Strict<T>`: JSON をワイヤ型として読むとき、構造体を期待する場所の配列を拒む（serde だけでは位置指定のフィールドとして読んでしまう）。`dispatch`、Tauri の構造体引数、`settings.json`・データベースの行・データフォルダのポインターの読み込みが使う |
| `startup.rs`、`image_serve.rs` | ロックの下でデータフォルダを開く（フォルダごとに 1 プロセス）。画像 URL のパスが返すもの（`/<full|thumb>/<name>`） |
| `types.rs`（と `types/`） | ワイヤ型。`frontend/src/backend/types.ts` がミラーする。単体テストは `types/tests.rs` |
| `engine.rs` | `Engine` トレイト、ジョブ、出力、状態 |
| `db.rs` | SQLite。1 行に JSON ドキュメント 1 つ。`rusqlite` を使うのはこのファイルだけ |
| `settings.rs` | `settings.json`。`Settings` 型がすべての設定の正本 |
| `endpoints.rs` | 外部サービス（Civitai、Hugging Face、GitHub、7-Zip、TrustMark）のアドレス。デバッグビルドではループバックのテストサーバーに向けられる |
| `secret.rs` | Civitai キーと Hugging Face トークンは Windows の資格情報マネージャー、ほかの保存キーとコンテンツクレデンシャルの署名鍵は Windows DPAPI で暗号化 |
| `sync.rs` | panic に耐えるロックのヘルパー（`lock_safe`、`read_safe`、`write_safe`）。ロックに `unwrap` は使わない |
| `child_job.rs` | Windows のジョブオブジェクト: ComfyUI と音声ワーカーは、アプリが強制終了されてもアプリと一緒に終わる |
| `gpu_lock.rs`、`hardware.rs`、`fonts.rs` | GPU ロックのディレクトリとその持ち主の記録、カードとそのメモリ、インストール済みのフォントファミリー |
| `applog.rs`、`unfinished.rs`、`packs.rs`、`test_timing.rs` | ログ（stderr、`logs/novira.log`、開発者ログのイベント）、中断したダウンロードの部分ファイル、ComfyUI のファイルのモデルパック（動画、ターボ動画、音楽、LaMa）、テスト用に待ち時間を縮めるデバッグ専用の仕組み |

| フォルダ | 中身 |
|---|---|
| `service/` | フロントの `BackendClient` が呼ぶもの: 領域ごとに 1 モジュールで、1 つの共有状態（`mod.rs`）の上に載る。`queue.rs`、`worker.rs`、`guidance.rs` がジョブの経路、`model_store.rs`、`pack_store.rs`、`node_pack_store.rs` がインストール、`engine_settings.rs`、`memory.rs`、`keys.rs`、`backups.rs`、`share.rs`、`assistant.rs`、`canvas.rs`、`comics.rs`、`workflows.rs`、`boards.rs`、`gallery.rs`、`browse.rs` がその他 |
| `comfy/` | エンジンとしての ComfyUI: アプリがインストール・起動・所有する（`install.rs`、`process.rs`: ループバックのみ）、HTTP と WebSocket のクライアント（`client.rs`）、プロンプトのビルダー（画像は `graph.rs`、`video.rs`、`music.rs`、ワークフローエディター用の `user_graph.rs`）。`node_packs.rs` と `registry.rs` は拡張機能と ComfyUI Registry。組み立てたプロンプトのスナップショットテストは `comfy/__snapshots__/graph/` |
| `models/` | `novira-data/models` の下のモデルフォルダ、safetensors ヘッダー → 種類、インストール済み一覧、ソースからのインストール、Civitai と Hugging Face の検索、成人向けコンテンツのフィルター |
| `agent/` | `claude` / `codex` CLI または OpenAI 互換サーバー経由の AI アシスタント。アプリの道具を通して動く: `tools.rs`（名前、スキーマ、検査）、`mcp.rs`（ループバックの道具サーバー。`dispatch` が道具呼び出しすべてが通る唯一の経路）、`relay.rs`（ウィンドウへの呼び出しとその答え）、`prompt.rs`（伝える内容） |
| `voice/` | 音声エンジン: ワーカープロセス内の Qwen3-TTS とそのインストーラー |
| `media/` | ギャラリーのファイル（PNG / MP4、サムネイル、埋め込みメタデータ、アップロードの上限、名前の検査）、共有用のクリーンなコピー、音声 |
| `provenance/` | 書き出したコピーの「AI で作成」の印（TrustMark の透かし、XMP、C2PA マニフェスト）と、それを読む検査 |
| `backup/` | バックアップの zip と、`restore-staging/` への復元（次の起動で適用し、ロールバックあり） |
| `data_location/` | データフォルダの場所（ユーザーの設定フォルダにあるポインターファイル）と、次の起動で新しいフォルダへデータを移すこと |
| `first_run/` | 初回起動: それが初回かどうか、求められたフォルダの書き込み（データフォルダのポインター、ComfyUI フォルダの設定）。IPC コマンドはシェルの `first_run.rs` にある |

## ジョブの流れ

画面が `queue` に要求のエンキューを頼む。`guidance.rs` がマスク、コントロールレイヤー、参照画像を検査し、モデルと画像を解決する。ワーカー（`worker.rs`）が保留中のジョブを取り、`comfy/graph.rs`（または `video`、`music`、`user_graph`）でプロンプトを組み、`comfy/client.rs` で送り、進捗を追い、結果（画像、ファイル、テキスト）を保存してイベントを出す。シェルがイベントをウィンドウへ転送し、`frontend/src/state/wiring.ts` がストアへ入れる。キューの項目は保留中、実行中を経て、完了、失敗、キャンセルのいずれかになる。一時停止、キャンセル、再試行、再起動は `queue.rs` にある（遷移表は `/testing` スキル）。

## ディスク上のデータ

`novira-data/`（デバッグビルドではリポジトリの根、リリースビルドではユーザーフォルダ。すでにある場合は実行ファイルの隣。`NOVIRA_DATA_DIR` で変えられる）:

```text
novira-data/
├─ novira.sqlite              # one JSON document per row (db.rs)
├─ outputs/  thumbnails/      # gallery files
├─ trash/                     # deleted pictures that can still be taken back (14 days, 500 at most)
├─ models/                    # model folders (models/layout.rs)
├─ comfyui/                   # the installed ComfyUI and its Python (unless settings point at another one)
├─ secrets/                   # DPAPI-encrypted keys, and the id of this folder's Credential Manager entries (secret.rs)
├─ cache/  logs/              # ComfyUI caches; novira.log (rotated)
├─ settings.json  agent.json
└─ restore-staging/  backup-before-restore-<date>/   # while a restore is pending; during one at start-up
```

## テスト

単体テストは各 `.rs` ファイルの中（`mod tests`）か、長いファイルの隣の `<name>/tests.rs` に置く。`backend/crates/novira-core/tests/` にあるもの:

| 種類 | 中身 |
|---|---|
| `backend_service/` | 偽のエンジンを使ったサービス。領域ごとに 1 モジュール |
| `comfy_fake_server/`、`fake_site/` | 偽の ComfyUI に対するクライアント。Civitai・Hugging Face・GitHub の代わりをするループバックサーバーで、`*_download_fake` テストが使う |
| `contract/` | リポジトリ直下の `contract/` のフィクスチャをワイヤ型に当てる |
| `prop_*.rs` | プロパティテスト（proptest、プロセス内）: 悪意のある名前・パス・URL・JSON・バイト列を純粋関数とパーサーへ入れる |
| ほかの `*.rs` | 失敗と待ちの経路を実際に起こす（壊れたデータベース、握られたファイル、尽きる再試行）、偽の CLI を使ったアシスタント、透かし付きの書き出し |
| `*_live.rs` | `#[ignore]`。ネットワーク、CLI、動いている ComfyUI が要る。変更がそれらに関わるときに名前を指定して実行する |

シェルには `backend/src-tauri/tests/`（`security/`、`window_config.rs`、`robustness.rs`）がある。変更に対してどのテストを回すか: `.claude/rules/tests.md`。
