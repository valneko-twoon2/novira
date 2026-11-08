---
covers:
  - backend/crates/novira-core/src/service/queue.rs
  - backend/crates/novira-core/src/service/worker.rs
  - backend/crates/novira-core/src/service/mod.rs
  - backend/crates/novira-core/src/service/guidance.rs
  - backend/crates/novira-core/src/service/memory.rs
  - backend/crates/novira-core/src/comfy/graph.rs
  - backend/crates/novira-core/src/comfy/client.rs
  - backend/crates/novira-core/src/comfy/process.rs
  - backend/crates/novira-core/src/engine.rs
  - backend/crates/novira-core/src/gpu_lock.rs
  - backend/crates/novira-core/src/child_job.rs
  - backend/crates/novira-core/src/media/images.rs
  - frontend/src/state/outOfMemory.ts
  - frontend/src/backend/tauri/TauriBackend.ts
---
# 生成

一覧に戻る: [README.md](README.md)

生成は画像を作る。1 つずつ実行するジョブのキュー、ComfyUI のグラフ、実行できない依頼を断る検査、アプリが持つ ComfyUI プロセスからなる。動画・音楽・音声もキューのジョブである（[01-media-generation.md](../02-media-workflows/01-media-generation.md) を参照）。エンジンのインストールは [02-extensions.md](../../01-app/03-engine/02-extensions.md) にある。

## 動作

### キュー

- 状態は `pending`、`in_progress`、`completed`、`failed`、`canceled`（`backend/crates/novira-core/src/types.rs` の `QueueItemStatus`）。変更は `queue` テーブルへ保存してから通知し、1 件ずつ行う（`move_item`）。終わった項目は二度と動かない。`enqueue` は反復 1 回につき 1 項目を作り、それぞれに専用のシードを付け、全部保存してから返る。保存に失敗したら依頼全体を断る。1000 回を超える反復（`MAX_ITERATIONS`、Invoke の枚数欄の上限）は、項目を作る前に断る。`prepend` は最初の `pending` の前に項目を置く。参照画像、コントロールレイヤー、参照用の画像は項目へコピーする。
- ワーカー（`run_worker`、起動時に 1 回だけ開始）は、キューが一時停止中でなく何も実行していないとき、先頭の `pending` 項目を実行する。ジョブごとに、モデルと画像の解決（`engine_job`、`job_guidance`）、`Engine::validate`、GPU ロック、`Engine::generate`、PNG の保存、`completed` と `image_added`。
- `validate`（ComfyUI のジョブ）は、何かをアップロードする前にグラフを組み立て、ComfyUI の応答と、必要なモデル、ノード、サンプラーの有無を検査する（`comfy/client.rs`）。
- テキスト出力（`PreviewAny` で終わるグラフジョブ）は、画像なしで `resultText` を付けて完了する。グラフジョブは音や動画で終わることもあり、音楽・動画タブの結果と同じように保存する（[03-workflow-graphs.md](../02-media-workflows/03-workflow-graphs.md)）。デバイスのメモリ不足と読める失敗には `errorKind: out_of_memory` を付ける。パニックはそのジョブだけを失敗にする（文言は「Internal error: ...」）。
- 一時停止（`pause_processor`、`resume_processor`）は次のジョブを開始するかどうかだけを決める。実行中のジョブは終わるまで走る。
- キャンセル（`cancel_queue_item`、`cancel_batch`、待機中の全項目を止める `cancel_pending`）: `pending` か実行中の項目は直ちに `canceled` になる。実行中のジョブはトークンを取り消し（GPU ロックの待機も終わる）、エンジンは ComfyUI のキューからプロンプトを外し、ID で中断する（`ComfyEngine::interrupt`）。
- 再試行（`retry_queue_item`）: 失敗かキャンセルの項目を、同じパラメーターとシードで新しい項目として末尾に積み直す。プロンプトから作る画像は、8 の倍数で 64 以上、元より大きくない範囲で小さくできる（`check_retry_size`）。削除済みの `logo` モードは除く。
- `clear_queue` はすべての項目を消す（実行中のものはキャンセルする）。`prune_queue` は終わった項目だけを消す。
- 再起動: 起動時、`in_progress` の項目は「Interrupted because novira was closed」の文言で `failed` になり、再実行しない。`pending` の項目は残り、1 件でもあれば処理は一時停止で始まる（`service/mod.rs`）。終了時に実行中だったジョブは同じ文言で `canceled` になる。

