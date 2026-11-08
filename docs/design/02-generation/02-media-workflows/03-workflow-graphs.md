---
covers:
  - backend/crates/novira-core/src/comfy/user_graph.rs
  - backend/crates/novira-core/src/comfy/client.rs
  - backend/crates/novira-core/src/service/worker.rs
  - frontend/src/features/workflows/comfyPrompt.ts
  - frontend/src/features/workflows/comfyNodes.ts
  - frontend/src/features/workflows/invokeBuilder.ts
  - frontend/src/features/workflows/promptSummary.ts
  - frontend/src/features/workflows/templates.ts
  - frontend/src/features/workflows/graphTemplates.ts
  - frontend/src/state/comfy/comfyNodes.ts
  - frontend/src/state/comfy/graphJob.ts
  - frontend/src/state/comfy/runGraph.ts
---
# ワークフローグラフの実行

一覧に戻る: [README.md](README.md)

ワークフローエディタのグラフを実行したときに起きること。実行前の検査、エディタがグラフからコンパイルする ComfyUI のプロンプト、エディタが出す ComfyUI のノード、バックエンドがプロンプトとその結果に対して行うこと。グラフはすべて、組み込みノード、ComfyUI 自身のノード（画像・動画・音楽、どれでも）、カスタムパックのノードのいずれも、そのプロンプトとして ComfyUI へ送られ、結果は画像・テキスト・音・動画のいずれかになる。組み込みの Read Aloud ノード（`voice_speak`）は、実行の前に音声エンジンで読み上げを作らせる。バックエンド独自の動画経路で動くのは、Generate Video ノードで動画を作るグラフだけ。エディタ、保存したワークフロー、ファイルは [02-workflows.md](02-workflows.md)、パックのインストールは [02-extensions.md](../../01-app/03-engine/02-extensions.md) にある。

## 動作

### 実行可否と要求

- 実行可否（`readinessReasons`、`frontend/src/features/workflows/invokeBuilder.ts`）は、次の場合に実行を止める。出力ノードがない。必須の入力が接続も設定もされていない。値を持たない Integer・Float・String・Boolean ノードが入力に繋がっている（空のテキストは必須入力の場合だけ。ComfyUI のウィジェットは必須と印されず、要求からは省かれる）。無効なエッジがある。サンプラーに繋がる IP-Adapter ノードに拡張機能か画像エンコーダがない（`packMissing`、`encoderMissing`、`frontend/src/state/comfy/packNeeds.ts`）。ComfyUI ノードの選択肢（モデルファイル）が未設定（入力不足として報告）、ComfyUI がいま報告する一覧にない、または一覧が空（`choiceReasons`）。接続された ComfyUI ノードの拡張機能がなくなった（その旨を示す。そのエッジは無効なエッジとして二重に数えず、接続されていなければ止めない）。プロンプトをコンパイルできない。
- `buildRequest` は 2 種類の要求のどちらかを作る（`runsAsPrompt`）。
  1. ComfyUI のプロンプト: Generate Video ノードがあり ComfyUI やパックのノードがないグラフを除く、すべてのグラフ。`frontend/src/features/workflows/comfyPrompt.ts` がグラフを ComfyUI の API プロンプトにコンパイルする。組み込みノードはコアノードになり、ComfyUI とパックのノードは有効な入力（後述）とともにそのまま通る。IP-Adapter ノードは、サンプラーが動かすモデルに対する `IPAdapterModelLoader`・`CLIPVisionLoader`・`IPAdapterAdvanced` になる。Integer Math と Float Math は、単純な数値からコンパイル中に計算する。組み込みノードが自分で持つ画像は、そのノード専用の `LoadImage` で読み込む。バックエンドだけが知るものにはプレースホルダを置く: `$model`、`$clip_vision`、`$image`、`$sampler_name`、`$scheduler`、`$seed`、`$speech`。Read Aloud ノードは、`audio` が `{"$speech": {text, language, mode, speaker, instruct}}` の `LoadAudio` になる（テキストはノードに入力するか String ノードから来る必要があり、プリセットの声や言葉で表した声は音声タブの規則に従う）。要求はモード `graph` と `comfyGraph`（`prompt`、`outputs`）を持ち、Save Image が最初の出力になる。繰り返し回数は `state/params` から、ボードは Save Image から来る。params はギャラリーのために実行を説明するだけ。組み込みノードでは、モデル・VAE・LoRA のノード、プロンプト、サンプラーの設定、ノイズノードのサイズ、画像から画像へのグラフの強さ。ComfyUI 自身のノードのグラフでは、`promptSummary.ts` がコンパイル済みプロンプトから読み取るもの（最初のサンプラー、そのコンディショニングの元のテキスト、読み込むモデル、潜在のサイズや長さ、Create Video のフレームレート）。
  2. 動画（Generate Video ノードがありパックのノードがない場合、`buildVideoRequest`）: そのフィールドと配線された画像が `video` 要求になる。パックのノードがあると Generate Video ノードは拒否される。
