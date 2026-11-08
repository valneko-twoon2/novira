---
covers:
  - backend/crates/novira-core/src/comfy/node_packs.rs
  - backend/crates/novira-core/src/comfy/node_packs/**
  - backend/crates/novira-core/src/comfy/registry.rs
  - backend/crates/novira-core/src/comfy/install.rs
  - backend/crates/novira-core/src/comfy/switch.rs
  - backend/crates/novira-core/src/comfy/client.rs
  - backend/crates/novira-core/src/service/node_pack_store.rs
  - backend/crates/novira-core/src/endpoints.rs
  - backend/src-tauri/src/command_list.rs
  - frontend/src/state/comfy/nodePacks.ts
  - frontend/src/state/comfy/registry.ts
  - frontend/src/state/comfy/packCatalog.ts
  - frontend/src/state/comfy/versions.ts
---
# ComfyUI の拡張機能

一覧に戻る: [README.md](README.md)

拡張機能は、ComfyUI が自前のノードに加えて読み込むカスタムノードの集まり。ここでは、novira 自身がインストールして動かす ComfyUI のリリースも扱う。この機能は、GitHub から拡張機能をインストール・更新・削除・再起動し、ComfyUI Registry の拡張機能を一覧し、ComfyUI のパッケージをインストール・切り替える。モデルファイルは [01-models.md](../../02-generation/03-models/01-models.md)、拡張機能のノードを使うグラフは [01-generation.md](../../02-generation/01-pictures/01-generation.md) に書いてある。

## 動作

### カスタムノードの拡張機能

- 拡張機能は ComfyUI の `custom_nodes` のフォルダ。`node_packs::list` は、名前が `.` で始まるもの、`__pycache__`、`.disabled` で終わるものを飛ばす。novira がインストールした拡張機能には、リポジトリのアドレスとタグ（既定ブランチならタグなし）を持つマーカーファイル `.novira-pack.json` がある。手で置いた拡張機能にはどちらも無く、アドレスなしで一覧に出る。
- 拡張機能を管理できるのは、novira が ComfyUI のフォルダとその Python を知っているときだけ（`NodePacks.available`）。自前のコピーか `comfyuiDir` のとき。それ以外は一覧が空で、インストールと削除は拒否する。Python は、設定されていれば `comfyuiPython`、なければフォルダの `venv` か `.venv`、なければポータブルパッケージの `python_embeded`。どれも無ければ拡張機能は使えない。
- インストール（`install_node_pack`、任意の `version` つき）: アドレスは `https://github.com/<owner>/<repo>` でなければならない（`parse_github`。末尾の `.git` やスラッシュは許す）。アーカイブは `codeload.github.com` から、既定ブランチ（`zip/HEAD`）かタグ（`zip/refs/tags/<tag>`）を取る。インストールはバックグラウンドで、リポジトリごとに 1 つ動く（同じ拡張機能の 2 つ目の要求はすぐ返る）。進捗は `node_pack` イベントで届き、`cancel_node_pack` で止める。
- 手順は次の順。アーカイブを `custom_nodes` の隠し `.novira-<uuid>` フォルダにダウンロードする。ComfyUI の Python で展開する。リポジトリの `.gitmodules` にある各サブモジュールを取得する（GitHub のみ。そのタグでリポジトリが記録するコミットに固定し、無ければ `HEAD`）。マーカーを書く。同名のインストール済みフォルダを脇に移し、新しいものを移し入れる（Windows がアクセスを拒む間は最大 8 回再試行）。ComfyUI の PyTorch 系パッケージ（`torch`、`torchvision`、`torchaudio`、`xformers`）をインストール済みのバージョンに保つ制約の下で、pip で requirements をインストールする。`install.py` があれば実行する。移動のあとで手順が失敗したら、古いフォルダを戻す。作業フォルダは、脇に移す前に置き換え対象のフォルダ名を記録する（`replaces`）。作業フォルダが残っている起動（インストールが途中で切れたもの）は、置き場所が空なら脇に移した拡張機能を戻し、作業フォルダを削除する（`node_packs::recover_installs`）。
- 拡張機能の要件（`node_packs.rs`）: `extra_requirements` は、拡張機能が必要としながら列挙していないライブラリを足す（Nekodificador の NKD Basic Tools には `opencv-python-headless`、1038lab の ComfyUI-RMBG には Windows で `triton-windows`）。`skipped_requirements` は、動作中の ComfyUI が持つファイルを置き換える行や、固定したライブラリを壊す行を除く（Fannovel16 の comfyui_controlnet_aux の `mediapipe` と `albumentationsx`）。cv2 が入っているときは pip が先に計画を立て、他の OpenCV を外す（`plan_without_second_opencv`）。残りは固定して `--no-deps` で入れる。拡張機能自身の `requirements.txt` は変えない。インストール済みの拡張機能を置き換えるときは、先にそれを脇に移し、新しいコピーを置けないときや後の手順が失敗したときは古いものを戻す。
- `node_pack_versions` は最新 50 個のタグを新しい順に返す。`node_pack_info` は作者、ライセンス（SPDX id）、説明、スター数を返す。
- `remove_node_pack` は `custom_nodes` の直下にあるプレーンなフォルダ名 1 つを削除する。
- `restart_engine` は ComfyUI を止めて起動し、変更した拡張機能を読み込ませる。ジョブが進行中は拒否する。novira が起動する ComfyUI（自前のコピーか `comfyuiDir`）で働く。`comfyuiUrl` だけで指定したサーバーは、利用者が再起動する。インストールの完了と削除で `restartNeeded` が立ち、再起動で消える。
- ComfyUI Registry（`registry_nodes`、`comfy/registry.rs`）: `api.comfy.org/nodes` を 1 ページ 100 個、最大 200 ページ、同時 16 リクエストで読む（現在の 60 ページで約 4 秒。同時 6 では約 9.5 秒、2026-10-13 計測）。リポジトリが GitHub にある有効な拡張機能だけを残し、ダウンロード数で並べる。一覧はメモリと、データフォルダの `cache/registry-nodes.json` に保つ（一時的な名前で書き、新しい応答と同じ検査をして読み戻し、40 MB を超えては読まない）。1 時間より新しい一覧はそのまま返す。それより古いもの（メモリ上のものも、以前の起動からのディスク上のものも）はすぐ返し、バックグラウンドで読み直す（同時に 1 回。失敗した読み直しは古い一覧を残す）。サイトを待つのは、コピーが無いときの最初の読み込みと `refresh` だけ。そこからのインストールは、GitHub アドレスからのインストールと同じ呼び出し。
- 拡張機能のルート: `node_packs::PACK_ROUTES` は `nkd/facerig/` を挙げる。Face Rig エディタが `pack_call` 経由で呼ぶルートで、他のルートは拒否する。`route_allowed` は `..`、`//`、`?`、`#`、`\`、`%`、制御文字も拒否する。

### ComfyUI 本体

- Windows のみ。novira 自前の ComfyUI が無いときは、ComfyUI が初めて必要になったときにインストールする。起動時にバックグラウンドで（`prepare_engine`）、ジョブや拡張機能の要求の前にも。パッケージは `comfyuiPackage`（既定は `nvidia`、または `amd`）が指す公式のポータブルリリースで、`github.com/comfyanonymous/ComfyUI/releases/latest/download/` から取る。7-Zip のコンソールツール `7zr.exe` は `www.7-zip.org` から 1 回だけ、インストール先の `.tools` フォルダに取得する。
- アーカイブは `.part` の名前でダウンロードし、完成したら名前を変えて、`.unpacking` フォルダに展開し、`portable` フォルダを所定の場所に移す。展開に失敗しても、完成したアーカイブは残す。ただし 7-Zip が壊れていると報告したときは削除して取り直す。各移動は、Windows がアクセスを拒む間（ウイルス対策が新しいファイルを握る）、1 秒おきに最大 60 回試す。
- 進捗は `engine_status` で報告する: `downloading`（バイト数つき）、`extracting`、`starting`、`ready`、`error`。
- インストール元のパッケージは `portable/novira-package.txt` に書く。この記録が無いインストールは、最初に必要になったとき、設定が指すパッケージのものとみなす（`adopt_package`）。
- パッケージの変更: 記録が設定と別のパッケージを指しているとき、次の起動（ComfyUI が初めて必要になったとき）に、設定のパッケージから同じ ComfyUI バージョンを下で述べる切り替えでインストールし、そのあと起動する。新しいパッケージが起動しないときは古いものを戻す。設定は変更を保存する前に確認を求める（[01-settings-engine.md](01-settings-engine.md) を参照）。
- バージョンの切り替え: `comfy_versions` は `comfyanonymous/ComfyUI` の最新 50 リリースを、ドラフト、プレリリース、プレーンなタグでない名前を除いて返す。`switch_comfy_version`（`comfy/switch.rs`）は、ジョブの進行中や拡張機能のインストール中は拒否し、novira が作ったインストールにだけ働く。ComfyUI を止め、現在の `portable` フォルダを `.previous` として残してリリースパッケージをインストールし、古い拡張機能のフォルダを新しい `custom_nodes` に移す（両方にフォルダがあるときは新しいパッケージのコピーを残す。`__pycache__` は移さない）。マーカーのある拡張機能はすべて記録したタグで入れ直し（手で置いたものは移すが入れ直さない）、ComfyUI を起動して、`.previous` を削除する（先に `.previous-discarded` に名前を変える）。入れ直しに失敗した拡張機能はフォルダ名で報告し、切り替えは取り消さない。ComfyUI が起動しないときや切り替えがキャンセルされたときは、拡張機能のフォルダを `.previous` に戻し、それを元に戻し、古いバージョンを起動して、エラーでそう伝える。`.previous` が残っている起動（切り替えが途中で切れたもの）は、エンジンを起動する前に同じ方法で戻す（`install::recover_switch`）。
- 拡張機能の Python の手順（展開、pip、`install.py`）は、データフォルダの `cache` フォルダの下にキャッシュ（`PIP_CACHE_DIR`、`HF_HOME`、`TORCH_HOME`、`TEMP`、`TMP`）を置き、コンソールウィンドウなしで動かす（`node_packs.rs` の `confine`）。

### 生成で拡張機能が要るもの

- 参照画像には `ComfyUI_IPAdapter_plus`（ノード `IPAdapterAdvanced`）が要る。`validate` は何かをアップロードする前にそのノードを確かめるので、拡張機能の無いジョブはすぐ失敗する。参照画像の通知（`frontend/src/features/params/refImages/RefImagePackNeeds.tsx`）はインストールを勧め、そのあと再起動を求める。
- マンガ仕上げ（ビューアのツールバーの「マンガ原稿に仕上げる」）: すでにある画像への手順で、描画の一部にはならない。`frontend/src/features/viewer/manga/` が `graphRequest` と `runJob` でグラフのジョブを走らせる（専用の IPC コマンドはない）。`LoadImage` から、ComfyUI-MangaScreen 拡張機能の `MangaFinish` ノード 1 つ（スクリーン線、白点、黒点、階調、白線。ノードのトーンとペンの既定は固定）を経て `SaveImage` へ。試行は `intermediate` の画像になるのでギャラリーの一覧には出ない。保存は同じグラフを `gallery` の保存先で元の画像のボードに走らせ、元のプロンプト、モデル、シードを引き継ぎ、ワークフロー名がダイアログの題（ja では「マンガ原稿に仕上げる」）の新しい通常の画像にする（元は変えない）。値は `useMangaFinish`（`state/mangaFinish.ts`、`novira.mangaFinish` に保存）。拡張機能は `ComfyUI-MangaScreen`（MIT、カタログ id `mangascreen`）で、無いとき、またはインストール済みでも未読み込みのときは、ダイアログがインストール、続いて再起動を示し、試行と保存を無効にする。ワイヤ型には `GenerationMetadata.mangaScreen` が残り、`graph.rs` も `MANGA_NODE` を組み立てるが、どの画面ももうこれを送らない。フォームの `manga` キーと漫画の保存済み `manga` 描画設定は、読んでも無視する。

## 境界

| 境界 | ガード |
|---|---|
| カスタムノードの拡張機能とそのバージョン | `https://github.com/<owner>/<repo>` だけで、owner とリポジトリの名前はプレーンなもの（`node_packs::parse_github`）。バージョンはプレーンな文字（英数字、`.`、`_`、`-`、`+`。`..` なし、`-` や `.` で始まらない、最大 100 文字。`node_packs::valid_tag`）のタグ名で、コマンドで検査し、アーカイブのアドレス `codeload.github.com/<owner>/<repo>/zip/refs/tags/<tag>` を組み立てる前にもう一度検査する。バージョンの一覧（最新 50 タグ）は `api.github.com/.../tags` から取り、1 MB を上限とし、プレーンなタグでない名前は捨てる。`node_pack_info` はリポジトリの記録を `api.github.com` から読み、作者、ライセンス id（最大 40 文字、`NOASSERTION` は捨てる）、説明（300 文字に切る）、スター数を得て、ページはそれをテキストとして示す。`registry_nodes` はレジストリのページ（各 100 個、最大 200 ページ、各 5 MB が上限）を読み、有効でリポジトリが `parse_github` を通る拡張機能だけを残す。すべてのテキストフィールドは長さに切り、制御文字を除く。40 文字を超えるライセンスは捨て、バージョンは `valid_tag` を通さなければならず、アイコンのアドレスは `https` で、ホストがちょうど `raw.githubusercontent.com` か `avatars.githubusercontent.com` のときだけ残す（CSP の下でページが画像としてだけ示せるように）。結果はメモリとディスクにキャッシュする（ディスクのコピーは読むとき再検査する）。そこからのインストールは、GitHub アドレスと同じ検査済みの経路を使う。novira がインストールしたバージョンは拡張機能のマーカーファイルに書き、データとしてだけ読み戻す。 |
| ComfyUI バージョンの切り替え | `switch_comfy_version` は、拡張機能のバージョンと同じプレーン名の検査（`valid_tag`）を通るリリースタグを受け取り、ジョブの進行中や拡張機能のインストール中は拒否し、novira 自身がインストールした ComfyUI にだけ働く（そうでなければエラー）。パッケージは `github.com/comfyanonymous/ComfyUI/releases/download/<tag>/<fixed file name>` から `https` で取る（`endpoints.rs` のアドレスサービス）。最新 50 リリースの一覧は `api.github.com/repos/comfyanonymous/ComfyUI/releases` から取り、1 MB を上限とし、ドラフト、プレリリース、プレーンでないタグは捨てる。展開は初回インストールと同じ 7-Zip のツールと一時フォルダ（`.unpacking`）を使う。古いパッケージは、新しいものが応答するまで `.previous` に残し、応答しなければ戻す。拡張機能のフォルダはインストール先フォルダの中で名前を変えて動かす。 |

## 既知の限界

- ComfyUI のパッケージと `7zr.exe` は、公式のホストから HTTPS で取得し、署名やハッシュの別個の検査はしない。
- 参照画像は、サードパーティのカスタムノードの拡張機能（ComfyUI_IPAdapter_plus。`frontend/src/state/comfy/packCatalog.ts` で `unmaintained` と記されている）のノードを ComfyUI の Python の中で動かす。インストールするのは利用者が求めたときだけで、利用者がタグを選ばない限り GitHub リポジトリの既定ブランチから入れる。
- レジストリの拡張機能の説明と、インストール済みの拡張機能のノードの説明は第三者が書いたもので、`search_extensions` を通してアシスタントのモデルに届く（[01-assistant.md](../../03-assistant/01-core/01-assistant.md) を参照）。指示はそれをデータとして扱うが、モデルが悪意あるテキストに惑わされることはありうる。被害は限られる。アシスタントはインストールも削除も実行もできず、利用者がカードのインストールボタンを押すまで何もインストールされず、要求の変更はすべてすぐ元に戻せる。惑わされたモデルは、利用者が許可していれば、設定とエディタを変え、生成をキューに入れ、プロンプトを読むことはできる。

## 未実装

- カタログの拡張機能のバージョン要件。バージョンを非推奨と印づける検査はある（`frontend/src/state/comfy/versions.ts`）が、拡張機能カタログのどの項目にもまだ `requires` の一覧がない。
