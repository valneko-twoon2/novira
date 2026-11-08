---
covers:
  - backend/crates/novira-core/src/first_run.rs
  - backend/crates/novira-core/src/first_run/tests.rs
  - backend/src-tauri/src/first_run.rs
  - frontend/src/features/splash/FirstRun.tsx
  - frontend/src/backend/tauri/firstRun.ts
---
# 初回起動

デスクトップアプリの最初の起動では、何かを開く前に、データフォルダと novira 自前の ComfyUI の置き場所を尋ねる。それまで既定の場所には何も書かない。

## 動作

**表示される条件。** `backend/src-tauri/src/lib.rs` の `first_run_needed` が真になるのは、`NOVIRA_DATA_DIR` が未設定で、ポインタファイル（01-settings-engine.md）が無く、アプリの隣の `novira-data/` も、ユーザーフォルダの `novira-data/`（以前のバージョンがデータを置いた場所）も無いとき。既にアプリを使っている人は尋ねられず、`novira-data/` がリポジトリ内にあるデバッグビルドも尋ねられない。判定はディスク上の状態から行うので、選択が保存されるまで真のまま。

**起こること。** シェルはバックエンドを開かない。`Backend` を管理せず、ワーカーもエンジンも起動せず、画像スキームは 404 を返す。ページ（`frontend/src/main.tsx`）は、ほかの何かを呼ぶ前に `firstStart()` 経由で `first_run_info` を尋ね、`FirstRun.tsx` だけを描画する。ロゴと、2 行のカード（「データフォルダ」と「画像エンジン（ComfyUI）のインストール先」）からなる。各行は、パス（最初は既定のもの）、シェルのフォルダダイアログを開くボタン（「フォルダを選ぶ」）、別のフォルダを選んだ後に既定へ戻すボタン（「標準の場所に戻す」）を持つ。「この場所で始める」が `first_run_finish` を呼び、選択を書いてアプリを再起動する。次の起動はポインタ付きの通常起動になり、ComfyUI のフォルダを選んでいれば `comfyuiInstallDir` 設定も入っている。設定画面からのデータフォルダ変更を起動時に実行している間は、同じ画面の枠が「データを移動しています」（`first_run_info` の `moving`）を表示する。別のドライブへコピーするときは、コピーしたバイト数（`moved`、`toMove`、0.5 秒ごとに問い合わせる）も表示し、終わるとアプリが自動で再起動する。

**書き込むもの。** `novira_core::first_run::apply` が選択を検査し（設定画面と同じ検査。データフォルダは、完全な素のパスで、ドライブのルートではなく、新規か空のフォルダか既にデータのあるフォルダであること。ComfyUI は `check_install_dir`）、データフォルダを作り、その `settings.json` に `comfyuiInstallDir` を保存し、最後にポインタを書く。失敗したら次の起動も初回起動のままになる。既定のデータフォルダは `default_data_dir`（リリースビルドではユーザーフォルダ）、既定の ComfyUI フォルダはデータフォルダ内の `comfyui` で、設定は書かない。

**ページのプロファイル。** WebView のプロファイルは通常データフォルダにある。初回起動では、ポインタファイルの隣の `setup-webview` に置くので、ユーザーが選ぶ前に既定のデータフォルダが作られることはない。設定画面からのデータ移動の実行中は、そこの `moving-webview` に置き、どちらのフォルダにも移動の邪魔になるプロファイルが残らない。

## 境界

| 境界 | 守り |
|---|---|
| `first_run_info`、`first_run_choose`、`first_run_reset`、`first_run_finish`（IPC、`backend/src-tauri/src/first_run.rs`） | パスを受け取らない。フォルダはシェル自身のダイアログからだけ来て、`first_run_finish` までシェルの状態に待機する。`kind` は `data` か `comfyui` で、ほかは拒否する。`first_run_needed` が偽になった後はどのコマンドも拒否するので、ページがこれらでデータフォルダを後から動かすことはできない。選んだフォルダはその場で検査され、`apply` でもう一度検査される。 |
| ブラウザ用サーバー | コマンドはシェル専用（`api.rs` の `SHELL_ONLY`）で、サーバーは "not available in the browser yet" と答える。 |

## 既知の限界

- 尋ねるのはデータフォルダと ComfyUI のフォルダだけ。モデルフォルダなどは、その後に設定画面で決める。
- この画面にはブラウザのモックでのテストが無い（モックに初回起動が無いため）。`FirstRun.test.tsx` は IPC をモックする。
- 「この場所で始める」の後の再起動はアプリ自身の再起動を使う。`tauri dev` のセッションはこれで終わる（デバッグビルドはリポジトリ内では初回起動で尋ねられないので、`novira-data/` の無いフォルダから動かしたデバッグビルドだけに関係する）。

## 未実装

- この画面での言語の選択。ページが既に持っている言語に従う。
