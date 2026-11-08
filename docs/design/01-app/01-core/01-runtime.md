---
covers:
  - backend/crates/novira-core/src/db.rs
  - backend/crates/novira-core/src/child_job.rs
  - backend/crates/novira-core/src/applog.rs
  - backend/crates/novira-core/src/settings.rs
  - backend/crates/novira-core/src/service/mod.rs
  - backend/crates/novira-core/src/service/worker.rs
  - backend/crates/novira-core/src/media/images.rs
  - backend/crates/novira-core/src/comfy/process.rs
  - backend/crates/novira-core/src/voice/mod.rs
  - backend/src-tauri/src/lib.rs
  - backend/src-tauri/src/startup.rs
  - backend/crates/novira-core/src/startup.rs
  - backend/src-tauri/src/image_scheme.rs
  - backend/src-tauri/build.rs
  - backend/src-tauri/Cargo.toml
---
# 実行時の構成

デスクトップアプリが動いている間の組み立て。WebView と Rust バックエンドの間の層、起動と終了、データフォルダと二重起動を防ぐロック、保存先、失敗でアプリが終わらない仕組み、ComfyUI と音声ワーカーをアプリより長く生かさない仕組み、ビルドで自己完結にする方法を扱う。上に載る機能は別ページにある（キューと ComfyUI のグラフは 01-generation.md など）。

## 動作

### 層

```text
React (frontend/)            TauriBackend (frontend/src/backend/tauri/): one invoke() per BackendClient method; listens on "novira://event"
  │  Tauri IPC, events, novira-image URL scheme
backend/src-tauri            thin shell: commands.rs (calls novira_core::api, the command layer shared with the browser server), events.rs, image_scheme.rs, capabilities/default.json
  │
backend/crates/novira-core   the backend service: SQLite, image files, queue, models, workflows. No Tauri dependency
  │  Engine trait (engine.rs)                 VoiceEngine trait (voice/mod.rs)
ComfyEngine (comfy/client.rs)               voice worker (Python process)
  │  HTTP /prompt /history /view /upload/image /models/<folder> /object_info, / and /assets (locale files); WebSocket /ws
ComfyUI (Python process)
```

`novira-core` は Tauri を含まないライブラリで、ウィンドウ無しでテストできる（`cargo test -p novira-core`）。シェルは呼び出しとイベントの中継、画像の配信、ウィンドウ側の起動処理（`backend/src-tauri/src/startup.rs`）を担う。データフォルダのロックとバックエンドを開く処理は `backend/crates/novira-core/src/startup.rs` にあり、ブラウザ用サーバーと共有する（[01-browser-server.md](../../06-server/01-local/01-browser-server.md)）。

どの ComfyUI を使うかは `settings.json` の `comfyuiUrl` と `comfyuiDir` で決まる（項目は `backend/crates/novira-core/src/settings.rs` の `Settings`）。

- どちらも未設定: novira が `<data>/comfyui/` の自前の ComfyUI を 127.0.0.1 の空きポートで動かす。無ければインストールする（Windows のみ）。
- `comfyuiDir` を設定: そのフォルダの ComfyUI を novira が起動し、終了時に止める。`comfyuiUrl` も設定されていればそのアドレスで起動する（ホストはこの PC のものに限り、違えば起動を拒否する）。無ければ空きのループバックポートで起動する。
- `comfyuiUrl` だけ設定: そこで動いているサーバーを使い、起動も停止もしない。応答が無ければエンジンは "not reachable" と報告する。

novira 自身のプロセスは `main.py --listen <host> --port <port> --disable-auto-launch --preview-method auto --extra-model-paths-config <data>/extra_model_paths.yaml` に続けて `comfyuiArgs` を付け、コンソール無しで動かす。出力は `logs/comfyui.log` に、キャッシュ（`HF_HOME`、`TORCH_HOME`、`TEMP` など）は `<data>/cache/` に置く。Python は `comfyuiPython` があればそれ、無ければ ComfyUI フォルダの venv かポータブル版の `python_embeded`（`backend/crates/novira-core/src/comfy/process.rs`）、それも無ければ PATH の `python`。

### 起動

`backend/src-tauri/src/lib.rs` と `Backend::open` の順。

