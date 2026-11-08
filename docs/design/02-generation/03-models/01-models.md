---
covers:
  - backend/crates/novira-core/src/models/**
  - backend/crates/novira-core/src/service/model_store.rs
  - backend/crates/novira-core/src/service/keys.rs
  - backend/crates/novira-core/src/secret.rs
  - backend/crates/novira-core/src/endpoints.rs
  - backend/crates/novira-core/src/unfinished.rs
  - backend/crates/novira-core/src/settings.rs
  - frontend/src/features/models/**
  - frontend/src/features/settings/CivitaiKeyControl.tsx
---
# モデル

一覧に戻る: [README.md](README.md)

モデル機能は、ComfyUI が読み込むモデルファイル（チェックポイント、LoRA、VAE、ControlNet、アップスケーラー、拡散モデル）と、[02-model-packs.md](02-model-packs.md) とあわせて、メディアの種類によっては必要になる追加のモデルパックを扱う。ディスク上のファイルを一覧し、それぞれを分類し、ソースから新しいファイルをインストールし、Civitai と Hugging Face のキーを保持する。この 2 サイトの検索（Browse タブ）は [04-browse.md](04-browse.md)。

## 動作

- **フォルダ。** 最初のモデルルートは `<data>/models`。`modelRoots`（`settings.rs`、16 個まで）のフォルダがそれに続き、すべて起動時にスキャンする。ComfyUI のフォルダ名（`checkpoints`、`loras` など）と Stability Matrix の名前（`StableDiffusion`、`Lora`、`LyCORIS` など）の両方を認識する（`models/layout.rs`）。拡張子が `safetensors`・`ckpt`・`pt`・`pth`・`bin`・`gguf`・`sft` のファイルをモデルとする。
- **ComfyUI のパス。** ルートとパックの節（データフォルダのもの、およびその他の各ルートに存在するパックフォルダは `novira_<kind>_<n>`）を、起動時に `<data>/extra_model_paths.yaml` へ書くので、アプリ所有の ComfyUI も同じ名前を一覧する。外部の ComfyUI（`comfyuiUrl`）では、利用者が同等のパスを設定する。ジョブの実行前に、エンジンはジョブが挙げるモデルをすべて ComfyUI が一覧していることを検査し、そうでなければ読める理由つきで失敗する（`check_models`、`comfy/client.rs`）。
- **種類とベース。** スキャンしたファイルの種類はフォルダで決まる。インストールでは、種類をスターターの項目か利用者の選択から取り、次に safetensors のヘッダ（テンソル名）、次にサイトが宣言する型（リモートのファイル）、最後にファイル名（`classify::kind_from_name`: `.pth`、`.gguf`、`lora`・`vae`・`umt5` などの語）から取る。ヘッダにより、チェックポイント（自前の VAE とテキストエンコーダを含む）と、単体の拡散トランスフォーマー（`diffusion_models`）、テキストエンコーダ（`text_encoders`）、VAE、LoRA、ControlNet、IP-Adapter、CLIP vision モデル、ESRGAN 系のアップスケーラー、モデルパッチ（`model_patches`: Anima LLLite、Qwen-Image と Z-Image の Fun ControlNet。ComfyUI の `ModelPatchLoader` が読むテンソルで区別）を見分ける。拡散トランスフォーマーや LoRA のファミリーはテンソル名から読む（`classify::detect_architecture`）: Flux、FLUX.2、Chroma、Anima、Qwen-Image、Z-Image、HiDream、AuraFlow、SD3、HunyuanImage、Hunyuan-DiT、Wan、HunyuanVideo、HunyuanVideo 1.5、LTX-Video、LTX-2。GGUF は名前から取る。ファミリーの派生（Flux Fill と Kontext、Qwen-Image-Edit、Wan VACE、ほかの入力を要する Wan モデル）は、ジョブを組むときにテンソルか名前で見分ける（`classify::detect_variant`）。LoRA は、トレーナーが誤ったアーキテクチャを書く（sd-scripts の Anima トレーナーは `stable-diffusion-v1/lora` と書く）ので、メタデータよりファミリーのテンソルを優先する。LLM アダプタに触れない Anima LoRA は、Cosmos ブロック（`adaln_modulation_self_attn`）で見分ける。ほかの種類のベースはヘッダから取る。`modelspec.*` と `ss_base_model_version` のメタデータ（後者に新しいファミリーの名前があればそれを数える）、次にテンソル名、次にファイル名。名前からファミリーが決まらない VAE は、デコーダが 4 つの潜在チャンネルを取る（`decoder.conv_in.weight`）なら SD 1.x とし、16 チャンネルのファミリーには出さない。読むのはヘッダだけで、重みは読まない。起動時に、`<data>/models` の下のチェックポイントのフォルダにあるファイルのうちヘッダが別の種類（IP-Adapter、LoRA、ControlNet、CLIP vision、VAE、拡散モデル、テキストエンコーダ、モデルパッチ）を示すものは、その種類のフォルダへ移す（`layout::move_misfiled`。同名があれば動かさない）。読み終えたファイルは、パス・大きさ・更新時刻（ミリ秒）をメタ `misfiled_checked_1` に JSON で残し、三つとも同じファイルは次の起動でヘッダを読み直さない（記録が壊れていれば全ファイルを一度読み直す）。`split_job` と `model_parts` は、モデルを複製して状態のロックの外でヘッダを読む。生成タブが動かすのは、SD 1.x・SD 2.x・SDXL のチェックポイント、Hunyuan-DiT のチェックポイント、Anima・Flux・FLUX.2・Chroma・Qwen-Image・Z-Image・SD3・HiDream・AuraFlow・HunyuanImage の拡散モデルとチェックポイント（インストール済みのモデルから見つけたテキストエンコーダと VAE とともに。[01-generation.md](../01-pictures/01-generation.md)）。ほかのベースはワーカーがベース名を挙げて拒否する（ワークフローエディタでは ComfyUI 自身のローダーノードで使える）。
- **レコードとキー。** モデルのキーはそのフォルダと ComfyUI 名のハッシュ（`registry::key_for`）で、再スキャンしても変わらない。再スキャンは、保存済みのレコードを利用者の編集つきで保ち、サイズやパスが変わったときだけファイルの事実を更新する。LoRA 検出の修正ごとに一度（`service/mod.rs` の `LORA_BASES_CHECKED_META`）、起動時に SD ベースで保存された LoRA のヘッダを読み直し、テンソルが新しいファミリーを示すものを移す（`registry::corrected_lora_bases`）。その後は利用者が設定したベースが残る。`any` で保存されたレコードにも同じ一度きりの検査をする（`registry::corrected_any_bases`）。`update_model` は `key`・`path`・`size`・`comfy`・`type`・`format` へのパッチを無視する。
- **インストール済み一覧。** `bootstrap` はインストール済みのモデルを返す。インストールはレコードを加えて `ModelAdded` を出す。各ジョブの状態（待機、ダウンロード中、実行中、完了、キャンセル、エラー）は `ModelInstall` イベントとして出る。
- **カバー。** カードはレコードの画像（Civitai の照会かインストールから）を出し、画像のない種類にはアイコン、画像のある種類で画像がない場合も同じアイコンを出す。カバーはすべて同じ形で、1 行のカードは最も高いものに揃える。`civitaiLookup` がオフのとき、手でフォルダに置いたファイルには設計上画像が付かないので、照会がオフで、画像のある種類のモデルに画像がないものが 1 つ以上あるときは、モデル画面がグリッドの上に注意書きを 1 つ出す（`CoverHint`）。そのボタンは設定のエンジンタブを開く。注意書きはカードには描かない。
- **画像と元のページ。** レコードは Civitai のバージョンの全画像（`coverImageUrls`。カバーが先頭、最大 8 枚、カバーだけなら空）と、モデル自身のページ（`pageUrl`: `civitai.com/models/<id>?modelVersionId=<id>`、または Hugging Face のインストールの `huggingface.co/<repo>`）を保持する。どちらもインストール時とハッシュ照会で埋める（`covers_checked_4` は、カバーはあるがページがないモデルを一度だけ再照会する）。詳細パネルは固定の形（2:3、画像全体が枠に収まる。Browse タブの詳細と同じ）の枠で画像をめくるので、別の形の画像でもパネルの大きさは変わらない。生成タブのモデルや LoRA の拡大表示（`ui/CoverImage.tsx`）も、矢印と矢印キーで画像をめくる。ページはリンクとして一覧し、開くときは `openSourcePage` を通り、モデルサイト上の https のアドレスだけを受け付ける。ページが分からないモデルにはリンクを出さない。
- **削除。** `<data>/models` の下のファイルは削除する。それ以外のルートのファイルは、同じファイルが再びインストールされるまで隠すだけ。
- **フォルダスキャン。** `scan_folder` は引数を取らない。シェルがネイティブのフォルダダイアログを自分で開き（`backend/src-tauri/src/commands.rs`、`backend/src-tauri/src/dialogs.rs`。利用者がキャンセルすると応答は `null`）、選んだフォルダのモデルファイルを一覧し、すでにインストール済みのもの（同じパス、または同じ名前とサイズ）に印を付ける。何もインストールしない。シェルは見つけたパスを覚えており（`ScannedModels`。スキャンのたびに置き換える）、`install_model` が受け付けるローカルパスはそれだけ。画面にあるのはテキスト欄ではなくボタン。
- **インストールのソース。** `install_model` は次の形だけを、何かを書く前に `models::install::parse_source` で厳密に解析して受け付ける。
  - `civitai:<model>/<version>-<file>`（Browse タブ）
  - `https://civitai.com/models/<id>[?modelVersionId=<v>]`（指定のバージョン、なければ最初のもの。主ファイル、なければ最初のもの）
  - Hugging Face の `owner/repo::path`（リポジトリの 1 つのモデルファイル）
  - ほかの `https` アドレス。`http` は `localhost`・`127.0.0.1`・`[::1]` に限る
  - この PC 上のモデルファイルへの絶対パス。直近のフォルダスキャンが挙げたものに限る。それ以外のローカルパスはコマンドが拒否するので（`source_is_allowed`）、ページが入力したファイルをバックエンドに読ませることはできない。そのため URL タブ（`InstallFromSource.tsx`）はドライブ・共有・絶対パスを送らず、フォルダスキャンへ誘導する。失敗したインストールは入力したテキストを保持し、フォルダスキャンタブは失敗したスキャンを表示し、ブラウザサーバーではデスクトップアプリが要ると伝える。

  `owner/repo` だけの指定は、diffusers 形式のリポジトリとして拒否する。
- **ローカルファイル** は、可能ならその種類のフォルダへハードリンクし、できなければコピーする（`install::link_or_copy`）。同じ名前のファイルがすでにあれば拒否する。
- **リモートのダウンロード。** 先にファイル名を検査する（`safe_file_name`: モデルの拡張子、先頭にドットなし、区切り文字・制御文字・Windows のデバイス名なし、200 文字まで）。バイトは `<data>/models/.downloads/<job>.part` へ書き、完了したら所定の場所へ移す。60 秒間データが来ない場合、または告知されたサイズより前に終わった場合は失敗する。止まったダウンロードは `.part` と `.resume` レコードを残し、`download_with_stall` は `Range` と `If-Range` で残りだけを求める。part の名前はジョブではなくソースで決まる（`install::part_name`: ソーステキストのハッシュ）ので、同じソースのインストールを再び始めると、止まったものの part とレコードから続ける。同じソースの 2 つのインストールが同時に動くことはない。最初のものが待機中・ダウンロード中・実行中の間は 2 つ目を拒否する。部分ファイルは設定 → データで一覧・削除する（`unfinished.rs`）。
- **キーとトークン。** Civitai のキーと Hugging Face のトークンは設定で入力し（`CivitaiKeyControl.tsx`、`set_civitai_key`、`set_hf_token`）、Windows の資格情報マネージャーに保存する。1 つずつ `novira/<データフォルダの id>/civitai` と `/huggingface` という名前の項目になる（`secret.rs`。id は `<data>/secrets/store-id` で、フォルダとともに移動するので、別のデータフォルダがこれらのキーに触れることはない）。旧版が `secrets/civitai.key` や `huggingface.key` として保存したキーは、最初に読むときに資格情報マネージャーへ移し、ファイルは削除する。画面が知るのは設定されているかどうかだけ。`settings.json` の平文の `civitaiApiKey` は、保存済みのキーがない間の Civitai キーの代替で、保存済みのキーを消すと、次の起動までその代替も外れる。
- **キーの送り先。** Civitai のキーは、Civitai の API（検索、モデル、バージョン、ライセンス、カバーの照会）と、API が返すダウンロードアドレスへ送る。そのアドレスは `civitai.com` かそのサブドメインの `https` でなければならない（`is_civitai_download`。API をこの PC 上の偽サーバーに向けるデバッグビルドでは、そのサーバー自身のアドレスも）。応答にあるほかのアドレスは「unexpected download address」で拒否し、キーは送らない。直接の URL に送るのは、`civitai.com` かそのサブドメインの `https` のときだけ。Hugging Face のトークンは、Hugging Face の API（検索、一覧、カバー、ライセンス）、`huggingface.co` のダウンロード、音声パックのダウンロード（[03-voice.md](../04-media-screens/03-voice.md) を参照）へ送る。ほかのパックはトークンを送らない。

## 境界

| 境界 | ガード |
|---|---|
| モデルのダウンロード | ソースは厳密に解析する（`models::install::parse_source`）。`https` のみ（平文の HTTP はこの PC に限る）、Hugging Face のリポジトリとパスは平易な名前の部品で、ドットだけのパス部品はなし。何かを書く前にファイル名を検査する（`safe_file_name`: モデルの拡張子のみ、制御文字なし、Windows のデバイス名なし）。Hugging Face リポジトリのモデルファイルの一覧（`list_hugging_face_files`）は、平易な `owner/name`（上記と同じ検査）を取り、トークンがあれば付けて `/api/models/<repo>` に問い合わせ、単一のモデルファイルだけを残す。何もダウンロードしない。デバッグビルドに限り、`NOVIRA_TEST_<SERVICE>_BASE` でサービスを `http://127.0.0.1:<port>` か `http://localhost:<port>` に向けられる。ほかの値は無視し、本物のホストに対する検査は残る。 |
| 通信中の秘密 | キーは bearer ヘッダで送り、URL には入れず、「キーの送り先」に挙げた場所にだけ送る。直接の URL に送るのは、所有するサイトかそのサブドメインの `https` のときだけ（`host_is`）。名前にサイト名を含むだけのホストには送らない。Civitai API が返すダウンロードアドレスも同じ検査（`civitai.com` の `https`）に通らなければ、インストールを拒否する。HTTP クライアントは、別のホストへのリダイレクトで認証情報を捨てる。 |
| 保存中の秘密 | Civitai のキーと Hugging Face のトークンは Windows の資格情報マネージャー（現在のユーザー、この PC のみ）にある。ほかの秘密（アシスタントのサーバーキー、署名キー、ホームネットワークの CA キー）は、`novira-data/secrets/` の下で Windows DPAPI（現在のユーザー、アプリ固有のエントロピーつき）で暗号化する。フロントエンドへは返さない。フロントエンドが問い合わせられるのは設定されているかどうかだけで、置き換えと削除ができる。 |

## 既知の限界

- 資格情報マネージャーと DPAPI が守るのはほかの Windows ユーザーに対してで、同じユーザーとして動く別のプログラムに対してではない（そのプログラムは項目を読める）。1280 文字を超えるキーは拒否する（資格情報マネージャーの上限）。
- 資格情報マネージャーの項目（`novira/…`）は、データフォルダを手で削除しても消えない。資格情報マネージャーで削除する。
- モデルファイルは ComfyUI のローダーにとってのデータ。`.ckpt` / `.pt` ファイルは pickle されたコードを含みうるので `.safetensors` を勧め、pickle 形式のファイルは信頼できるソースから取るべき。inpaint パックの `big-lama.pt` がそのようなファイル。
- ローカルモデルの Civitai 照会（`civitaiLookup`、既定でオフ）は、各モデルファイルの SHA-256 を Civitai へ送り、キーが保存されていればそれも送る。ファイルは、カバーとライセンスの両方のために 1 回の実行で一度だけハッシュする。オンにするのは利用者の同意で、次の起動から有効になる。
- 未完了のダウンロードは、止まったダウンロードが part と `.resume` レコードを残すので、利用者が削除するまでディスクに残る。別のプログラムが開いている part は削除できないことがあり、その場合は一覧に残る（ComfyUI のダウンロードも一覧に出る。[02-extensions.md](../../01-app/03-engine/02-extensions.md) を参照）。