- 生成モード `workflow` はもう送らない。古い画像はこれを持ち、`comfy/graph.rs` もこのモードのプロンプトを今も組める。
- どの要求もシリアライズしたグラフを運ぶ。ワーカーはそれを PNG に `novira_workflow` として書き込む（`service/worker.rs`）ので、画像はグラフを保持する（`ImageDTO.workflow`）。

### バックエンドのグラフジョブ

- エンキュー（`service/queue.rs`）は `comfyGraph` と `workflow` を検査せずにコピーする。
- `graph_job`（`service/worker.rs`）は `user_graph::prepare`（`backend/crates/novira-core/src/comfy/user_graph.rs`）を呼ぶ。次を拒否する: 出力がない。出力やサムネイルがプロンプトにない。`class_type` や `inputs` のないノード。存在しないノードへのリンク。上の 7 つ以外のプレースホルダ。未知のスケジューラー。未知の CLIP vision サイズ。ライブラリにないモデルキー（`resolve_model`）。テキストがない読み上げ、4000 文字を超えるテキスト、500 文字を超える説明、説明のない言葉で表した声、異なる読み上げが 8 個を超えるもの。
- `$model` は ComfyUI が読み込むモデルファイルになる。`$clip_vision`（`ViT-H`、`ViT-G`、`ViT-L`）は、そのサイズでインストール済みの CLIP vision モデルになる。参照画像が自分のものを見つけるのと同じ方法で探す（`clip_vision_model`、`backend/crates/novira-core/src/service/guidance.rs`）。どちらも ComfyUI のモデル一覧と照合する。`$image` は有効なギャラリーのファイル名でなければならない（`images::is_valid_name`、`original_path` 経由）。画像はジョブの実行時に ComfyUI の入力フォルダへアップロードする。`$seed` はその項目のシード。`$speech` は `{"$image": "speech-<n>.wav"}` になる。同じ読み上げを 2 回書いても 1 回だけ作り、名前はギャラリーから読まない（`PreparedGraph.speeches`）。
- 読み上げ（`process`、`speak_for_graph`、`backend/crates/novira-core/src/service/worker.rs`）: 読み上げのあるグラフは、まず GPU ロックを取り、次に音声エンジンが 1 つずつ読み上げ（`synthesize`。音声タブのジョブと同じ呼び出し）、WAV をその実行のアップロードに加える。その後、ComfyUI が必要とする GPU メモリをモデルが持っているため音声ワーカーを止め、それから初めて ComfyUI を実行する。読み上げが失敗した場合（エンジンが未インストール、エラー、キャンセル）は、ComfyUI に頼む前にジョブを終える。
- エンジン（`backend/crates/novira-core/src/comfy/client.rs`）は、ComfyUI がモデルを見えていること、およびすべてのノードクラスがその `object_info` にあることを検査し（`validate_graph`）、画像・動画・音を拡張子でアップロードして実行する。読み取るのは最初の出力の結果だけ（`outputs.first()`）。
- 結果の種類は、その出力が保存したファイルで決まる（`fetch_result`、`result_kind`）。`.mp3`・`.wav`・`.flac` は音で、`store_audio` が保存する（波形のサムネイル）。`.mp4` は動画で、グラフの `thumbnail` ノードが表示した最初のフレームとともに保存する（`store_video`。そのノードがない動画は拒否する）。それ以外は画像。`.opus`・`.ogg`・`.m4a`・`.aac` の音と `.webm`・`.mkv`・`.mov` の動画は、ギャラリーが保持するのは MP3・WAV・FLAC・MP4 だけなので、対処法を添えて拒否する。
- テキスト: その出力がファイルなしでテキストを報告した場合（`PreviewAny`）、結果は `EngineOutput::Text` になる。項目は `resultText` つきで完了し、画像は保存されず、`image_added` イベントも送られない。フロントエンドは `runTextJob`（`frontend/src/state/comfy/runGraph.ts`）で待つ。

