---
covers:
  - backend/crates/novira-server/**
  - backend/crates/novira-core/src/api.rs
  - backend/crates/novira-core/src/startup.rs
  - backend/crates/novira-core/src/image_serve.rs
  - frontend/src/backend/http/**
  - frontend/src/backend/calls.testkit.ts
---
# ブラウザ用サーバー

普通の Web ブラウザの裏で動く本物のバックエンド。ウィンドウのない novira で、Chromium（Playwright）で `novira-core` を動かす検査にも使う。`backend/crates/novira-server/` はこの PC 上の HTTP サーバーで、家庭内ネットワーク（[01-browser-server-lan.md](../02-network/01-browser-server-lan.md)）や、外出先の持ち主のスマホ（Tailscale。[03-browser-server-remote.md](../02-network/03-browser-server-remote.md)）にも開ける。フロントエンドは、Tauri クライアントとモックに並ぶ 3 つ目の `BackendClient`（`frontend/src/backend/http/HttpBackend.ts`）でつながる。

## 動作

### 2 つのシェルで共通のコマンド層

`backend/crates/novira-core/src/api.rs` は、バックエンドだけで済むコマンドを全て持つ。各コマンドは `commands!` の一覧に（名前、引数、本体）で 1 回だけ書く。マクロが型付きの関数（`api::call::<name>`。`backend/src-tauri/src/commands.rs` の `#[tauri::command]` 関数が呼ぶ）と、`api::dispatch(backend, name, json)` の項目（サーバーが呼ぶ）を作る。引数の検査・読み方とパニックの防護は 1 か所だけ。`dispatch` は camelCase の名前付き引数（Tauri と同じ綴り）を受け、不足・型違い・余分な引数を断る（構造体の位置の JSON 配列は、どの深さでも型違い。`novira_core::strict`）。同期コマンドはブロッキングプールの `guard` 内で動かし、`CallError::{UnknownCommand, BadArguments, Failed}` で答える。

この層は、Tauri にも HTTP スタックにも依存しない `novira-core` にある。`backend/src-tauri/src/command_list.rs` は Tauri コマンドの一覧のまま（権限ファイルもこれと同じ）で、`commands.rs` のテストが、これが `api::NAMES` と `api::SHELL_ONLY` の合計に等しいこと、委譲する Tauri コマンドがこの層の引数名を取ることを確かめる。

`api::SHELL_ONLY` は、デスクトップのシェルだけが実装するコマンド。フォルダ・開く・保存のダイアログ、生のアップロード本体、ズーム、システムのブラウザ（別の形で提供）、スキャンしたモデルファイル（`install_model`。パスなしで提供）、最後の書き出しフォルダ、復元後の再起動、`prepare_watermark`、`lan_*`（04-browser-server-app.md）。両シェルは次も `novira-core` で共有する。データフォルダをロックの下で開くこと（`startup.rs` の `open_backend`。アプリと同じロックファイルで、フォルダごとに 1 プロセス）と、画像パスの返し方（`image_serve.rs`。`novira-image://` と `/novira-image/` の判断）。

### サーバー

起動: [02-browser-server-start.md](02-browser-server-start.md)。

ルート（`backend/crates/novira-server/src/lib.rs`）。

| ルート | 内容 |
|---|---|
| `GET /`, `/index.html` | `--dist` の `index.html` の `<head>` の後ろに `<script src="/novira-server.js">` を足したもの。このスクリプトが `window.__NOVIRA_SERVER__` を設定し、フロントエンドはそれで `HttpBackend` を選ぶ |
| `POST /api/<command>` | `api::SERVED` のコマンド。入力は JSON オブジェクト（空の本体は引数なし）、出力も JSON。エラーは `{"error", "code"}`: 400 `bad_arguments`、404 `unknown_command`、422 `failed`（ウィンドウの表示）、501 `not_available_in_browser` |
| `POST /upload/image` | 本体は画像（`application/octet-stream`。他は 415）、オプションは JSON で `x-novira-options`（不正な JSON は 400）。応答は保存された画像（バックエンドが自分の上限でデコード・再エンコードする） |
| `POST /export/images` | `export_images` の `names` と `options` を JSON で渡す（他は 415、不正な JSON は 400）。応答はダウンロードで、その `ExportResult` は `x-novira-export` に入る（`02-gallery-share.md`） |
| `GET /events` | WebSocket へのアップグレード。バックエンドのイベント（デスクトップの `novira://event` と同じ）1 件が JSON テキスト 1 通になる。サーバーは送るのみで、ページの送信は無視する |
| `GET /novira-image/<full\|thumb>/<name>` | 名前指定の画像。`image_serve::serve` を通す（デスクトップのスキームと同じ名前検査と Range 応答）。画像 URL はページからの相対（`/novira-image/...`） |
| 上記以外の `GET` | `--dist` の既知の種類（スクリプト、スタイル、画像、フォントなど）のファイル。`no-cache` と `ETag`（ファイルのサイズと時刻。アプリ内蔵分はダイジェスト）付きで、`If-None-Match` が一致すれば空の 304 |

答えるコマンド（`SERVED`。グループ別）。

| グループ | コマンド | ここで安全な理由 |
|---|---|---|
| 読み取り | `bootstrap`、`get_image_details`、`queue_snapshot`、モデル・パック・フォント・コミック・ダウンロード・透かしの一覧と状態、`engine_settings`、キーの `has_*`、`agent_status`、`hardware_info`、`load_canvas`、`node_defs`、`take_restored_ui_state` | 変更も秘密もない |
| 利用者自身のデータ | `create_board`、`update_board`、`delete_board`、`update_images`、`delete_images`、`save_comic`、`delete_comic`、`save_canvas`、`adopt_ui_state`、`save_ui_state`、`save_workflow`、`delete_workflow` | データフォルダ内の名前と JSON をバックエンドが検査する |
| キュー | `enqueue`、`cancel_queue_item`、`cancel_batch`、`cancel_pending`、`clear_queue`、`prune_queue`、`pause_processor`、`resume_processor`、`retry_queue_item` | リクエストが画像を指せるのはギャラリーの名前だけで、それ以外は断る |
| インストール、モデル、パック | `install_model`、`cancel_install`、`update_model`、`delete_model`、`install_pack`、`cancel_pack`、`install_node_pack`、`cancel_node_pack`、`remove_node_pack`、`switch_comfy_version`、`delete_unfinished_downloads`、`prepare_watermark`（開始のみ。ページが状態をポーリングする） | アプリと同じ検査: https のみ、ホストは完全一致、フォルダは固定、削除できるのは一覧の未完了ファイルだけ。`install_model` は `api::install_model_remote` を通り、ローカルのファイルパスを断る。すべて `LOOPBACK_ONLY` |
| モデルのサイト、レジストリ | `list_hugging_face_files`、`search_civitai`、`civitai_samples`、`check_model_updates`、`comfy_versions`、`node_pack_versions`、`registry_nodes`、`node_pack_info`、`face_rig_preview` | アドレスはバックエンドで固定、名前もそこで検証 |
| エンジン設定 | `restart_engine`、`set_low_memory_mode`、`set_engine_settings`、`remove_model_root` | 各値は書く前に検査（パッケージは `nvidia` か `amd`、タイムアウトは範囲内）。パスは足せない（`add_model_root` はダイアログ要） |
| キー | `set_hf_token`、`set_civitai_key` | 書き込み専用。Windows 資格情報マネージャーに保存して返さない（`has_*` は設定済みかだけ） |
| アプリ外のページ | `open_civitai_page`、`open_huggingface_page`、`open_source_page` | `api::page_url` がアドレスを返す（デスクトップシェルと同じ許可リスト 1 つ）。ページは新しいタブで開く |
| アシスタント | `agent_login`、`agent_endpoint_save`、`agent_endpoint_models`、`agent_endpoint_test`、`agent_chat`、`agent_tool_result`、`agent_cancel`、`lookup_reference` | バックエンドがアドレス、モデル、キーを検査する（キーは DPAPI で保存し、返さない）。ツール呼び出しはイベントでページに届き、`agent_tool_result` で戻る |

それ以外のコマンドは 501「not available in the browser yet: <command>」で答える（`HttpBackend` が throw）。ダイアログを開くか、ページが選ぶ場所に作用し、生成には要らない。`scan_folder`、`add_model_root`（ダイアログで選ぶ）、`export_images` と `reveal_export_folder`（`/export/images` のダウンロードで代わる）、`save_images`（ダウンロードは `/novira-image/full/` の原本）、`create_backup`、`open_backup`、`confirm_restore`、`discard_restore`（復元はデータフォルダを置き換える）、`check_watermark_file`（ファイルダイアログ）、`set_ui_zoom`（ブラウザがズーム）、`upload_image`（本体は `/upload/image`）。

### クライアント

`HttpBackend` は Tauri クライアントと同じ引数名で `{...}` を `/api/<command>` に、画像を `/upload/image` に POST する（ページ上の画像は先に保存する）。書き出しの応答はブラウザのダウンロードに渡し、最初の読み取りの前に `/events` を開く。Tauri クライアントのキューのミラーを持ち、切れたソケットは 1 秒後に開き直してキューを読み直す。契約テスト（`frontend/src/backend/http/commands.contract.test.ts`。呼び出し表は Tauri 側のテストと共有の `frontend/src/backend/calls.testkit.ts`）が `api.rs` と `commands.rs` を読み、`HttpBackend` が送る名前がそこにあることを確かめる。

## 境界

| 境界 | 守り |
|---|---|
| 接続できる者 | リスナーは `127.0.0.1`（平文の HTTP）に bind。家庭内ネットワークは必要なときに開き（01-browser-server-lan.md）、tailnet は持ち主がオンにした間だけ開く（03-browser-server-remote.md）。ほかのサイトのページと、127.0.0.1 を指す DNS 名は `Host` 検査で断る。ループバックでは `127.0.0.1:<port>` と `localhost:<port>` だけが通る。 |
| 呼び出せるページ | `Host` は 1 つ、`Origin` と `Sec-Fetch-Site` は多くても 1 つ（違えば 400）。`Origin` は `http://<そのリクエストの Host>`（TLS では `https://`）、`Sec-Fetch-Site` は `same-origin` か `none` のみ。 |
| トークン | 起動ごとのランダムな 64 桁の 16 進トークン（UUID v4 を 2 つ）を全リクエストで要求する。ヘッダー `x-novira-token`、または最初のページ読み込みが設定する Cookie `token_cookie`（名前はポートごと。`HttpOnly`、`SameSite=Strict`、`Secure` は TLS のみ）。`?token=` が通るのは Cookie を設定する `GET /` だけで、ページはその後アドレスから消す。家庭内ネットワークの端末はセッションを使う（02-browser-server-pairing.md）。比較は定数時間。トークンは起動したプログラムのコンソールに 1 度だけ出し、ログには書かない。 |
| イベント、アップロード、書き出し | `/events`、`/upload/image`、`/export/images` もほかのルートと同じ検査を通り、`Origin` 検査はアップグレードにも効くので、ほかのサイトのページはソケットを開けず、画像を POST できず、書き出しも求められない。アップロードは `application/octet-stream`、書き出しは `application/json` だけを受けるので、クロスサイトのフォームや `fetch` はプリフライトなしに送れない。`connect-src` は `'self'` に加えて `ws://<検査済みのリクエストの Host>` を挙げる。 |
| コマンド | 実行するのは `SERVED` の名前だけ。引数は共有層の検査（形、余分なし、バックエンドの検証）を通る。未知の名前は 404、既知だが提供しないものは 501 で何もしない。`LOOPBACK_ONLY` はループバックの相手にだけ実行（01-browser-server-lan.md）。本体は 32 MiB まで。接続数の上限（`MAX_CONNECTIONS`）と遅いリクエストヘッドの切断（`HEADER_READ_TIMEOUT`）で、大量送信に耐える。 |
| 画像 | 名前だけで、デスクトップのスキームと同じ判断を通す。パス、`..`、区切り文字、画像でない名前は届かない。読み取り専用（`GET`）。 |
| ファイル | `--dist` 内の既知の種類のファイルだけ。各セグメントはパーセントデコードし、空、`.`、`..`、区切り文字・ドライブのコロン・制御文字を含むもの、末尾がドットか空白のもの、Windows のデバイス名を断る。解決したパスは `--dist` 内に収まること。一覧もフォールバックもない。 |
| ページの内容 | すべての応答に、デスクトップアプリと同様の `Content-Security-Policy`（自分のオリジン、画像用のモデルサイト、`connect-src 'self'`、`unsafe-eval` と `*` なし、`frame-ancestors 'none'`）、`X-Frame-Options: DENY`、`nosniff`、`no-referrer`、`Cross-Origin-Resource-Policy: same-origin` を付ける。目印のスクリプトは外部ファイルなので `script-src` に例外は要らない。 |

テスト: `backend/crates/novira-server/tests/`（`auth.rs`、`commands.rs`、`served.rs`（グループごと）、`events.rs`、`upload.rs`、`export.rs`、`files.rs`、`lifecycle.rs`。共有クライアントは `common/`）は、サーバーをプロセス内の空きポートで起動し、生の HTTP クライアントで上の表の各守り、イベント、停止、ロックを調べる。ページ経由の実エンジン実行は `docs/verification.md` の "Through the browser server"、共有層は `backend/crates/novira-core/tests/backend_service/api.rs`。

## 既知の限界

- トークンはプログラムが表示するアドレスに入っており、そのコンソール出力を読める者は動いている間サーバーを使える。トークンは起動のたびに変わる。
- ループバックは平文の HTTP: この PC 上の同じ利用者の別のプログラムは接続でき、トークンがあればバックエンドを操作できる。トークンと `Host`/`Origin` の検査が防ぐのは Web ページで、ローカルのプログラムではない。
- `SERVED` にはダイアログなしの書き込み（利用者のデータ、インストール、ダウンロード、エンジン設定、キー、アシスタント）がある。この PC ではトークンがあればウィンドウと同じことができ、破壊的なもの（`delete_board`、`delete_images`、`delete_comic`、`delete_model`）もアプリと同じく無防備。家庭内ネットワークの端末は安全な部分集合だけ使える（01-browser-server-lan.md）。
- `--open` は、アドレス（トークン込み）を一瞬 `rundll32.exe` のコマンドラインに載せる。同じ利用者の別のプログラムがプロセス一覧から読める。
- 画像 URL は相対なので、このサーバー以外が配信するページには出ない。
- ダイアログがないので、バックアップと復元、フォルダのスキャン、モデルフォルダの追加、ファイルの検査は提供せず、コントロールがその旨を表示する（`hasNativeDialogs`）。
- アプリ外のページは応答の後に開くので、応答に数秒かかるとブラウザがタブをブロックすることがある。
- イベントは保存しない。離れていたページは再接続でキューを読み直すが、その間の進捗とログは失われる。
