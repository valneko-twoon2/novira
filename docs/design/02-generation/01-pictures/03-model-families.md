---
covers:
  - backend/crates/novira-core/src/comfy/split.rs
  - backend/crates/novira-core/src/comfy/split/**
  - backend/crates/novira-core/src/comfy/video_families.rs
  - backend/crates/novira-core/src/comfy/video_families/**
  - backend/crates/novira-core/src/comfy/variants.rs
---
# モデルファミリー

ComfyUI が部品に分けて読む新しい画像モデル（Anima、Flux、FLUX.2、Chroma、Qwen-Image、Z-Image、SD3、HiDream、AuraFlow、HunyuanImage）。01-generation.md の画像グラフがそれらをどう読み込むか、どのファイルが要るか、ワーカーがそのファイルをどう見つけるか。同じ仕組みが、インストール済みの動画モデル（Wan、HunyuanVideo、HunyuanVideo 1.5、LTX-Video、LTX-2）を動画画面で動かす。

## 動作

- Anima、Flux、Chroma、Qwen-Image、Z-Image、SD3、HiDream、AuraFlow は同じグラフを使う。拡散モデル（種類 `diffusion_model`）は `UNETLoader` で読み込む。これらのチェックポイントは `CheckpointLoaderSimple` で読み込み、ワーカーはそのヘッダー（`classify::bundled_parts`）を読み、エンコーダーと VAE を含むかを知る。Anima では ComfyUI の Anima が読む接頭辞だけを数える（`cond_stage_model.`、`first_stage_model.`。`classify::bundled_parts_for`）。`text_encoders.` と `vae.` を持つ統合チェックポイントは clip が `None` になり、エンコーダーと VAE はインストール済みのファイルから来る。足りないものは `CLIPLoader`（type は Anima と AuraFlow が `stable_diffusion`、ほかは `chroma`、`qwen_image`、`lumina2`）、`DualCLIPLoader`（`flux`）、`TripleCLIPLoader`（SD3）、`QuadrupleCLIPLoader`（HiDream）で読み込む。LoRA の後にファミリーのフローシフトが来る（`ModelSamplingAuraFlow`: Chroma 1、Qwen-Image 3.1、Z-Image 3、AuraFlow 1.73。`ModelSamplingSD3`: HiDream 3）。空の潜在は Anima と AuraFlow が `EmptyLatentImage`、ほかは `EmptySD3LatentImage`。サンプラーとスケジューラーはファミリー固有で、ユーザーのスケジューラーは使わない。例外は Anima で、スケジューラー設定に従う（素の `euler` はやはりテンプレートの euler/simple なので、選択ができる前に記録した画像も同じに動いた。`Family::follows_scheduler_setting`、`sampling_for`）。ほかは、Flux と Qwen-Image が euler/simple、Chroma が euler/beta、Z-Image が res_multistep/simple、SD3 が euler/sgm_uniform、HiDream が uni_pc/simple、AuraFlow が euler/normal。CLIP スキップは無視する。`Family::picture_sampling` は各ファミリーの画像が実行するものを名指しする（FLUX.2 は euler と `Flux2Scheduler`）。ワーカーはこれを保存した画像のメタデータに `sampling` として記録し（`split::fixed_sampling`: Anima を除くこれらのファミリーのメインモデルか拡散モデルで、画像グラフが描くモード）、「すべて使う」は現在のスケジューラーを保つ。フロント側の写し（`FAMILY_SAMPLING`、`frontend/src/backend/familySampling.ts`）は契約フィクスチャ `family-sampling.json` で、両側の契約テストが検査する。生成画面はスケジューラー欄の代わりにその組を読み取り専用で表示し、推奨値はこれらのモデルではスケジューラーを数えない。Flux は CFG の値を `FluxGuidance` に渡し、CFG 1 でサンプリングし、否定側はゼロにする。マスク、コントロールレイヤー、高解像度修正、アップスケール、下書きは SD ファミリーと同じに動く（下書きはファミリーのサンプラーで `KSamplerAdvanced`）。ControlNet には VAE を渡し、種類が `model_patch`（フォルダー `model_patches`）のコントロールモデルは `ModelPatchLoader` で読み込み、`AnimaLLLiteApply`（Anima）か `QwenImageDiffsynthControlnet`（Qwen-Image、Z-Image）でモデルを変える。参照画像は断る。ワーカー（`split_job`、`split_vae`）は、インストール済みのモデルからファイル名の語（`split::pick`）でエンコーダーと VAE を選ぶか、ジョブの VAE を使う。ファイルがなければ、インストールすべきものを示して失敗する。スターターモデルは各ファミリーのファイルを依存として挙げる。
- 対象になるモデル: 生成タブのモデル一覧は、ベースにレシピがあるメインモデルと拡散モデルを表示する（`frontend/src/state/models.ts` の `SPLIT_BASES` と `isDrawable`。`split::Family::of` と同じファミリー）。AI アシスタントの `select_model` も同じ。
- 画像のレシピがないファミリー（動画のファミリー）のモデルでの画像ジョブは、ワーカーがそのベースを示して断る。

### GGUF ファイルとバリアント

- `.gguf` のモデルやエンコーダーは ComfyUI-GGUF パックのノードで読み込む（`UnetLoaderGGUF`、`CLIPLoaderGGUF` と dual、triple、quadruple の各形。`split::unet_loader`、`split::text_encoder`）。パックのノードがなければ `validate` がパックを示す。ComfyUI は GGUF ファイルを一覧しないので、一覧はパックのローダーノードから読む。GGUF ファイルには読めるヘッダーがないので、ファミリー、Wan の種類、バリアントは名前から決める。
- `classify::detect_variant` は、テンソル（Flux Fill: `img_in.weight` の 384 列。Wan の追加物 `vace_patch_embedding`、`control_adapter`、`casual_audio_encoder`、`audio_proj`、`face_adapter`。Fun Control: 48 チャンネルと `img_emb`）か、名前（`kontext`、`edit`、`layered`、GGUF）からバリアントを判別する。ワーカーが `SplitJob.variant` に入れる。
- Flux Fill、Flux Kontext、Qwen-Image-Edit（`comfy/variants.rs`）は、元画像を `InpaintModelConditioning`、`ReferenceLatent`、`TextEncodeQwenImageEdit[Plus]` から取り込む（2509 以降のファイル、つまり名前に `2509`、`2511`、`plus` があるものは Plus を使う）。Fill にはマスクつきのインペイントかアウトペイントと、30 のガイダンスが要る（CFG の値は使わない）。Kontext と Qwen の編集モデルには画像から画像が要る。どれも下書き、高解像度修正、コントロールレイヤーは断る。
- Wan VACE は `WanVaceToVideo`（参照画像は任意）と `TrimVideoLatent` を実行する。Wan 2.1 の画像から動画（`img_emb` を持つモデル）は、`CLIPVisionLoader` と `CLIPVisionEncode` を `clip_vision_h` で足し、それは名前で探す。なければ、その名前を示してジョブが失敗する。
- `Variant::Unsupported(reason)`（Flux Canny と Depth、Qwen-Image-Layered、Wan の Fun Control・camera・speech-to-video・HuMo・Animate・pose の各モデル）は、グラフの組み立てを `<family>: <reason>` で失敗させる。

### HunyuanImage 2.1

- 拡散モデル。平らなパッチ（`img_in.proj.weight` が 4 次元）で HunyuanVideo と見分ける（`classify::detect_architecture`）。共通の画像グラフを実行する（`Family::HunyuanImage`）。`DualCLIPLoader` の `hunyuan_image`（Qwen2.5-VL と ByT5）、`hunyuan_image_2.1_vae`、`EmptyHunyuanImageLatent`（32 倍圧縮の潜在）、`KSampler` の euler と simple、CFG は画面のもの。フローシフトのノードは足さない。モデルが自分で持つ。リファイナーモデルは実行しない。

### Hunyuan-DiT

- Hunyuan-DiT のチェックポイントはモデル、両方のテキストエンコーダー、VAE を持つので、ベース `hunyuan-dit`（テンソル `mlp_t5`）のメインモデル（`checkpoints`）になり、SD の画像グラフをそのまま通って描く。`CheckpointLoaderSimple`、`CLIPTextEncode`、ユーザーのスケジューラーで `KSampler`、`EmptyLatentImage`。LoRA、ControlNet、そのほかの SD のガイダンスはベースで照合するので、これ用に作ったものだけが合う。

### FLUX.2、HunyuanVideo 1.5、LTX-2

- 古いファミリーとは、それぞれ固有のテンソルで見分ける（`classify::detect_architecture`）。FLUX.2（`comfy/variants.rs`）は `SamplerCustomAdvanced`、`Flux2Scheduler`、`EmptyFlux2LatentImage` でサンプリングする。dev は `FluxGuidance` と `BasicGuider`、klein は `CFGGuider` とゼロの否定側。テキストエンコーダーは Mistral 3 Small（dev）か Qwen3 4B または 8B（klein）で、`classify::flux2_context` が選ぶ（`Family::encoders_for`）。VAE は `flux2-vae`。テキストから画像、または参照編集としての画像から画像（両側に `ReferenceLatent`、画像のサイズで描く）。マスク、コントロールレイヤー、高解像度修正は断る。下書きは下書きのステップで `SplitSigmas` によりスケジュールを切り、サンプラーの denoised 出力をデコードする。画像から画像の下書きも、元画像が参照でスケジュールが 0 から始まるので、同じく切る。参照用の画像（`referencePictures`、最大 4。コマ割り漫画の登場人物）は、それぞれ約 1 メガピクセル（`REFERENCE_MEGAPIXELS`）に拡縮してエンコードし、元画像の後で両側に `ReferenceLatent` でつなぐ。画像は求められたサイズのまま。ワーカーは別のベースのメインモデルを断り、ほかのファミリーと SD グラフも断る。
- HunyuanVideo 1.5（`comfy/video_families.rs`）: `DualCLIPLoader` の `hunyuan_video_15`（Qwen2.5-VL と ByT5）、`ModelSamplingSD3` の 7、`CFGGuider`、`BasicScheduler` の simple、`EmptyHunyuanVideo15Latent`。画像から動画（`Variant::Hy15I2v`。メタデータの `model_type` か名前から判別）は `HunyuanVideo15ImageToVideo` を SigCLIP の vision モデルとともに使う。超解像のファイルは断る。
- LTX-2: 1 つのチェックポイント（動画モデル、VAE、音声 VAE）を `CheckpointLoaderSimple` で読み、`LTXAVTextEncoderLoader`（Gemma 3 12B）、`LTXVConcatAVLatent` で結んだ動画と音の潜在、`LTXVScheduler`、`CFGGuider`、`euler_ancestral`。音はデコードしてクリップに入る（`video::finish_with_audio`）。ComfyUI のテンプレートの第 1 段だけを実行し、2 倍のアップスケーラーは使わない。

### 動画モデル

- `modelKey` が `Family::of_video`（Wan、HunyuanVideo、LTX-Video）のインストール済みモデルを名指しする動画ジョブは、`comfy/video_families.rs` から実行し、パックは要らない。キーがないか `video-turbo` なら、パックのモデルになる（01-media-generation.md）。動画画面はそのモデルを（`frontend/src/state/models.ts` の `isVideoModel`）自分の 2 つの横に並べ、ファミリーのステップ数、CFG、フレームレート、サイズを設定する（`VIDEO_FAMILY_PRESETS`）。
- ワーカー（`split_job`）は画像と同じくテキストエンコーダーを名前で探し、Wan ではパッチ埋め込みのチャンネル数からモデルの用途を読む（`classify::wan_in_channels`。`Header::shapes` に残す唯一の形）。16 はテキストから動画、36 は画像から動画、48 は 5B モデル。未知の数ならジョブが失敗する。Wan 2.2 の high-noise ファイルは low-noise の相方（ファイル名に `low_noise` を持つもの）を連れてくる。low-noise のファイルを選ぶか、相方のない high-noise のファイルを選ぶと、そう伝えてジョブが失敗する。
- Wan のテキストから動画: `UNETLoader`、`ModelSamplingSD3`（シフト 8）、`CLIPLoader` の `wan`、`EmptyHunyuanLatentVideo`（サイズは 16 の倍数、フレームは 4n+1）、`KSampler`（uni_pc、simple）。画像から動画: 空の潜在の代わりに、開始画像を渡した `WanImageToVideo`。テキストから動画のモデルに画像を渡すこと、画像用のモデルに画像を渡さないことは断る。5B モデルは、ユーザーのファイルと Wan 2.2 の VAE でパックのグラフ（`video::build_ti2v`）を実行する。Wan 2.2 A14B の組は、それぞれ `ModelSamplingSD3` を持つ 2 つの `UNETLoader` と、2 つの `KSamplerAdvanced`（high-noise モデルがステップの前半、low-noise が残り）。
- HunyuanVideo（テキストから動画のみ）: `DualCLIPLoader` の `hunyuan_video`（CLIP-L と LLaVA-Llama3）、`ModelSamplingSD3`（7）、CFG の値から `FluxGuidance`、`BasicGuider`、`RandomNoise`、`BasicScheduler`、`SamplerCustomAdvanced`（euler、simple）。否定プロンプトはない。その画像から動画のファイル（33 チャンネル、`Variant::HyI2v`）は、`TextEncodeHunyuanVideo_ImageToVideo` で LLaVA の vision モデル（`llava_llama3_vision`）で画像を読み、`HunyuanImageToVideo`（"v2_replace" のファイルは `v2 (replace)`、それ以外は `v1 (concat)`）を使う。チャンネル数が違うファイルは断る。
- LTX-Video: `CheckpointLoaderSimple`（VAE を内包するので、ファイルは `checkpoints` のメインモデル）、T5-XXL を使う `CLIPLoader` の `ltxv`、`LTXVConditioning`（フレームレート）、`LTXVScheduler`、`SamplerCustom`（euler）、`EmptyLTXVLatentVideo` か `LTXVImgToVideo`（サイズは 32 の倍数、フレームは 8n+1）。
- すべて `video::finish`（デコード、MP4、サムネイル）で終わる。`validate` は古い ComfyUI にないノードを検査し（`SplitJob::video_node`）、試し組み立てが元画像を見るのは、ジョブに元画像があるときだけ。

## 境界

| 境界 | 守り |
|---|---|
| グラフが名指しするファイル | インストール済みのモデルだけ。ワーカーがエンコーダー、VAE、コントロールモデルをインストール済みモデルの ComfyUI アドレス（`ModelConfig.comfy`）へ解決する。ファイル名が窓から来ることはない。チェックポイントの部品を探すために読むヘッダーは safetensors のヘッダーだけ（`classify::read_header`、最大 64 MiB）で、重みは決して読まない。 |

## 既知の限界

- エンコーダーと VAE はファイル名の語で見つけるので、名前を変えたファイルは見つからず、ジョブはインストールすべきファイルを名指しして失敗する。
- レシピは ComfyUI のテンプレートに従う。AuraFlow にテンプレートはなく、そのサンプラー（euler、normal）は実エンジンで aura_flow_0.3 によりきれいな 1024 px の画像を作った（2026-10-12、目視）。HunyuanImage 2.1（distilled fp8）と HiDream Fast fp8 も同じ方法で動かした。蒸留版（HiDream Dev と Fast、Z-Image Turbo）は CFG 1 を求め、ユーザーが設定する。
- 参照画像（IP-Adapter）はこれらのファミリーでは断る。
- 動画: Unsupported バリアントの Wan モデルは対象外。LTX-2 には第 2 段がない。HunyuanVideo 1.5 と LTX-2 のグラフは ComfyUI のノード定義と突き合わせた。19B の LTX-2 モデルは、検査用の 12 GB のカードでは動かしていない。
- `kontext` や `edit` を外して名前を変えた Kontext や Qwen の編集ファイルと、名前にファミリーがない GGUF ファイルは、通常のモデルとして動くか、認識されない。GGUF パックはユーザーがインストールする必要がある。
