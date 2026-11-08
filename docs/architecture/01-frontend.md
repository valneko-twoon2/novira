# frontend/

UI の作り: レイヤーとその向き、画面どうしのつなぎ方、機能フォルダの役割、ブラウザのモックの仕組み。上: [README.md](README.md)。変更するときにエージェントが従う規則: `.claude/rules/frontend.md`。

React 19 + TypeScript + Vite。InvokeAI v6 の画面と操作を再現する。デスクトップアプリでは Tauri IPC で Rust のバックエンドと、ブラウザではメモリ上のモックと話す。見た目の方針: フラットな面と青のアクセント 1 色（ダークテーマは既定で純黒）、グラデーションと発光は使わない。

## レイヤー

下から `backend/` → `state/` → `ui/` → `features/<name>/` → `app/`。すべて `frontend/src/` の下。

| レイヤー | 中身 |
|---|---|
| `frontend/src/backend/` | 外と話す唯一のレイヤー。`types.ts`（ワイヤ型）、`client.ts`（`BackendClient` インターフェース）、`tauri/TauriBackend.ts`（IPC、バックエンドのイベント、キューのミラー）、`http/HttpBackend.ts`（`novira-server` が配信したページで、同じ Rust バックエンドを HTTP で、イベントを WebSocket で使う）、`mock/`、`perf.ts`（起動のマークと全呼び出しの時間。`scripts/tools/perf.mjs` 用で、画面には出さない）。`index.ts` が選ぶのは、アプリでは Tauri クライアント、サーバーが印を付けたページ（`window.__NOVIRA_SERVER__`）では HTTP クライアント、それ以外ではモック（`?scenario=empty`、`?engine=install`）。モックは独立したチャンクで、`frontend/src/main.tsx` は `backendReady` が決まってからアプリ（`App.tsx`、これもチャンク）を読み込むので、デスクトップアプリはモックを読み込まない。上のレイヤーはインターフェースを使い、どれが答えるかを知らない |
| `frontend/src/state/` | zustand のストア、バックエンドのイベントをストアへつなぐ配線（`wiring.ts`）、機能どうしをつなぐレジストリ |
| `frontend/src/ui/` | 共通コントロール。`index.ts` が再エクスポートする。`canvasDraw/` はキャンバスレイヤーの描画コード（描画、合成、範囲）で、キャンバスとコミックの両方が使う |
| `frontend/src/features/<name>/` | 画面またはダイアログごとに 1 フォルダ |
| `frontend/src/app/` | 組み立ての根: プロバイダー、起動、レイアウト（`Workspace.tsx`）、サイドナビ、ホットキー。コミックとキャンバスの部品が出会う場所でもある（`ComicWorkspace`、`ComicSide`、`PageInpaintBar`。機能どうしは import しないため）。`frontend/src/app/phone/` はスマホのレイアウトで、同じ機能を狭い画面向けに組んだもの（表示の条件は `frontend/src/state/layout.ts`） |
| `frontend/src/assets/` | アプリに組み込み、コードが import するファイル（コミックの効果音の絵、ページのアイコン）。`public/` に置くのはブラウザのモックの絵だけで、デスクトップのビルドは含めない |
| `frontend/src/i18n/`、`frontend/src/theme/` | レイヤーの外で、どれも import しない。`t()` とカタログ（`ja` が元）、デザイントークン（生の色を書けるのは `tokens.css` だけ） |

レイヤーは下のレイヤーだけを import する。機能は別の機能を import しない（共有の `features/media` と `features/invoke` を除く）。機能どうしは `state/` のレジストリで出会う。例: `registerInvokeBuilder`（画面が自分の要求の組み方を伝える）、`registerAgentEditor`（画面をアシスタントが編集できるようにする）。ネットワークアクセスは `src/backend/` の中だけ。向きは ESLint（`frontend/scripts/eslint-layers.mjs`）が検査する。既存の例外はそこに 1 件ずつ列挙され、減らす方向にだけ変えられる。

## 規約