### GPU ロック

- 設定 `gpuLock`: `auto`（既定）は `NOVIRA_GPU_LOCK` を読む。パスはそのまま使う。`""` はロックを切る（`Settings::gpu_lock_path`）。
- GPU を使うジョブは生成の前にロックを取る。対象は ComfyUI のジョブ（検証の後）と音声ジョブ。待機中のジョブには「waiting for GPU lock」と出て、キャンセルできる。
- ロックは `mkdir` で作るディレクトリで、ガードが破棄されたときと終了時に解放する。novira は隣に `<lock>.owner`（プロセス ID と開始時刻）を書く。記録のプロセスが既にいないロックは引き継ぎ、記録のないロックは決して消さない。

### ComfyUI のグラフ

- 参照画像を除き、コアノードだけを使う。共通部分は `CheckpointLoaderSimple`（または `VAELoader`）、有効な LoRA ごとに `LoraLoader` 1 つ、CLIP スキップ用の `CLIPSetLastLayer`、CFG リスケールが 0 より大きいときの `RescaleCFG`、2 つの `CLIPTextEncode`、出力の `PreviewImage`。
- モード: テキストから画像（`KSampler`）、画像から画像（ノイズ除去 = 変化量、既定 0.7）、インペイントとアウトペイント（下記）、アップスケール（任意の `UpscaleModelLoader` と `ImageUpscaleWithModel`、目標サイズへの `ImageScale`、画像から画像の 1 パス。タイル ControlNet と後処理モデルは任意）。出力が 1 タイルより大きいときはタイルごとに描き直す（`comfy/tiles.rs`）。タイルは正方形で、元画像の面積を 64 に丸めて 512 から 1024 に収め（`tile_side`）、少なくとも `OVERLAP` 重ねる。各タイルは切り出し（`ImageCrop`）、その切り出しをタイル ControlNet のガイドにしてサンプリング、デコードし、拡大画像へ行ごとに重ねる（`ImageCompositeMasked`、重なりには `FeatherMask`）。進捗はタイル数で数える。シームレスタイリングは 1 パスのまま。出力の辺が `MAX_UPSCALE_SIDE` を超えると断る。画面はメインモデルと同じベースのタイル ControlNet があれば選び、なければ使わない。別のベースの保存済みのものは送らない（`buildUpscaleRequest`）。
- 高解像度修正（テキストから画像と画像から画像。画像から画像は、元画像の上に最初のパスを自分の変化量で描く）: 最初のパスの後に画像を拡大し（アップスケールモデル、続いて Lanczos の `ImageScale`）、再びエンコードして、同じシードで修正の強さとステップ数で描き直す。倍率は 1 から 4、強さは 0 より大きく 1 以下。
- スケジューラー名はサンプラーとスケジューラーの組へ対応づける（`sampler_for`）。
- インペイントとアウトペイント: マスク（白は描き直し、灰色は弱く）を出力サイズに拡縮し、広げてぼかす（ぼかしの既定は 16）。マスクはエンコードした元画像のノイズマスクになり（`SetLatentNoiseMask`、灰色の値には `DifferentialDiffusion`）、結果は `ImageCompositeMasked` で貼り戻すので、マスク外の画素は元画像のまま残る。アウトペイントでは、キャンバスが先に空の部分を埋める（`frontend/src/features/canvas/render/generationInputs.ts`）。インペイント専用モデルは要らない。
- コントロールレイヤー: モデルごとに `ControlNetLoader` 1 つ、レイヤーごとに肯定側と否定側へ `ControlNetApplyAdvanced`。強さが重み、`start_percent` と `end_percent` が開始と終了。`more_control` は否定側に制御をかけない。`more_prompt` は balanced として動く（コアに同等のものはない）。レイヤーは画像が何を表すか（`controlType`）を指定でき、SD ファミリーの union ControlNet（`is_union_controlnet`: 名前、ファイル、取得元で判定）には、ローダーの後に `SetUnionControlNetType` を付ける。
- 参照画像（IP-Adapter）には ComfyUI_IPAdapter_plus ノードパックが要る。ファイルごとに `IPAdapterModelLoader` と `CLIPVisionLoader`、画像ごとに `LoadImage` と、モデルへの `IPAdapterAdvanced`（`combine_embeds: concat`、`embeds_scaling: V only`）。`regionImageUrl` を持つ参照は、その画像を `attn_mask` にする。方式はパックの `weight_type` に対応する（`ipadapter_weight_type`）。エンコーダーは、希望サイズ（ViT-H、ViT-G、ViT-L。ファイル名かレイヤー数で判定）のインストール済み CLIP vision モデル。パックがなければ、アップロードの前に検証が失敗する（準備の検査: `frontend/src/state/comfy/packNeeds.ts`）。
- ジョブの画像は実行時に ComfyUI の入力フォルダーへアップロードする。成功は `/history` で読む。進捗とプレビューは `/ws` から来る（プレビューは各 1 回、自分のフレームつきで出し、窓は続くステップの間保つ）。ソケットがないときはポーリングする。
- メモリ不足の失敗の後は、次のジョブの前に `POST /free` で ComfyUI のモデルを解放する。
- 実アプリでの確認: インペイントとアウトペイントはマスク外の画素を 8 ビット 1 段階以内で保ち、canny のコントロールレイヤーは元画像の輪郭に沿った。

