---
covers:
  - backend/crates/novira-core/src/comfy/music.rs
  - frontend/src/state/media/music.ts
  - frontend/src/features/music/**
---
# 音楽の生成画面

一覧に戻る: [README.md](README.md)

スタイルタグと歌詞から曲を作る画面。モデルは ACE-Step 1.5 turbo。ComfyUI のコアノードで組んだジョブで、キューと保存は [共通のページ](../02-media-workflows/01-media-generation.md) にある。ノードエディタで曲を作る経路は [03-workflow-graphs.md](../02-media-workflows/03-workflow-graphs.md)。

## 動作

- 画面: スタイル（ジャンル・雰囲気・楽器）、歌なし（インストゥルメンタル）、歌詞、歌詞の言語、長さ、テンポ（BPM）、拍子、キー、ステップ数、CFG、シード。スタイルが空だとフォームは Invoke を断り、パックが ready でないときも断る。
- 既定のフォーム: 日本語、60 秒、120 BPM、C major、4 拍子、8 ステップ、CFG 1。
- モデルパック: ACE-Step 1.5 turbo。オールインワンのチェックポイント 1 つ `ace_step_1.5_turbo_aio.safetensors`、約 10 GB、`checkpoints` フォルダ（`MUSIC_FILES`）。
- グラフ（`backend/crates/novira-core/src/comfy/music.rs`）: CheckpointLoaderSimple、TextEncodeAceStepAudio1.5（スタイルタグがポジティブプロンプト。歌詞・シード・bpm・長さ・拍子・言語・キー。CFG は 2.0 固定）、ネガティブとして ConditioningZeroOut、ModelSamplingAuraFlow（シフト 3）、EmptyAceStep1.5LatentAudio、KSampler（euler、simple。ステップ数と CFG は要求から）、VAEDecodeAudio、SaveAudioAdvanced（FLAC）。
- グラフの前の検査: タグは空にできない。長さは 10〜240 秒に収める。bpm は 10〜300。キーは `<root> major` か `<root> minor` で、それ以外は C major。拍子は 2・3・4・6 で、それ以外は 4。ACE-Step の一覧にない言語は `unknown`。インストゥルメンタルまたは空の歌詞は `[Instrumental]` にする。
- `validate` は TextEncodeAceStepAudio1.5 ノードを必須とする（`backend/crates/novira-core/src/comfy/client.rs`）。
- フォームは 10〜240 秒、bpm 40〜220、4〜50 ステップ、CFG 1〜8 を許し、歌詞の言語を 12 種類（`unknown` は「おまかせ」）出す。
- 音楽の要求は LoRA を持たず、選んだモデルの種類の検査も受けない。
- 結果: `EngineOutput::Audio`。履歴の `audio` 出力から読み、`<uuid>.flac` として `mediaType: audio` で保存する。サムネイルは、FLAC のため波形の画像をファイルのバイト列から描く（WAV だけがデコードされる。[共通のページ](../02-media-workflows/01-media-generation.md)）。
- RTX 4070 Ti で 1 回計測: 30 秒のインストゥルメンタルが約 26 秒。

## 境界

| 境界 | 守るもの |
|---|---|
| 値の範囲 | 長さ・bpm・キー・拍子・言語は `music.rs` が収め、一覧にない値は既定へ戻す |
| スタイル | 空のタグはグラフを組む前に断る |
| ComfyUI のノード | `validate` が TextEncodeAceStepAudio1.5 の不在で断る |
| ダウンロード | [共通のページ](../02-media-workflows/01-media-generation.md)の境界 |

## 既知の限界

- 曲の長さによるが、GPU で数十秒〜数分かかる（画面の案内）。
- FLAC のサムネイルは本物の波形ではない。

## 未実装

現在のコードにないもの。

- 既存の曲の続き・カバー・編集（音楽のグラフは音声入力を取らない）。
- 音楽の LoRA。