- `frontend/src/app/App.tsx` は開いた画面をすべてマウントしたままにし、別の画面を見せている間は `<Activity>` で隠す。切り替えでは作り直さず再表示する（隠れている間は effect が止まり、状態は残る）。シェル自体も同じ作りで、起動データがそろったら起動画面の下に隠して置くので、アプリを開くと見せるだけになる。画面が何百と持つコントロールは軽く保つ: ツールチップ（`frontend/src/ui/Tooltip.tsx`。Radix のものではない）は開くまでハンドラーだけ、セレクトは開いている間だけ一覧を作る。
- 機能フォルダは自分の CSS を持ち、レジストリへつなぐ箇所では `register.ts` から自分を登録する。`register.ts` は `frontend/src/app/registerFeatures.ts` が呼ぶ（そのテストが、どの画面に Invoke のビルダーかアシスタントのエディターが必要かを示す）。ダイアログの機能は入口を `index.ts` から export し、シェルがマウントする。ダイアログがどの画像やクリップで開いているかは `frontend/src/state/dialogs/` にある。
- 画面に出る文言は `src/i18n/locales/<lang>/<area>.json` に置く。ja と en のエリアファイルと言語一覧（`LOCALES`）は `i18n/catalog.ts` に登録する。ja と en は組み込みで、ほかの言語はチャンク（`i18n/bundles/<lang>.ts`）にして、選んだときに、起動時の最初の描画の前に読み込む。
- テストはコードの隣に置く（`*.test.ts[x]`。スナップショットは `*.snapshot.test.ts` で、JSON は `__snapshots__/<builder>/`）。`frontend/tests/` はソース全体にまたがる検査だけ、`frontend/e2e/` はモックに対する Playwright のテスト（`monkey.spec.ts`: 主要な全画面に対する種固定のランダム操作）、`frontend/difftest/` は同じ呼び出しをモックと `novira-server` 経由の本物のバックエンドへ送って比べるもの（`scripts/tools/diff-backends.mjs`、専用の `vitest.difftest.config.ts`）。プロパティテストは `*.property.test.ts[x]`（fast-check。実行回数と種は `src/propertyTest.testkit.ts` で固定し、`fetch` は投げるようにスタブする）。見つかった不具合は、直るまで `known bug:` コメント付きの `it.fails` テストとして残す。
- モックは決定的: 同じ入力は同じ画像になり、プロンプトの `[fail]` はジョブを失敗させる。画像は `public/mock-images/` から来る（ビルドは含めず、開発サーバーが配信する）。カバーがないものにはモックでだけカバーを付ける（`standInCover`）ので、デスクトップアプリでは空のカバーになる。そのための色フィールドや合成画像は足さない。
- 機能が別の機能と共有する純粋なヘルパーは、相手の機能の中ではなく `state/`（描画するなら `ui/`）に置く。

## 状態: どこに何があるか

素直なストア（`ui`、`settings`、`params`、`gallery`、`queue`、`models`、`canvas`、`toasts`、`engine`）以外で、名前から分かりにくいもの:

| フォルダまたはファイル | 中身 |
|---|---|
| `invoke.ts` | 「この画面の要求を組む」レジストリ |
| `generationParts.ts` | Generate タブとコミックが共有する txt2img の要求の部品 |
| `agent*.ts` | アシスタント: 要求と許可の質問、チャットのセッションと前のターンについて伝える内容（`agentHistory.ts`）、ウィンドウが実行する道具（`agentTools.ts`、`agentRegistry.ts`）、各画面について伝える内容（`agentGuide.ts`） |
| `imageTools/` | ビューアーのツールバンドにある画像ツール: 設定（保持される）、準備状況、キューのジョブと実行。どの画面にも属さない。キャンバスは読み取ったポーズの置き先を登録し（`posePlacer.ts`）、スマホのレイアウトは画像の見せ方を登録する（`setToolViewer`） |
| `comfy/` | フロントから見た ComfyUI: ノード定義、拡張機能のインストールと提案、Registry の一覧、アプリが書いたプロンプトをキューに入れて結果を待つ `graphJob.ts` / `runGraph.ts` |
| `comic/` | コミックのプロジェクト: ドキュメント、ストア、レイアウト、フキダシ、要求、永続化。ページのレイヤーは `page.canvas` にあるキャンバスレイヤーで、ページごとに 1 つのキャンバスストア（`pageCanvas.ts`、`paintMode.ts`）を通して編集する |
| `pose/`、`poseSkeleton.ts` | OpenPose のスケルトンの計算とプリセット。キャンバスとコミックが共有する |
| `prompts/`、`presets/` | プロンプトブック、タグ、ワイルドカード、ダイナミックプロンプト。全生成画面のプリセット。初期データは `seed/` の JSON |
| `uiState.ts` | `novira.*` のストレージキーすべて。バックアップ、復元の後、範囲を限ったリセットのため |
| `canvas.ts`、`canvasStoreContext.ts` | `canvas.ts` はキャンバスストアを作る（`createCanvasStore`: Image タブの全体用 1 つと、コミックのページごと）。コンテキストは、キャンバスのコンポーネントがどのストアを操作するかを伝える |
| `canvasDocument.ts`、`canvasPersistence.ts` | キャンバスレイヤーの保存形式（キャンバスとコミックのページが共有）。変更の 1 秒後にキャンバスをバックエンドへ保存する |

