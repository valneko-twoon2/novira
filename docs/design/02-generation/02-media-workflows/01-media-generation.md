---
covers:
  - backend/crates/novira-core/src/comfy/client.rs
  - backend/crates/novira-core/src/packs.rs
  - backend/crates/novira-core/src/service/pack_store.rs
  - backend/crates/novira-core/src/service/worker.rs
  - backend/crates/novira-core/src/media/audio.rs
  - frontend/src/state/media/packs.ts
  - frontend/src/features/media/**
---
# 動画・音楽・音声の生成: 共通

一覧に戻る: [README.md](README.md)

動画・音楽・音声の生成画面が共有する仕組み。画面ごとの動作は [動画](../04-media-screens/01-video.md)・[音楽](../04-media-screens/02-music.md)・[音声](../04-media-screens/03-voice.md)、画像は [01-generation.md](../01-pictures/01-generation.md)、テキストは [03-text](../../04-gallery/03-text/README.md) にある。動画と音楽はコアノードで組んだ ComfyUI のジョブで、音声は ComfyUI の Python で起動する専用の Python ワーカープロセスで動く。モデルファイルは、要求に応じてダウンロードするモデルパック（[01-models.md](../03-models/01-models.md) を参照）。

## 動作

- モードは `GenerationMode` の値 `video`・`music`・`voice`（`backend/crates/novira-core/src/types.rs`）。キューのワーカーは `voice` を `process_voice`（`backend/crates/novira-core/src/service/worker.rs`）へ送る。残り二つは `comfy::graph::build`（`backend/crates/novira-core/src/comfy/graph.rs`）がそれぞれのグラフファイルへ渡す。
- `GenerationMode` には、もう存在しないロゴ画面のモード `logo` も残している。そのモードで作った画像はメタデータにこれを持ち、ギャラリーのアセット（`category: other`）として読み込み・一覧・表示ができる。このモードのジョブ（旧版がキューに残した行）はワーカーの `engine_job` で `LOGO_REMOVED` により失敗し、`comfy::graph::build` も拒否する。そのパックのファイルはそのまま残す。モデルルート内の `logo` フォルダはスキャンせず、`extra_model_paths.yaml` に節を作らず、削除もしない。
- すべてのジョブは、設定されていれば GPU ロックを取る（音声も含む。`gpu_guard`）。メモリ不足による失敗は、音声ワーカーを含むすべてのエンジンでキュー項目に印を付ける。
- 動画・音楽の `engine_job` は、選んだモデルのベースがエンジンに対応しているかの検査を行わない。使うパックが未インストールなら、ジョブをエラーで断る。
- `validate`（`backend/crates/novira-core/src/comfy/client.rs`）は、ジョブごとに必要な ComfyUI のノードがあるかを `object_info` で確かめ、古い ComfyUI を断る（動画は Wan22ImageToVideoLatent、音楽は TextEncodeAceStepAudio1.5。音声は ComfyUI を呼ばないので対象外）。
- パックは `backend/crates/novira-core/src/packs.rs` で定義する。ComfyUI のパックは `<data>/models/<kind>/` に置く（`modelRoots` のフォルダの `<root>/<kind>/` にあるものも読み取り専用で見つける。[02-model-packs.md](../03-models/02-model-packs.md) を参照）。ComfyUI は `extra_model_paths.yaml` の `novira_<kind>` 節から読む。音声パックは ComfyUI のパックではない。パックのダウンロードは、そのファイルにある Hugging Face と GitHub の固定アドレスを使い、トークンは送らない（音声パックだけは設定された Hugging Face のトークンを送る）。
- `install_pack`（`backend/crates/novira-core/src/service/pack_store.rs`）はダウンロードをバックグラウンドで始める。実行中のパックへの 2 回目の要求は無視する。キャンセルすると、状態をディスク上の実態に戻す。進捗は `pack` イベントと `bootstrap` で届く。
- 三つの画面は `frontend/src/features/media/` の共通部品（パックのダウンロードカード、実行中のジョブ、シード）を使い、パックの状態は `frontend/src/state/media/packs.ts` が持つ。
- 結果はギャラリーの項目になる（`backend/crates/novira-core/src/service/worker.rs` の `save_result`）。動画と音声のファイルはそのまま `<data>/outputs/` に保存する。設定はデータベースの行だけが持ち、サムネイルは静止画（動画は最初のフレーム、音は波形）。`novira-image` スキームは `Range` 要求に答えるので、音声と動画はシークできる。
- 音声ファイルは `mp3`・`wav`・`flac`（`backend/crates/novira-core/src/media/audio.rs`）。先頭バイトが WAV・FLAC・MP3 のものだけ保存する。サムネイルの波形は、16 ビット PCM の WAV ならデコードして描き、それ以外（FLAC、MP3）はファイルのバイト列から描く。
- 動画・音楽・音声の画面だけが手段ではない。ワークフローエディタは ComfyUI 自身のノードを出し、用意済みのグラフでも同じモデルパック（これらの画面がダウンロードするファイル）で曲や動画を作り、同じようにギャラリーへ保存する。その経路は [03-workflow-graphs.md](03-workflow-graphs.md)。
- `backend/crates/novira-core/tests/media_live.rs` が音声・音楽・動画をエンドツーエンドで実行する。テストは既定で ignore され、GPU と大きなダウンロードを使う。

## 境界

| 境界 | 守るもの |
|---|---|
| パックのダウンロード | `packs.rs` にある固定の https アドレスだけ。トークンは送らない（音声は Hugging Face のトークンを送る） |
| GPU | 設定されていればすべてのジョブが GPU ロックを待つ |
| 保存する音 | 先頭バイトが WAV・FLAC・MP3 のものだけ |
| 古い ComfyUI | `validate` が必要なノードの不在で断る |

## 既知の限界

- GPU を使うので、作っている間はほかの生成が待ちになる。
- サムネイルの波形は、FLAC と MP3 ではファイルのバイト列から描いた模様で、本物の波形ではない。

## 未実装

画面ごとの「未実装」は各ページにある。三つに共通するものはない。
