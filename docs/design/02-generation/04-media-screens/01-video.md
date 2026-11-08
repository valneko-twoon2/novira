---
covers:
  - backend/crates/novira-core/src/comfy/video.rs
  - frontend/src/state/media/video.ts
  - frontend/src/features/video/**
---
# 動画の生成画面

一覧に戻る: [README.md](README.md)

テキストから、またはギャラリーの画像を動かして、動画のクリップを作る画面。モデルは Wan 2.2 TI2V 5B か、その 4 ステップの Turbo モデル。ComfyUI のコアノードで組んだジョブで、キューと保存は [共通のページ](../02-media-workflows/01-media-generation.md) にある。ノードエディタで動画を作る経路は [03-workflow-graphs.md](../02-media-workflows/03-workflow-graphs.md)。

## 動作

- 画面: 作り方（「t2v」「i2v」）、プロンプト、ネガティブプロンプト、モデル、サイズ、フレームレート、長さ、ステップ数、CFG、シード、軽く動かす設定（fp8、コマを分けてデコード）。i2v は動かす画像を、ドロップ・アップロード・ギャラリーの選択で決める。できたクリップは中央で再生でき、「仕上げる」とクリップの削除がある。
- モデルパック: Wan 2.2 TI2V 5B、約 18 GB。ファイルは、拡散モデル `wan2.2_ti2v_5B_fp16.safetensors`、テキストエンコーダ `umt5_xxl_fp8_e4m3fn_scaled.safetensors`、VAE `wan2.2_vae.safetensors`（`VIDEO_FILES`）。
- Turbo（画面では「高速（4 ステップ）」）: 4 ステップの蒸留モデル、約 10 GB、拡散ファイル 1 つ。テキストエンコーダと VAE は動画パックのファイルを使う。モデルキー `video-turbo`（`TURBO_KEY`）で選ぶ。サンプリングシフトは Turbo が 5、それ以外が 8（`ModelSamplingSD3`）。
- パックが ready でないと、フォームは Invoke を断る（問題に「先に動画モデルをダウンロードしてください」を出す）。
- 既定のフォーム: 832x480、2 秒、24 fps、20 ステップ、CFG 5。標準プリセットは 20 ステップ・CFG 5、Turbo プリセットは 4 ステップ・CFG 1。モデルを選ぶとステップ数と CFG が入る。
- グラフ（`backend/crates/novira-core/src/comfy/video.rs`）: UNETLoader（`videoFp8` を設定すると `fp8_e4m3fn` の重み）、タイプ `wan` の CLIPLoader、VAELoader、CLIPTextEncode 2 つ、Wan22ImageToVideoLatent（元画像があれば `LoadImage` の開始画像）、KSampler（サンプラーとスケジューラーは `sampler_for`、フォームのスケジューラーは `unipc`、denoise 1）、VAEDecode、または `videoTiledDecode` のときの VAEDecodeTiled（タイル 512、オーバーラップ 64、時間方向 64 と 8）、CreateVideo、SaveVideo（MP4、プレフィックス `video/novira`）。最初のフレームは ImageFromBatch と PreviewImage を通してサムネイルにする。
- フレーム数: `frames_for` が要求を 5〜241 に収め、4n+1 に切り捨てる（既定 49）。フォームは長さ 1〜10 秒と fps 8〜30 から同じ方法でフレーム数にする（`frontend/src/state/media/video.ts` の `framesFor`。最大は 241 フレーム）。
- フレームレート: バックエンドは 1〜60 に収め、既定 24。
- サイズ: 最も近い 32 の倍数に丸め、最小 64。バックエンドは上限を設けない。フォームは 10 種類のサイズを出し、最大は 1024x576（と 576x1024）。
- ステップ数: バックエンドは 1 以上。フォームは 4〜50 ステップ、CFG 1〜12 を許す。
- 動画は元画像にできない。ジョブの開始時にワーカーが拒否し、その前にフォームが拒否する。
- `validate` は Wan22ImageToVideoLatent ノード（パーツに分けて読み込むモデルでは、そのファミリーの動画ノード）を必須とする（`backend/crates/novira-core/src/comfy/client.rs`）。
- インストール済みの動画モデル（Wan 2.1、Wan 2.2 A14B のペア、HunyuanVideo、LTX-Video）は、モデルの選択に並び、専用のグラフを使い、パックは要らない。選ぶとファミリーのステップ数、CFG、フレームレート、サイズが入る（`VIDEO_FAMILY_PRESETS`）。[03-model-families.md](../01-pictures/03-model-families.md) を参照。
- 結果: `EngineOutput::Video`。`<uuid>.mp4` として `mediaType: video` で保存する。
- RTX 4070 Ti で 1 回計測: 画像から作る 704x704・20 ステップの 2 秒クリップが約 74 秒。パックのインストールは約 18 分。

## 境界

| 境界 | 守るもの |
|---|---|
| 元画像 | 動画は拒否する（フォームと `engine_job`） |
| 値の範囲 | フレーム数・fps・サイズはバックエンドが収める |
| ComfyUI のノード | `validate` が動画ノードの不在で断る |
| ダウンロード | [共通のページ](../02-media-workflows/01-media-generation.md)の境界 |

## 既知の限界

- 高速（Turbo）は標準より細部が荒れることがあり、非商用ライセンスの旨を画面が示す。
- GPU のメモリが少ないときは fp8 とコマ分けデコードで抑える。画面の案内では、小さく作って「仕上げる」で大きくする手もある。

## 未実装

現在のコードにないもの。

- 動画の音声トラック（Wan のグラフに音声ノードがない）。
- 終了フレームや 2 枚目の画像（開始画像だけ）。
- 動画を元画像として使うこと。
- 動画の LoRA。