### ComfyUI のノード定義

- `useComfyNodes`（`frontend/src/state/comfy/comfyNodes.ts`）は ComfyUI の `object_info`（`node_defs` コマンド）を保持する。スプラッシュのゲートは、バックエンドとエンジンの準備ができたときに一度これを読み込み（`frontend/src/features/splash/useSplashGate.ts`）、ComfyUI のバージョン切り替えや再起動の後に再読み込みする（`frontend/src/state/comfy/nodePacks.ts`）。新しくインストールしたパックは、その再起動の後に現れる。
- `frontend/src/features/workflows/comfyNodes.ts` は、カスタムパックの各ノードと ComfyUI 自身の各ノード（`nodes` と `comfy_extras.*`）を、型 `comfy:<ClassName>` のテンプレートにする。非推奨のノードと、クラウド API のノード（`api_node`、`comfy_api_nodes.*`。有料サービスのアカウントが要る）は飛ばす。ピッカーは ComfyUI のノードをカテゴリの最初の 2 つの部分でまとめ、独自の見出し（`group`）の下に置く。各テンプレートはカテゴリ全体（`comfyCategory`。ノードタブのフォルダ）と ComfyUI の一覧での位置（`comfyOrder`。その並び順）も保持する。
- エディタに相当物がある型はそれに対応づける。プリミティブはフィールドに、選択肢の一覧は enum になる（一覧の中の数値は数値として戻る: `values`）。アップロード入力はギャラリーのピッカーになる: 画像（`image_upload`）、動画や音（`video_upload`、`audio_upload`: `media` を持つフィールドで、そのギャラリーファイルはグラフの実行時にアップロードされる）。`hidden` と印された入力は出さない。
- V3 の動的コンボ（Save Audio の形式、Save Video のコンテナとコーデック）は、enum と、各選択肢がもたらす入力が続くものになる。入力はプロンプトでの名前（`format.quality`）で呼び、その選択肢が選ばれている間だけ表示する（`when`、`isActive`）。複数の選択肢に同じ定義で現れる同じ入力は 1 つの入力にまとめる。定義が異なる場合（MP3 と Opus の品質）は 2 つ目の入力 `format.quality#2` になり、プロンプトには `format.quality` として入る（`promptName`）。自動で増える入力は未対応として一覧する。
- アプリの言語での ComfyUI 自身の言葉（`comfy_ui_locale`、`backend/crates/novira-core/src/comfy/ui_locale.rs`）: 実行中の ComfyUI が配信するフロントエンドのロケールファイルをデータとして読み、`frontend/src/state/comfy/comfyUiLocale.ts` に保持し（ノード定義の読み込み時と言語の変更時に読む）、`frontend/src/features/workflows/comfyWords.ts` を通して使う。対象はカテゴリ、見出し、ノード・入力・出力の名前、説明、ヘルプ。言葉がない場合（英語、ない言語、パックのノード、ブラウザのモック）は元の名前のまま。
- ブラウザのモックは、ComfyUI 自身のノードを ComfyUI の順で出す。手作りの `comfyCoreDefs.json` と、モックだけが読む `comfyMoreCoreDefs.json`（`frontend/scripts/mock-comfy-defs.mjs`。ファイル名を挙げる選択肢は空にしてある）。
- 目的別にまとめたレジストリのパック: [02-extensions.md](../../01-app/03-engine/02-extensions.md)。

