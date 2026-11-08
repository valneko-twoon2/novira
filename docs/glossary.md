# 用語集

画面で使う言葉（日本語。アプリの表示どおり）、それぞれの意味、その裏にあるコードやファイルの名前。1 つの言葉が 2 つの意味を持つときは両方を挙げる。画面の日本語は `frontend/src/i18n/locales/ja/` のカタログによる。`code font` の名前はコードまたはファイルの名前。

画面の言葉を変えたら、ここの行も更新する（`/i18n` スキル）。このページは言葉の意味を説明する。ある概念に ja と en でどの言葉を使うか、使ってはいけない言い換え（インストールに導入、拡張機能に "pack"、英国式の綴り、HuggingFace のような誤った名前）は、用語リスト `frontend/src/i18n/glossary.json` にあり、テストと pre-commit フックが検査する。ここでは繰り返さない。

## 製品名

| 用語 | 意味 | 表記 |
|---|---|---|
| novira | このアプリの名前。「novira について」画面のロゴも小文字 | どの言語でも、ドキュメント、コメント、テスト、コミットメッセージでも、文頭でも、常に小文字の `novira`。大文字を使った綴りは書かない |

これを含む名前は小文字のまま: `novira.exe`、データフォルダ `novira-data/`（`NOVIRA_DATA_DIR` で変更できる）、バックエンドのクレート `novira-core`、ウィンドウタイトルの `novira`。

ウィンドウタイトルと、どの言語の画面の文言も小文字。コメント、テスト、architecture のページは "novira" と書いてよいことがある。

## 画面

| 画面の言葉 | 意味 | コード・場所 |
|---|---|---|
| 生成 (Generate) | プロンプトを書いて画像を作る | `features/invoke`, `features/params` |
| キャンバス (Canvas) | 1 つの面にレイヤーで描き、合成する | `features/canvas`, `state/canvas.ts` |
| 漫画 (Comic) | プロジェクトでできた漫画のページ。ページ、それぞれ自分の絵とポーズを持つコマ、吹き出し、ナレーション。プロジェクトは 1 つのデータベース行として保存する | `features/comic`, `state/comic/`, `comics` テーブル |
| アップスケール (Upscaling) | アップスケールのワークフローで画像を拡大する | `features/launchpad/UpscalingLaunchpad.tsx` |
| ワークフロー (Workflows) | 編集・保存できるノードグラフ。ComfyUI に送るグラフはここから組み立てる | `features/workflows`, `comfy/`（バックエンド） |
| モデル (Models) | 持っているモデルファイル。インストールと削除 | `features/models` |
| キュー (Queue) | 待機中か処理中の生成ジョブと、その状態 | `features/queue`, `types.rs` の `QueueItem` |
| 探す (Browse) | インターネット（Civitai、Hugging Face）でモデルを探して取り込む | `features/browse` |
| ギャラリー (Gallery) | novira が持つ画像を、画像またはアセットとして表示し、ボードでまとめる。デスクトップでは右側のパネル全体（ボードと画像を一緒に）、スマホではギャラリーのタブ | `features/gallery`, `app/phone` |
| AI アシスタント (AI assistant) | 質問に答え、いくつかのフォームを代わりに設定できるチャット画面 | `features/agent`, `backend/crates/novira-core/src/agent/` |
| 設定 (Settings) | アプリの設定。「novira について」ダイアログは設定メニューから開く | `features/settings` |
| 拡張機能の管理 (Extension manager) | ComfyUI のカスタムノードパックのインストール、更新、削除 | `features/workflows/ExtensionsTab.tsx` |
| novira について (About) | バージョン、オープンソース一覧、ライセンス | `features/settings/AboutModal.tsx` |

## ギャラリー

