---
covers:
  - backend/crates/novira-core/src/voice/**
  - backend/crates/novira-core/src/media/audio.rs
  - backend/crates/novira-core/src/child_job.rs
  - frontend/src/state/media/voice.ts
  - frontend/src/features/voice/**
---
# 音声の生成画面

一覧に戻る: [README.md](README.md)

Qwen3-TTS でテキストを読み上げる画面。ComfyUI のジョブではなく、ComfyUI の Python で起動する専用の Python ワーカープロセスが読み上げる。キューと保存は [共通のページ](../02-media-workflows/01-media-generation.md) にある。

## 動作

- 画面: 読み上げる文章、言語、声の決め方（「ボイスを選ぶ」「声を言葉で作る」）、ボイス（プリセット）、話し方（プリセットでは任意）または声の説明（デザインでは必須）。文章が空、デザインで説明が空、エンジンが未インストールのとき、フォームは Invoke を断る。
- モデル: Qwen3-TTS。`backend/crates/novira-core/src/voice/mod.rs` によれば Apache-2.0。1.7B のリポジトリを 2 つダウンロードする。プリセットモード（組み込みの話者。フォームは 9 つ出す。既定は Ono_Anna）は `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`、デザインモード（言葉で表した声）は `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`。フォームは `Auto` のほかに 10 言語を出す。
- 実行環境: `QwenVoice` は `backend/crates/novira-core/src/voice/worker.py`（`<data>/voice/worker.py` にコピー）を、`comfyuiPython` の Python、未設定なら ComfyUI のフォルダにある Python で起動する。要求と応答は JSON 行で、応答ごとに目印が付くため、標準出力に出るライブラリの出力は無視する。ライブラリのログは `<data>/logs/voice.log` へ。ワーカーは `HF_HUB_OFFLINE=1` を設定し、モデルは一度に 1 つだけ保持し、`cuda:0` に bfloat16 で読み込み、WAV を書く。
- ライブラリは `<data>/voice/site` から読む。音声の経路は ComfyUI のサーバーを呼ばず、`validate` の対象でもない。ほかのジョブと同じく GPU ロックを取る。Read Aloud ノードを含むワークフローのグラフは、ComfyUI を実行する前に同じエンジンを使う（[03-workflow-graphs.md](../02-media-workflows/03-workflow-graphs.md) を参照）。読み上げの後はワーカーを止め、ComfyUI が GPU のメモリを使えるようにする。
- 寿命: ワーカーは最初の要求で起動し、ready 行を待つ。要求の間は保持し、要求が 300 秒来なければ止める。アイドル確認は 30 秒ごと。デバッグビルドでは `NOVIRA_TEST_VOICE_IDLE_MS` でアイドル時間を短くできる。1 件の応答を待つのは 900 秒で諦める。Windows ではワーカーをジョブオブジェクトに結び付け（`backend/crates/novira-core/src/child_job.rs`）、`Backend::shutdown` が最初にこれを止める。
- 実行中の要求をキャンセルするとプロセスを kill する。次の要求は新しいプロセスを起動する。
- 空のテキストは拒否する。WAV は `<data>/cache/temp` に書いて読み込み、ギャラリーの項目を保存する前に一時ファイルを削除する。`<uuid>.wav` として `mediaType: audio` で保存する。16 ビット PCM の WAV はデコードされるので、サムネイルは本物の波形（`backend/crates/novira-core/src/media/audio.rs`）。
- インストール（`voice::install`）: 同じ Python が必要。`qwen-tts` に対して `pip install --dry-run --report` を実行し、追加されるライブラリからデモ専用のもの（`SKIPPED_LIBRARIES`）を除いて、`pip --target <data>/voice/site --no-deps` でバージョンを固定してインストールする。続いて `.ready` を書く。その後 Hugging Face のツリー API でモデルのリポジトリを一覧し、モデルファイルだけ（README・画像・Markdown・ドットファイル・アセットフォルダは除く）を `.downloads/<n>.part` にダウンロードし、完了したものから名前を変え、モデルごとに `.complete` を書く。完了済みのファイルは再実行時に飛ばす。Hugging Face のトークンは、設定されていれば送る。
- キャッシュ（Hugging Face、Torch、pip、一時ファイル）は、音声のプロセスに対して `<data>/cache/` へ振り向ける。
- RTX 4070 Ti で 1 回計測: 日本語 1 文が、コードがインストールしない 0.6B モデルで約 12 秒。エンドツーエンドのインストール後の別の実行では約 19 秒。

## 境界

| 境界 | 守るもの |
|---|---|
| プロセス | Python を直接起動し、要求は stdin の JSON 行。Windows ではジョブオブジェクトに結ぶ |
| オフライン | ワーカーは `HF_HUB_OFFLINE=1`。モデルはディスク上のフォルダ |
| ディスク | キャッシュと一時ファイルはデータフォルダの `cache/` に閉じる |
| ダウンロード | Hugging Face のリポジトリ（固定の 2 つ）のモデルファイルだけ。トークンは設定されていれば送る |
| 空の文章 | ワーカーが拒否する |

## 既知の限界

- ワーカーは `cuda:0` を使う。CPU や別の GPU では動かない。
- 初回の読み上げはモデルの読み込みで時間がかかる。しばらく使わないとモデルは GPU から外れる。
- 計測値の 0.6B モデルは、コードがインストールするモデルではない。

## 未実装

現在のコードにないもの。

- 録音からの声のクローン（上の 2 モデルだけ）。
- CPU や別の GPU での音声。
- ストリーミング読み上げ（要求ごとにクリップ全体を返す）。
