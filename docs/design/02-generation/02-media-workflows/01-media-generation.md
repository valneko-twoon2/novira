---
covers:
  - backend/crates/novira-core/src/comfy/video.rs
  - backend/crates/novira-core/src/comfy/music.rs
  - backend/crates/novira-core/src/comfy/client.rs
  - backend/crates/novira-core/src/voice/**
  - backend/crates/novira-core/src/packs.rs
  - backend/crates/novira-core/src/service/pack_store.rs
  - backend/crates/novira-core/src/service/worker.rs
  - backend/crates/novira-core/src/media/audio.rs
  - backend/crates/novira-core/src/child_job.rs
  - frontend/src/state/media/**
  - frontend/src/features/video/buildRequest.ts
  - frontend/src/features/music/buildRequest.ts
  - frontend/src/features/voice/buildRequest.ts
---
# メディア生成: 動画・音楽・音声

一覧に戻る: [README.md](README.md)

画像以外の生成モード。動画はテキストから、またはギャラリーの画像を動かしてクリップを作る（Wan 2.2 TI2V 5B、またはその 4 ステップの Turbo モデル）。音楽はスタイルタグと歌詞から曲を作る（ACE-Step 1.5 turbo）。音声は Qwen3-TTS でテキストを読み上げる。動画と音楽はコアノードで組んだ ComfyUI のジョブで、音声は ComfyUI の Python で起動する専用の Python ワーカープロセスで動く。モデルファイルは、要求に応じてダウンロードするモデルパック（[01-models.md](../03-models/01-models.md) を参照）。

## 動作

### 共通

- モードは `GenerationMode` の値 `video`・`music`・`voice`（`backend/crates/novira-core/src/types.rs`）。キューのワーカーは `voice` を `process_voice`（`backend/crates/novira-core/src/service/worker.rs`）へ送る。残り二つは `comfy::graph::build`（`backend/crates/novira-core/src/comfy/graph.rs`）がそれぞれのグラフファイルへ渡す。
- `GenerationMode` には、もう存在しないロゴ画面のモード `logo` も残している。そのモードで作った画像はメタデータにこれを持ち、ギャラリーのアセット（`category: other`）として読み込み・一覧・表示ができる。このモードのジョブ（旧版がキューに残した行）はワーカーの `engine_job` で `LOGO_REMOVED` により失敗し、`comfy::graph::build` も拒否する。そのパックのファイルはそのまま残す。モデルルート内の `logo` フォルダはスキャンせず、`extra_model_paths.yaml` に節を作らず、削除もしない。
- すべてのジョブは、設定されていれば GPU ロックを取る（音声も含む。`gpu_guard`）。メモリ不足による失敗は、音声ワーカーを含むすべてのエンジンでキュー項目に印を付ける。
- パックは `backend/crates/novira-core/src/packs.rs` で定義する。ComfyUI のパックは `<data>/models/<kind>/` に置く（`modelRoots` のフォルダの `<root>/<kind>/` にあるものも読み取り専用で見つける。[02-model-packs.md](../03-models/02-model-packs.md) を参照）。ComfyUI は `extra_model_paths.yaml` の `novira_<kind>` 節から読む。音声パックは ComfyUI のパックではない。パックのダウンロードは、そのファイルにある Hugging Face と GitHub の固定アドレスを使い、トークンは送らない。
- `install_pack`（`backend/crates/novira-core/src/service/pack_store.rs`）はダウンロードをバックグラウンドで始める。実行中のパックへの 2 回目の要求は無視する。キャンセルすると、状態をディスク上の実態に戻す。進捗は `pack` イベントと `bootstrap` で届く。
- 結果はギャラリーの項目になる（`backend/crates/novira-core/src/service/worker.rs` の `save_result`）。動画と音声のファイルはそのまま `<data>/outputs/` に保存する。設定はデータベースの行だけが持ち、サムネイルは静止画。`novira-image` スキームは `Range` 要求に答えるので、音声と動画はシークできる。
- 音声ファイルは `mp3`・`wav`・`flac`（`backend/crates/novira-core/src/media/audio.rs`）。先頭バイトが WAV・FLAC・MP3 のものだけ保存する。
- 動画・音楽タブだけが手段ではない。ワークフローエディタは ComfyUI 自身のノードを出し、用意済みのグラフでも同じモデルパック（これらのタブがダウンロードするファイル）で曲や動画を作り、同じようにギャラリーへ保存する。その経路は [03-workflow-graphs.md](03-workflow-graphs.md)。

### 動画

- モデルパック: Wan 2.2 TI2V 5B、約 18 GB。ファイルは、拡散モデル `wan2.2_ti2v_5B_fp16.safetensors`、テキストエンコーダ `umt5_xxl_fp8_e4m3fn_scaled.safetensors`、VAE `wan2.2_vae.safetensors`（`VIDEO_FILES`）。
- Turbo: 4 ステップの蒸留モデル、約 10 GB、拡散ファイル 1 つ。テキストエンコーダと VAE は動画パックのファイルを使う。モデルキー `video-turbo`（`TURBO_KEY`）で選ぶ。サンプリングシフトは Turbo が 5、それ以外が 8（`ModelSamplingSD3`）。
- グラフ（`backend/crates/novira-core/src/comfy/video.rs`）: UNETLoader（`videoFp8` を設定すると `fp8_e4m3fn` の重み）、タイプ `wan` の CLIPLoader、VAELoader、CLIPTextEncode 2 つ、Wan22ImageToVideoLatent（元画像があれば `LoadImage` の開始画像）、KSampler（サンプラーとスケジューラーは `sampler_for`、denoise 1）、VAEDecode、または `videoTiledDecode` のときの VAEDecodeTiled（タイル 512、オーバーラップ 64、時間方向 64 と 8）、CreateVideo、SaveVideo（MP4、プレフィックス `video/novira`）。最初のフレームは ImageFromBatch と PreviewImage を通してサムネイルにする。
- フレーム数: `frames_for` が要求を 5〜241 に収め、4n+1 に切り捨てる（既定 49）。フォームも秒数と fps を同じ方法でフレーム数にする（`frontend/src/state/media/video.ts` の `framesFor`）。
- フレームレート: 1〜60 に収め、既定 24。
- サイズ: 最も近い 32 の倍数に丸め、最小 64。バックエンドは上限を設けない。フォームは 7 種類のサイズを出し、最大は 1024x576。
- ステップ数: バックエンドは 1 以上。フォームは 4〜50 ステップ、CFG 1〜12 を許す。標準プリセットは 20 ステップ・CFG 5、Turbo プリセットは 4 ステップ・CFG 1。
- 動画は元画像にできない。ジョブの開始時にワーカーが拒否し、その前にフォームが拒否する。
- `validate` は Wan22ImageToVideoLatent ノード（パーツに分けて読み込むモデルでは、そのファミリーの動画ノード）を必須とする（`backend/crates/novira-core/src/comfy/client.rs`）。
- インストール済みの動画モデル（Wan 2.1、Wan 2.2 A14B のペア、HunyuanVideo、LTX-Video）は専用のグラフを使い、パックは要らない。[03-model-families.md](../01-pictures/03-model-families.md) を参照。
- 結果: `EngineOutput::Video`。`<uuid>.mp4` として `mediaType: video` で保存する。
- RTX 4070 Ti で 1 回計測: 画像から作る 704x704・20 ステップの 2 秒クリップが約 74 秒。パックのインストールは約 18 分。

### 音楽

- モデルパック: ACE-Step 1.5 turbo。オールインワンのチェックポイント 1 つ `ace_step_1.5_turbo_aio.safetensors`、約 10 GB、`checkpoints` フォルダ（`MUSIC_FILES`）。
- グラフ（`backend/crates/novira-core/src/comfy/music.rs`）: CheckpointLoaderSimple、TextEncodeAceStepAudio1.5（スタイルタグがポジティブプロンプト。歌詞・シード・bpm・長さ・拍子・言語・キー。CFG は 2.0 固定）、ネガティブとして ConditioningZeroOut、ModelSamplingAuraFlow（シフト 3）、EmptyAceStep1.5LatentAudio、KSampler（euler、simple。ステップ数と CFG は要求から）、VAEDecodeAudio、SaveAudioAdvanced（FLAC）。
- グラフの前の検査: タグは空にできない。長さは 10〜240 秒に収める。bpm は 10〜300。キーは `<root> major` か `<root> minor` で、それ以外は C major。拍子は 2・3・4・6 で、それ以外は 4。ACE-Step の一覧にない言語は `unknown`。インストゥルメンタルまたは空の歌詞は `[Instrumental]` にする。
- `validate` は TextEncodeAceStepAudio1.5 ノードを必須とする。
- フォームは 10〜240 秒、bpm 40〜220、4〜50 ステップ、CFG 1〜8 を許し、歌詞の言語を 12 種類出す。
- LoRA とベースモデルの検査は適用しない。
- 結果: `EngineOutput::Audio`。履歴の `audio` 出力から読み、`<uuid>.flac` として `mediaType: audio` で保存する。サムネイルのためにデコードするのは WAV だけで、FLAC は波形の画像をファイルのバイト列から描く。
- RTX 4070 Ti で 1 回計測: 30 秒のインストゥルメンタルが約 26 秒。

### 音声

- モデル: Qwen3-TTS。`backend/crates/novira-core/src/voice/mod.rs` によれば Apache-2.0。1.7B のリポジトリを 2 つダウンロードする。プリセットモード（組み込みの話者。フォームは 9 つ出す）は `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`、デザインモード（言葉で表した声。フォームは説明を必須とする）は `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`。フォームは `Auto` のほかに 10 言語を出す。
- 実行環境: `QwenVoice` は `backend/crates/novira-core/src/voice/worker.py`（`<data>/voice/worker.py` にコピー）を、`comfyuiPython` の Python、未設定なら ComfyUI のフォルダにある Python で起動する。要求と応答は JSON 行で、応答ごとに目印が付くため、標準出力に出るライブラリの出力は無視する。ライブラリのログは `<data>/logs/voice.log` へ。ワーカーは `HF_HUB_OFFLINE=1` を設定し、モデルは一度に 1 つだけ保持し、`cuda:0` に bfloat16 で読み込み、WAV を書く。
- ライブラリは `<data>/voice/site` から読む。音声の経路は ComfyUI のサーバーを呼ばず、`validate` の対象でもない。ほかのジョブと同じく GPU ロックを取る。Read Aloud ノードを含むワークフローのグラフは、ComfyUI を実行する前に同じエンジンを使う（[03-workflow-graphs.md](03-workflow-graphs.md) を参照）。読み上げの後はワーカーを止め、ComfyUI が GPU のメモリを使えるようにする。
- 寿命: ワーカーは最初の要求で起動し、ready 行を待つ。要求の間は保持し、要求が 300 秒来なければ止める。アイドル確認は 30 秒ごと。デバッグビルドでは `NOVIRA_TEST_VOICE_IDLE_MS` でアイドル時間を短くできる。1 件の応答を待つのは 900 秒で諦める。Windows ではワーカーをジョブオブジェクトに結び付け（`backend/crates/novira-core/src/child_job.rs`）、`Backend::shutdown` が最初にこれを止める。
- 実行中の要求をキャンセルするとプロセスを kill する。次の要求は新しいプロセスを起動する。
- 空のテキストは拒否する。WAV は `<data>/cache/temp` に書いて読み込み、ギャラリーの項目を保存する前に一時ファイルを削除する。`<uuid>.wav` として `mediaType: audio` で保存する。WAV はデコードされるので、サムネイルは本物の波形。
- インストール（`voice::install`）: 同じ Python が必要。`qwen-tts` に対して `pip install --dry-run --report` を実行し、追加されるライブラリからデモ専用のもの（`SKIPPED_LIBRARIES`）を除いて、`pip --target <data>/voice/site --no-deps` でバージョンを固定してインストールする。続いて `.ready` を書く。その後 Hugging Face のツリー API でモデルのリポジトリを一覧し、モデルファイルだけ（README・画像・Markdown・ドットファイル・アセットフォルダは除く）を `.downloads/<n>.part` にダウンロードし、完了したものから名前を変え、モデルごとに `.complete` を書く。完了済みのファイルは再実行時に飛ばす。Hugging Face のトークンは、設定されていれば送る。
- キャッシュ（Hugging Face、Torch、pip、一時ファイル）は、音声のプロセスに対して `<data>/cache/` へ振り向ける。
- RTX 4070 Ti で 1 回計測: 日本語 1 文が、コードがインストールしない 0.6B モデルで約 12 秒。エンドツーエンドのインストール後の別の実行では約 19 秒。
- `backend/crates/novira-core/tests/media_live.rs` が音声・音楽・動画をエンドツーエンドで実行する。テストは既定で ignore され、GPU と大きなダウンロードを使う。

## 未実装

現在のコードにないもの。

- 動画の音声トラック（Wan のグラフに音声ノードがない）。
- 動画の終了フレームや 2 枚目の画像（開始画像だけ）。
- 動画を元画像として使うこと。
- 既存の曲の続き・カバー・編集（音楽のグラフは音声入力を取らない）。
- 録音からの声のクローン（上の 2 モデルだけ）。
- CPU や別の GPU での音声（ワーカーは `cuda:0` を使う）と、ストリーミング読み上げ（要求ごとにクリップ全体を返す）。
- 動画や音楽の LoRA。