| 画面の言葉 | 意味 | コード |
|---|---|---|
| 画像 (Images) | ギャラリーの画像ビューにある画像（カテゴリ `General`） | `ImageCategory::General` |
| アセット (Assets) | 生成結果ではない画像。アップロード、マスク、制御用の画像などの入力 | `General` 以外の `ImageCategory` すべて |
| ボード (Board) | ギャラリーの、名前をつけた画像のまとまり。新しい画像を自動で受け取るよう設定できる（自動） | `gallery.boards.*` |
| アーカイブ (Archive) | ボードを削除せずに一覧から隠す | `gallery.boards.archive` |

## 生成

| 画面の言葉 | 意味 | コード |
|---|---|---|
| ジョブ / キューの項目 (Job, queue item) | キューにある 1 件の生成リクエスト | `types.rs` の `QueueItem` |
| 待機中 (Pending) / 処理中 (In progress) / 完了 (Completed) / 失敗 (Failed) / キャンセル (Canceled) | キューの項目の状態 | `queue.status.*` |
| 一時停止中 (Paused) | キューの処理が一時停止している。実行中の作業は始まらない | `queue.processor.paused` |
| 下書き (Draft) | ステップの途中で止めた粗い絵。本番の実行の前にシードを選ぶためのもの | `GenerationMetadata.draftAt` |
| まとめて処理 (Batch) | 1 つの操作（背景の除去、アップスケールなど）を多数の画像に実行する | `batch.*` |
| 比較グリッド (XY plot) | 1 つか 2 つの設定を列と行で変えた画像の表 | `xyplot.*` |
| シード (Seed) | 乱数の開始ノイズを固定する数。同じ設定で同じシードなら同じ画像になる | `seed` |
| プリセット (Preset) | もう一度適用できる、保存した設定 | `presets.*` |
| キャラクター (Character) | 1 人のキャラクターについて保存した、参照画像と言葉のセット | `character.*` |
| ポーズ (Pose) | 関節を動かして人物のポーズを決める棒人間 | `pose.*` |
| 範囲を選んで直す (Select and fix a part) | 空のインペイントマスクとブラシつきで画像をキャンバスに開く。塗った部分を消す、切り抜く、描き直す | `state/partFix.ts`, `canvas.partFix.*` |
| 顔を直す (Face fix) | 顔を見つけ、高い解像度で描き直す。拡張機能の Impact Pack が要る | `facefix.*` |
| 背景を除去 (Remove background) | 被写体を切り抜き、背景を透明にする | `cutout.*` |
| 絵からプロンプトを作る (Caption) | Florence-2 で画像のタグか文を書く | `caption.*` |
| 直す (Fix group), 画像のツール (Tool band) | 顔を直す、背景を除去、説明の作成、ポーズの読み取りをまとめた画像メニューのグループ。項目は前回の設定ですぐ実行する。歯車を押すと、ビューアの画像の上に設定、実行、結果のバンドが開く | `gallery.tools.*`, `state/imageTools/`, `features/viewer/tools/` |

## 漫画

| 画面の言葉 | 意味 | コード |
|---|---|---|
| プロジェクト (Project) | 1 つの名前の下にある 1 つの漫画と、そのページ。プロジェクトの一覧は左のパネルにある | `ComicProject`, `comics` テーブル |
| ページ (Page) | 漫画の 1 枚。コマは番号で自動的に配置される | `ComicPage`, `state/comic/layout.ts` |
| コマ (Panel) | ページの 1 つの枠。自分のプロンプト、画像、任意のポーズを持つ | `ComicPanel` |
| 吹き出し (Balloon) | しっぽのある吹き出しの中のセリフ。コマの上に置く | 種類 `speech` の `ComicBubble` |
| ナレーション (Caption) | 飾りのない箱の中のナレーション。コマの上に置く | 種類 `caption` の `ComicBubble` |
| 3D ラフ (3D rough) | 3D で配置したコマ。マネキン、箱、板、円柱、床をカメラ越しに見て、コマのポーズ画像と深度マップに焼き込む | `ComicRough`, `state/comic/rough.ts` |