1. ウィンドウより前に、パニックをログに残すフックを入れる（「失敗とログ」を参照）。`WEBVIEW2_USER_DATA_FOLDER` が未設定なら `<data>/webview` にする。
2. データフォルダを決めて作る（「データフォルダ」を参照）。
3. `novira.lock` を取る。別のコピーが持っていれば、理由とフォルダを示すダイアログを出し、データベースにも ComfyUI にも触れずにコード 1 で終了する。ほかの起動エラーも同じダイアログで示す。
4. ログファイルを決め、`settings.json` を読む。壊れていれば理由を示して起動を止め、無ければ既定値を使う。
5. `Backend::open`: バージョン切り替えが途中で切れていれば novira 自前の ComfyUI を元のバージョンに戻し、途中で切れた拡張機能のインストールの作業フォルダを片付け（02-extensions.md）、確認済みの復元を適用する。モデルのカテゴリフォルダと `extra_model_paths.yaml` を書き、データベースを開いてメモリに読み込む。ComfyUI と音声エンジンは設定だけで起動しない。各ステップの時間を `novira.log` に 1 行で出す（`opened in … ms (…)`、`backend/crates/novira-core/src/service/open_timing.rs`）。`backend/crates/novira-core/examples/backend_timing.rs` はデータフォルダのコピーで測る。
6. ウィンドウ: `tauri.conf.json` は非表示のウィンドウを作る。`show_window` が枠と背景を、画面を最後に閉じたときのテーマに合わせて表示する（`saved_theme_is_light`。保存された画面状態から読み、無ければ、つまり初回起動と移動中は暗い）。枠が先に Windows のテーマに従うことはない。最初の描画の前に `frontend/public/theme-boot.js`（`<head>` 内の素のスクリプト。`frontend/vite.config.ts` の `themeBoot` がビルドに書く）がページのストレージのテーマを適用し、バックエンドの状態が入ったところで `frontend/src/state/savedTheme.ts` が再度適用する。イベントの送り先をバックエンドに渡し、キューのワーカーを起動し、裏で ComfyUI を用意する（無ければインストールして起動し、応答したら準備完了と報告する）。インストール済みと異なる `comfyuiPackage` があれば、この起動でそれに入れ替える。透かしファイルを用意する。Windows ではウィンドウの小さいアイコンを、画面の倍率に合うフレームに置き換える（100 % で 16 px、125 % で 20 px。別の倍率のディスプレイに移ると選び直す。`fit_window_icon`）。Tauri が渡す 32 px のフレームを Windows が縮小すると、タスクマネージャーでウィンドウの行がプログラムの行より太く見えたためで、`icon.ico` は 16、20、24、32、40、48、64、128、256 px のフレームを持つ。`civitaiLookup` が有効なら、ローカルモデルのカバーとライセンスを調べる。

ランチャー: `scripts\start.bat` は変更分をビルドして `backend\target\debug\novira.exe` を開く（`fast` はビルドを省く）。`scripts\dev.bat` は Vite の開発サーバーに向けてアプリを動かし、フロントエンドの編集が保存時に反映される。`backend/` の `cargo run -p novira` も同じアプリをビルドして開く。`frontend/` の `npm run dev` はブラウザ用モックだけを配信する。

### データフォルダ

`NOVIRA_DATA_DIR` が設定されていて空でなければそのフォルダ。そうでなければ、デバッグビルドではリポジトリ直下の `novira-data/`。リリースビルドではユーザーフォルダ（`USERPROFILE`、無ければ `HOME`）の `novira-data/`。ただし実行ファイルの隣に既にあればそちらを使い続け、更新でデータを置き去りにしない（`backend/crates/novira-core/src/data_location.rs` の `default_data_dir`）。ブラウザ用サーバーに既定は無く、`--app-data` ならその隣のアプリが開くフォルダを開く（`app_data`）。設定画面で選んだフォルダはポインタファイルから読み（`data_location.rs`、01-settings-engine.md）、環境変数の後、この既定の前に使う（デバッグビルドには専用のポインタがある）。何も無ければ初回起動で尋ねる（02-first-run.md）。頼まれた移動は、ロックを取る前に、ウィンドウ設定から起動したスレッドが「移動中」画面の裏で行い、終わるとアプリが再起動する。

- `novira.sqlite` とその WAL ファイル: データベース（「保存」を参照）。
- `outputs/`、`thumbnails/`: ギャラリーのファイル。
- `models/<category>/`: モデルのフォルダ。起動時に作る。
- `comfyui/`: novira 自前の ComfyUI。
- `cache/`: ComfyUI と音声ワーカーのキャッシュと一時ファイル。
- `voice/site/`: 音声ワーカーの Python ライブラリ。
- `secrets/`: Windows DPAPI で暗号化したキーと、`store-id`（Civitai キーと Hugging Face トークンの資格情報マネージャー項目につける、このフォルダの ID。`backend/crates/novira-core/src/secret.rs`）。
- `extra_model_paths.yaml`: 起動のたびに書き直し、モデルのあるフォルダを ComfyUI に伝える。
- `logs/`: `comfyui.log` と `novira.log`。
- `webview/`: WebView2 のプロファイル。ページ自身のストレージ（プリセットなど）をデータフォルダごとに保つ。
- `novira.lock`: ロック。起動時に開いて排他ロックし、終了まで持つ。クラッシュしても OS が解放するので、次の起動は妨げられない。何も書き込まない。
- `settings.json`: 任意。無い項目は `Settings` の既定値になる。

### 失敗とログ