- 新しいモデルファミリー（Anima、Flux、Chroma、Qwen-Image、Z-Image、SD3、HiDream、AuraFlow）は同じグラフを使い、ローダー、シフト、潜在、サンプラーはファミリー固有になる。[03-model-families.md](03-model-families.md) を参照。

### 下書き

- `draftAt` を持つジョブは途中で止まる。下書きビューとその規則は [05-drafts.md](05-drafts.md) にある。

### ガイダンスの検査

- 追加時（`service/guidance.rs`、`check`）: コントロールレイヤーは 8、参照画像は 8、参照用の画像（`referencePictures`、FLUX.2 のみ。[03-model-families.md](03-model-families.md)）は 4 まで。ガイダンスは 4 つのモード（テキストから画像、画像から画像、インペイント、アウトペイント）だけ。マスクはインペイントとアウトペイントだけで、両方で必須、元画像があるときだけ。`controlLayerCount` と `refImageCount` は送った画像の数と等しい。コントロールの重みは 0 から 2、参照の重みは -1 から 2。開始と終了は 0 から 1 で、開始は終了より後にならない。
- ワーカー（`job_guidance`）: コントロールモデルは種類が ControlNet、参照モデルは種類が IP-Adapter で、どちらもメインモデルのベースに合う（同じベース、またはどちらかが `Any`）。CLIP vision モデルはインストール済みであること。ベースが SD 1.5、SD 2、SDXL、any のどれでもないメインモデルは、`comfy/split.rs` にレシピのあるファミリーでない限り断る（`engine_job`）。コントロールモデルはモデルパッチでもよい。
- ガイダンスの画像は `novira-data/outputs/` から読み、動画や音声は使えない。動画は元画像にもできない。
- シームレスタイリング（`seamlessX`、`seamlessY`）はシームレスタイリングパックのノードを使う。LoRA と参照画像の後で、モデルのコピーに `SeamlessTile`（`enable`、`x_only` か `y_only`）を置き、すべてのデコード（高解像度修正は両パス）で `VAEDecode` の代わりに `CircularVAEDecode` を使う。新しいファミリーのモデルは断る。`validate` は足りないパックとそのアドレスを示す（`split::packs_needed`。GGUF パックのノードも含む）。
- リージョナルガイダンス: `regionalGuidanceCount` は送ったレイヤー数と等しい（最大 8。各レイヤーは保存済みの画像で、黒地に白の領域、肯定か否定のプロンプトを持ち、プロンプトは 10,000 文字まで）。グラフでは、各レイヤーのプロンプトを `CLIPTextEncode` にし、`ConditioningSetMask`（領域は `ImageToMask` 経由）で領域に限定して、`ConditioningCombine` で肯定側か否定側に足す。`autoNegative` のときは、肯定プロンプトを領域の外側に限定して否定側にも足す（`InvertMask`）。新しいファミリーのモデルは断る。リージョンの参照画像は送らない。