## 境界

| 境界 | ガード |
|---|---|
| ComfyUI へ送るグラフ（`comfyGraph`） | `user_graph::prepare` が構造とプレースホルダを検査する。`$image` はギャラリーのファイル名（画像・動画・音）だけ、`$model` はライブラリのキーだけ、`$clip_vision` は 3 つのサイズのどれか、`$speech` は長さに上限のあるテキストと説明（異なる読み上げは 8 個まで）。`validate_graph` は ComfyUI が報告するクラスだけを受け付ける。 |
| ComfyUI のロケールファイル（`ui_locale.rs`） | アプリの言語だけ。ファイル名は英数字・`-`・`_`・`.` で `.js` で終わるもの。1 ファイル 8 MB まで。データとしてだけ読む（リテラル、ほかの宣言の名前、テキストの `JSON.parse`、エクスポート一覧）。それ以外があるとファイルは読めないものとして扱い、言葉はなくなる。入れ子は 64 まで。 |
| 戻ってくるもの | 結果ファイルの拡張子が種類を決める。ギャラリーが保持する形式だけを保存する（`result_kind`）。`store_audio` と `store_video` が名前と内容を検査する。 |

## 既知の限界

- グラフジョブは深さにもノード数にも上限がない。保存したワークフローはサイズだけに上限がある。
- 読み取るのは最初の出力の結果だけで、画像・テキスト・音・動画のいずれか。音や動画を保存する出力は、グラフが同時に表示する画像より前に来る。動画の最初のフレームは、コンパイラが保存ノードの横に加える `GetVideoComponents`・`ImageFromBatch`・`PreviewImage` から取る（`thumbnailOf`）。ギャラリーが保持するのは MP3・WAV・FLAC・MP4 だけ（上記）。音や動画のグラフはその項目とともに保持し（`ImageDTO.workflow`）、画像は PNG の中に保持する。
- ComfyUI の一覧で数値の選択肢は、テキストとして一致するものを選んだときだけその数値として戻る。ほかの型の一覧は扱わない。
- コンパイラは、ノード名を示して次を拒否する: Collect・Iterate・Range。ボックスブラー。数値が単純でない Math ノード（ランダムシードが入る、またはゼロ除算のように結果がない）。サンプラー以外に配線された ControlNet や IP-Adapter の出力。自分自身へ戻るグラフ（エディタとアシスタントの `connect` は輪を閉じる接続を拒否し、読み込みはそれを捨てるので、コードで組んだグラフだけが持ち込める）。
- 読み上げは、ComfyUI を始める前に実行ごとに 1 回、さらに繰り返しごとに作る。そのテキストは ComfyUI が実行するノードからは取れず、読み上げるグラフには音声エンジンのインストールが必要（Invoke の検査がそう伝える）。Create Video は音を動画の長さに切る。
- ComfyUI のノードは持っているシードを保つ。固定シードは結果を繰り返す。実行のたびに新しいものを使うには、Random Integer ノードをそのシードに配線する（用意済みのグラフはそうしている）。
- 組み込みの Face Detailer ワークフローには顔検出がなく、Canny のエッジと IP-Adapter に導かれて画像全体を描き直す。
- ComfyUI の言葉を読むのは、ComfyUI 0.35.1（フロントエンド 1.51.10）と同じ形で作られたフロントエンドからだけ。ページ、`i18n` のマップ、データだけのロケールモジュール。別のビルドでは言葉が得られず、名前は英語のまま。カスタムノードパック自身の翻訳は読まない。
- 入力値はフィールドの型に対して検査しない。コンパイラはフォールバックつきで読み、ComfyUI とパックのノードには値をそのまま渡す。検査は、選択肢が ComfyUI の一覧にあることだけ。

## 未実装

- ComfyUI やパックのノードのグラフの中の Generate Video ノード（`unsupported` として拒否する）。
- ComfyUI の自動で増える入力（複数の音や動画を 1 つのノードへ）。
- 最初の出力ノードより多くの結果。
- Opus や Ogg の音、WebM や MKV の動画（ギャラリーは保持できない）。