- 同期の IPC コマンドは `commands::guard` の中で動き、パニックはその呼び出しのエラーになる。これらはメインスレッドで動き、巻き戻るパニックはアプリを終わらせるため。
- キューのワーカーはジョブ内のパニックを捕まえ、そのジョブだけを失敗にして続行する。
- ロックは `LockExt` と `RwLockExt`（`backend/crates/novira-core/src/sync.rs`）で取る。パニックの後もガードを取り戻すので、1 回のパニックが後の呼び出しを汚染しない。
- `backend/src-tauri/tests/robustness.rs` が、すべての同期コマンドが guard されていることと、どのロックも unwrap されないことを検査する。
- `applog` は各行と各パニックを stderr と `logs/novira.log` に書き、ウィンドウ設定後は開発者ログにも `log` イベントで送る。`novira.log` は 2,000,000 バイトを超えていれば、行を追記する前に `novira.log.1` に改名する。メッセージは 4,000 文字で切る。
- 解析できないデータベースの行は飛ばしてログに残し、テーブルの残りは読み込む。

### 保存

- SQLite は同梱する（`rusqlite` の `bundled`）。データベースは WAL モード、`synchronous` は NORMAL（`backend/crates/novira-core/src/db.rs`）。
- テーブル: `boards`、`images`、`workflows`、`models`、`queue`、`comics`、`watermarks`。各行は `data` 列の 1 つの JSON 文書で、`sort` 列で並べる。`meta` テーブルは、非表示モデルの一覧やキャンバス文書などの key/value を持つ。
- メモリ上の状態が作業用のコピーで、変更は起きるたびにデータベースへ書き込む（`Db::put`、`put_many`、`delete`）。
- 原本は `outputs/<uuid>.png`、動画は `outputs/<uuid>.mp4`、音声は `outputs/<uuid>.<ext>`。サムネイルは `thumbnails/<uuid>.thumb` で、アルファがあれば PNG、無ければ品質 85 の JPEG。ファイルは `.tmp` の名前で書いてから改名する。名前は novira が生成し、`images::is_valid_name` がそれ以外をパスの組み立て前に拒否する。
- `novira-image` スキームがこれらを配る。Windows では `http://novira-image.localhost/<full|thumb>/<name>`。URL は名前だけを持つ。未知か不正な名前は 404。音声と動画はシークできるようバイト範囲（206、416）に応え、求められた範囲だけ読む。
- 生成設定は PNG の中に、非圧縮 UTF-8 の `iTXt` チャンク `novira_metadata` として保存し、ワークフローを使ったときは `novira_workflow` も保存する（`backend/crates/novira-core/src/media/images.rs`）。画素には触れない。PNG を再アップロードすると設定が戻る。PNG はそのまま保存し、ほかの形式はデコードして PNG で書く。
- 組み込みワークフローはフロントエンドにある（`frontend/src/backend/defaultWorkflows.ts`）。バックエンドが保存するのはユーザーのものだけ。
- バックアップは `VACUUM INTO` でデータベースをコピーする（`Db::backup_to`）。

### 終了とプロセスの寿命

- Windows では、novira が起動した ComfyUI プロセス（`backend/crates/novira-core/src/comfy/process.rs`）と音声ワーカー（`backend/crates/novira-core/src/voice/mod.rs`）を、kill-on-close で作った 1 つのジョブオブジェクトに入れる（`backend/crates/novira-core/src/child_job.rs`）。ジョブのハンドルは実行中閉じないので、アプリのプロセスがクラッシュや強制終了を含めどう終わっても、Windows がジョブを閉じてメンバーを終わらせる。つまりエンジンはアプリより長く生きない。結び付けはベストエフォートで、失敗してもプロセスは通常どおり動き、通常の終了経路が止める。Windows 以外では `bind` は何もしない。
- 通常の終了: `RunEvent::Exit` が `Backend::shutdown`（`backend/crates/novira-core/src/service/worker.rs`）を呼ぶ。ワーカーと実行中のインストールをキャンセルし、ComfyUI を kill して待ち、音声ワーカーを `start_kill` で止める。音声リクエストがワーカーを握っている間は行わない（ジョブオブジェクトが担う）。最後に `gpu_lock::release_all()` がこのプロセスの GPU ロックを解放する。
- 外部の ComfyUI（`comfyuiDir` なしの `comfyuiUrl`）は止めない。

### ビルド

- `backend/` が Cargo ワークスペース。アプリは `backend/src-tauri` のパッケージ `novira`。
- `tauri` は `custom-protocol` フィーチャー付きでビルドするので、`cargo run` を含むどのビルドも、開発サーバーではなく同梱のフロントエンドを配信する。
- `backend/src-tauri/build.rs` は、`frontend/dist/index.html` が無いか、`frontend/src`、`frontend/index.html`、`frontend/package.json`、`frontend/vite.config.ts` より古いときに、`frontend/` で `vite build` を実行する。`frontend/node_modules` が無ければ失敗する。`NOVIRA_SKIP_FRONTEND_BUILD=1` でこの手順を省く（Node の無い CI 用）。
- よって `cargo run -p novira` と `novira.exe` は、開発サーバー無しで本物のアプリを表示する。

## 境界

| 境界 | 守り |
|---|---|
| データベース | 束縛パラメータ付きの固定 SQL。テーブル名は enum から来る。 |