### ローカルエンジン

- `comfyuiUrl` がなければ、アプリが自分の ComfyUI を持つ。`open` は空いているループバックのポートを取る。`ComfyProcess::start` は、そのホストとポート、追加のモデルパスのファイル、`comfyuiArgs` を付けて `main.py` を実行し、コンソール窓なし（Windows）で、出力は `logs/comfyui.log` へ書く（`backend/crates/novira-core/src/comfy/process.rs`）。
- Python は `comfyuiPython`。なければ ComfyUI フォルダー内の venv か組み込み Python（`find_python`）。どちらもなければ PATH の `python`。キャッシュと一時ファイルは `novira-data/cache/` へ行く（`cache_env`）。
- 開始: アプリ起動時（`prepare_engine`）と、それが失敗していたときの最初のジョブ。`ensure_ready` は `comfyuiStartTimeoutSecs`（既定 180）まで待つ。状態は `engine_status` イベントで出る: `idle`、`downloading`、`extracting`、`starting`、`ready`、`error`。
- 停止: 終了時に、アプリが持つプロセスを止める。Windows ではジョブオブジェクトにも入り、アプリが落ちても止まる（`child_job.rs`）。
- `comfyuiUrl` があれば、アプリはそのサーバーへつなぎ、何も開始も停止もしない。
- 低メモリモード（`lowMemoryMode`、`service/memory.rs`）: アプリが持つ ComfyUI は、ユーザーの VRAM オプションの代わりに `--novram` で起動する（`--cpu` ではない）。切り替えるとジョブが走っていなければ ComfyUI を再起動し、走っていれば次の起動で反映する。
- 完成した画像は `outputs/<uuid>.png` として書き、設定を `novira_metadata` テキストチャンクに入れる（`media/images.rs`）。新しいファミリーのモデルでは、ワーカーが実行した組を `sampling` として加える（[03-model-families.md](03-model-families.md)）。

## 境界

| 境界 | 守り |
|---|---|
| ジョブが使う画像 | 元画像、インペイントのマスク、コントロール画像、参照画像、参照用の画像はギャラリーの URL としてだけ届く。`enqueue` が各 URL を検査済みの画像名へ解決し（`image_name_from_url`）、それ以外は断る。ジョブはパスでファイルを読めない。ページ内で描いた画像は先にアップロード経路で保存する（`TauriBackend.stored`）。`service::guidance::check` が依頼を縛る（数、重み、範囲、キーと URL の長さ）。 |
| ローカルエンジン | アプリが持つ ComfyUI は `127.0.0.1` だけで待ち受ける。`comfyuiUrl` で起動する `comfyuiDir` もこの PC 上になければ起動を断る。ComfyUI 自身が別オリジンのブラウザ要求を断る。キャッシュと一時ファイルは `novira-data/cache/` の中。 |

## 既知の限界

- アプリの実行中は、ローカルのプログラムが ComfyUI のループバックポートへ接続できる。
- 参照画像は、サードパーティのカスタムノードパック（ComfyUI_IPAdapter_plus。上流では保守終了）のノードを ComfyUI の Python 内で実行する。
- アップスケールの各タイルはプロンプト全体で描くので、被写体を名指しするプロンプトは、背景のタイルにその小さなコピーを加えることがある（2026-10-27、Anima、強さ 0.35、768 px を 4 倍）。
- シームレスタイリングつきのアップスケールは出力サイズで 1 パスで描く。1 メガピクセル付近で学習したモデルには遅く、出力が何倍も大きいとブロック状に崩れる。
- `comfyuiUrl` と `comfyuiDir` を両方設定したとき、URL が応答しないために起動したフォルダーの ComfyUI は、`comfyuiUrl` のホストとポートで待ち受ける。`Backend::open` は、この PC にないホストを `comfyuiUrl` を名指しして断る（`comfy::process::is_this_pc`）。`comfyuiUrl` だけならどこを指してもよく、そのために何も起動しない。

## 未実装

- FLUX Redux と `tcd` スケジューラー（ComfyUI のコアに `tcd` サンプラーがない）。どちらも GPU を使う前に理由つきで断る。