## 機能

`frontend/src/features/` は画面ごとに 1 フォルダ。多くは名前で分かる。説明が要るもの:

| フォルダ | 中身 |
|---|---|
| `params/`、`invoke/`、`launchpad/`、`drafts/` | Generate とアップスケールの左パネル、Invoke バー、タブごとのスタートページ、下書き（描きかけのシードのバッチ） |
| `media/`、`video/`、`music/`、`voice/` | 動画・音楽・音声の画面。`media/` は共有部分（プリセットカード、シード行、モデル選択、モデル適合マーク） |
| `canvas/`、`text/`、`comic/`、`workflows/` | キャンバスタブ、テキストタブ、コミックタブ、ノードエディターと拡張機能タブ |
| `gallery/`、`viewer/`、`queue/`、`share/` | ギャラリー、画像ビューアー（マンガ仕上げのダイアログは `viewer/manga/`。画像ツールのツールバンド、つまり顔の修正・背景の除去・説明・ポーズの読み取りは `viewer/tools/`）、キュータブ、共有用の書き出し（透かしのスイッチ、「画像を調べる」） |
| `models/`、`browse/` | モデルマネージャー、ブラウズタブ（Civitai、Hugging Face） |
| `derive/`、`pose/`、`xyplot/`、`batch/`、`finish/` | 画像、複数の画像、クリップ、選択範囲に対するダイアログ。`derive` は保存された設定で画像をやり直し、`finish` はクリップをなめらかにするか拡大する。多くは `state/comfy/graphJob.ts` 経由でグラフをキューに入れる |
| `agent/`、`engine/`、`devlog/`、`splash/`、`settings/`、`downloads/` | どの画面の周りにもあるもの: アシスタント、エンジンのバナー、開発者ログ、起動画面とそのゲート、設定、ダウンロードのドック |

## ブラウザのモック

`frontend/src/backend/mock/` は、ブラウザとテストが使う代役。`MockBackend.ts` がクライアント、`mockEngine.ts` が模擬エンジン（拡張機能、ComfyUI のバージョン、低メモリモード、エンジン設定）。`imageSynth.ts`、`videoSynth.ts`、`audioSynth.ts` は決定的な結果を作る。`agent*.ts` はアシスタントの規則を、ウィンドウのディスパッチャーを通る台本どおりの道具呼び出しにしたもの。`guidance.ts` はバックエンドの案内の検査を繰り返す。バックエンドの動きを変えたら、モックも一緒に変える。そうしないとブラウザのテストがアプリを表さなくなる。

## `src/` の外

`frontend/scripts/` はローカルの lint 規則とフロントに結びつくスクリプト（改行、i18n とマニュアルの同期、スクリーンショットの `shot.mjs`）、`frontend/tests/` はソース全体のテスト、`frontend/e2e/` は Playwright のフロー、`visual.spec.ts`（基準画像は `__screenshots__/`）、テキストの収まりを含むレイアウトスキャン `layout.spec.ts`（規則は `layoutRules.ts`、`textFit.ts`）を置く。各検査が何を止めるか: [04-guards.md](04-guards.md)。