## モデル

| 画面の言葉 | 意味 | コード |
|---|---|---|
| モデル (Model) | モデルファイル。チェックポイント、LoRA、VAE、ControlNet、アップスケーラーなど | `models` テーブル, `models/` |
| ベース (Base) | モデルが属する系統（例: SD1.X、SDXL）。LoRA は同じベースのモデルとだけ使える | `lora.modelHint` |
| 種類 (Kind) | モデルの役割: チェックポイント (checkpoint)、LoRA、VAE、ControlNet、アップスケーラー (upscaler) | `models.type.*`, `models.rail.*` |
| トリガーワード (Trigger word) | LoRA を呼び出すプロンプト中の言葉 | `lora.trigger` |
| ライセンスの札 (License tag) | モデルの商用利用の札。ライセンスを要約する | `CommercialTag` |
| 変換 (Convert) | チェックポイントを Diffusers 形式にする | `models.convertConfirm` |

## エンジンと拡張機能

コードでは "pack" が 2 つの別のものに使われる。画面では、1 つめを拡張機能と言い、2 つめは用途で呼ぶ。

| 画面の言葉 | 意味 | コード |
|---|---|---|
| エンジン (Engine) | 画像生成のエンジン。Python つきの ComfyUI で、novira がダウンロードして起動する | `novira-core/src/engine.rs`, `comfy/`, `novira-data/comfyui/` |
| 拡張機能 (Extension) | ComfyUI にインストールするカスタムノードパック | `comfy/node_packs.rs` |
| おすすめの拡張機能 (Suggested extension) | novira がすすめるカスタムノードパック。全言語の説明つき。画面ではこれも pack ではなく拡張機能と呼ぶ | `state/comfy/packCatalog.ts` の `PACK_CATALOG` |
| カスタムノード (Custom node) | 拡張機能と同じものを指す ComfyUI の用語 | ComfyUI |
| ComfyUI レジストリ (ComfyUI Registry) | 拡張機能の管理が検索する、カスタムノードパックの公開インデックス | `comfy/registry.rs` |
| *Model pack* (モデルセット) | 動画、音楽、音声が必要とする追加のモデルファイル。求めに応じてダウンロードする。画面では 動画のモデル、音楽のモデル などの題で出る | `packs.rs` |

## インストール

| 言葉 | 意味 | 備考 |
|---|---|---|
| インストール (Install) | エンジン、拡張機能、モデルをこの PC に置く | ダウンロード (Download) は転送そのもの。その進み具合と、ブラウザが保存するファイル |
| データフォルダ (Data folder) | novira が保つものすべて: 画像、モデル、エンジン、設定。既定は `novira-data/`（リリースビルドではユーザーフォルダの中） | `NOVIRA_DATA_DIR` で変更できる |

## モードとコードの部品

| 用語 | 意味 |
|---|---|
| モック (Mock) | ブラウザのモード。画像は作り物のサンプルで、ファイルにもネットワークにも何も届かず、再読み込みでデータは消える |
| デスクトップアプリ (Desktop app) | Rust のバックエンドを持つ Tauri のウィンドウ |
| `novira-core` | バックエンドのライブラリ。ストレージ、キュー、ComfyUI アダプター、モデル、アシスタント。Tauri のコードは含まない |
| `src-tauri` | 薄い Tauri シェル。IPC コマンド、画像の URL、ウィンドウ設定 |
| `BackendClient` / `TauriBackend` / `MockBackend` | フロントエンドからバックエンドへの唯一のインターフェースと、そのデスクトップ実装、ブラウザのモック。`frontend/src/backend/client.ts` を参照 |
| contract | フロントエンドとバックエンドの間で送る型: `frontend/src/backend/types.ts` と `backend/crates/novira-core/src/types.rs` |
| 規則 (rule) / スキル (skill) | コーディングエージェント向けの、`.claude/rules/` の作業規則と `.claude/skills/` の手順 |
