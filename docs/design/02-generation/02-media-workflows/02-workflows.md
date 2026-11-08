---
covers:
  - backend/crates/novira-core/src/service/workflows.rs
  - frontend/src/backend/defaultWorkflows.ts
  - frontend/src/state/workflows/**
  - frontend/src/features/workflows/**
---
# ワークフロー

一覧に戻る: [README.md](README.md)

ワークフロータブのノードワークフローエディタ、それが保存するワークフロー、グラフを実行するもの。グラフの実行、エディタが出す ComfyUI のノード、結果に対してバックエンドが行うことは [03-workflow-graphs.md](03-workflow-graphs.md)、パックのインストールは [02-extensions.md](../../01-app/03-engine/02-extensions.md)、アシスタントの編集は [01-assistant.md](../../03-assistant/01-core/01-assistant.md) にある。

## 動作

### 保存したワークフロー

- 保存するのはユーザーのワークフローだけ。`workflows` テーブル（`backend/crates/novira-core/src/db.rs` の `Table::Workflows`）に 1 件 1 行で、`updated_at` 順に並べ、`bootstrap`（`service/mod.rs`）のためにメモリにも持つ。ワイヤ型 `SavedWorkflow`（`types.rs`）は、id・名前・説明・作者・タグ・カテゴリ（`user` か `default`）・`updatedAt`・`graph`（任意の JSON）を持つ。
- `save_workflow`（`service/workflows.rs`）は、与えられた id の保存済みユーザーワークフローを更新する。それ以外の入力（id がない、または組み込みのものなど保存済みユーザーワークフローでない id）は、`wf-` と 16 進 12 桁の新しい id で作成する。保存のたびに `updated_at` を更新する。先にメモリを変え、次に行を書く。
- `delete_workflow` はテーブルから、次にメモリから削除する。未知の id では何もしない。解析できなくなった行は、起動時（`Db::load`）に飛ばしてログに残す。
- `save_workflow` は何かを保存する前に入力を検査する（`backend/crates/novira-core/src/service/workflows.rs` の `check`）。名前は 1〜200 文字（空白のみは不可）、作者は 200 文字まで、説明は 20000 文字まで、タグは 50 個まで・各 100 文字まででどれも制御文字を含まない（説明は改行とタブを含められる）、グラフは 32 MiB まで（`MAX_WORKFLOW_BYTES`。キャンバスとコミックのドキュメントと同じ上限。[01-comic-canvas.md](../../05-comic/01-canvas/01-comic-canvas.md) を参照）の JSON オブジェクト。拒否された保存はフィールド名を示すエラーを返し、何も保存しない。グラフ内部の形はフロントエンドのもので、バックエンドはそのまま保持する。
- データベースを先に書き、次にメモリの一覧を書く。書き込みが失敗しても一覧は元のまま。

### 組み込みワークフロー

- 組み込みのワークフローは 7 つで、`frontend/src/backend/defaultWorkflows.ts` に並ぶ（カテゴリ `default`、グラフなし）。グラフは `buildDefaultGraph`（`frontend/src/features/workflows/defaultGraphs.ts`）が必要なときに作る。バックエンドは何も保存しない。デスクトップアプリでは、同じ id の保存済みユーザーワークフローが組み込みを隠す（`TauriBackend.ts`）。
- ライブラリは、ほかのタブがプリセットを出す生成ボタンの上にあるライブラリカード（`LibraryCard.tsx`。`app/Workspace.tsx` に載せる）から開く。開いているワークフローの名前を示し、未保存の変更を印し、ライブラリのダイアログを開く（プリセット一覧ではない）。左パネルとエディタのツールバーにライブラリのボタンはない。
- ライブラリが削除できるのはユーザーのワークフローだけで、コピーできるのは組み込みだけ（`frontend/src/features/workflows/LibraryModal.tsx`）。コピーは `default` タグのない新しいユーザーワークフローになる。ワークフローファイルはストアの `loadFile`（`register.ts` が設定する。未保存の変更を捨てる前に確認する）で開く。ライブラリのアップロードボタンと、ランチパッドの読み込みカード（ファイル選択を自分で開く）から呼ばれる。
- 開いた組み込みを保存すると、新しいユーザーワークフローができる。`persist`（`actions.ts`）が id を渡すのはカテゴリ `user` のときだけだから。

### エディタの状態

- `useWorkflows`（`frontend/src/state/workflows/workflows.ts`）は、開いているグラフ（React Flow のノードとエッジ）、詳細、リニアビューのフォーム（ノードのフィールドの順序付き一覧）、未保存フラグ、ライブラリと最近の id を持つ。永続化するのはエディタの設定と最近の id だけ（`novira.workflows`）。
- 設定: グリッドへのスナップ、エッジのラベル、エッジのアニメーション、ミニマップ、フィールドの型、`autoTidy`。エッジのアニメーションは既定でオン、自動整理はオフ。
- 元に戻す・やり直しは、ノード・エッジ・フォームのスナップショットを、元に戻す上限の設定（`undoLimit()`、`frontend/src/state/settings.ts`）まで保持する。ノードや接続の追加・削除、ドラッグ、接続、フォームの変更がそれぞれ 1 ステップを保存する。1 つのフィールドを `COALESCE_MS` 以内に繰り返し編集した分は 1 ステップを共有する。グラフを読み込むと両方のスタックを空にする。
- 自動整理（`frontend/src/features/workflows/optimizeWorkflow.ts`）は、ノードや接続を追加・削除した後、待ち時間 `AUTO_OPTIMIZE_DELAY_MS` が過ぎ、ドラッグも接続も進行中でなくなってから実行する。未接続だからといって削除はせず、配線されたノードだけを統合する。最適化ボタン（`optimizeGraph.ts`）はさらに、重複を統合し、結果が出力に届かないノードを削除し、重複したエッジと宙に浮いたエッジを捨て、グラフを整列する。どちらも元に戻す 1 ステップ。

### ノードの追加

- 左パネルのノードタブ（`NodeLibrary.tsx`）は ComfyUI のノードライブラリと同じ構成（`nodeTree.ts`）。2 つの区画（ノード: アプリ独自のものと ComfyUI のものを 1 つのツリーに置き、アプリ独自のものは種類ごとに合う ComfyUI のフォルダへ振り分ける（`BUILTIN_PATH`）、と拡張機能のノード）があり、最初の区画は ComfyUI のカテゴリの各部分ごとのフォルダのツリー、拡張機能のノードは拡張機能（名前）ごとのフォルダの中にそのカテゴリを置く（拡張機能の名前を繰り返すだけのカテゴリは省く）。フォルダとノードは ComfyUI がノードを並べる順（`comfyOrder`）、フォルダと見出しの名前は ComfyUI 自身の言葉をアプリの言語で使う（[03-workflow-graphs.md](03-workflow-graphs.md)）。フォルダは閉じた状態で始まる。検索すると、パス付きの一致のフラットな一覧を出す。ダブルクリックか Enter でノードをキャンバスの中央に追加し、追加するたびに 30 px ずつずらす（`nodeAdder.ts`。エディタが登録する）。ドラッグは `NODE_MIME` を運び、エディタがドロップした位置に置く。
- ピッカーダイアログ（`NodePicker.tsx`）は、`Shift+A` か `Space`、および何もない所へ落とした接続のために残している（このときは合うノードだけを出す）。どちらも `nodeCatalog.ts` の検索を使う。

### 保存とファイル

- 保存と名前を付けて保存（`actions.ts`、`persist`）は、名前・説明・作者・タグ・シリアライズしたグラフを送る。上書き保存するのは、開いているユーザーワークフローだけ（`canSaveInPlace`）。失敗は通知で示す。
- シリアライズ形式（`frontend/src/features/workflows/serialize.ts`）は、`format: "novira-workflow"`、`version: 1`、詳細、ノード、エッジ、フォーム、そして `packs`（使っているカスタムパックのフォルダと GitHub アドレス。ある場合）。
- 読み込み（`deserializeWorkflow`。オブジェクトか JSON テキストから）は、`nodes` と `edges` の配列を必要とする。ノードには、文字列の id、`data`、`position`、エディタが知っているノード型が要る。未知の型が 1 つでもあるとファイルは無効。存在しないノードや未知のハンドルへのエッジ、それ以前のエッジと合わせて輪になるエッジ、存在しないフィールドへのフォーム項目は捨てる。`format` が `novira-workflow` 以外、または `version` が 1 以外は拒否する。どちらも書かれていないファイルは version 1 として読む。

### 足りないパックが要るファイル

- 未インストールのパックのノードだけで失敗するファイル（未知の型がすべて `comfy:` で始まる。`frontend/src/features/workflows/packRequirements.ts`）は、`frontend/src/state/workflows/workflowImport.ts` で待機する。`frontend/src/features/workflows/ImportNeedsPacks.tsx` がそのパックを、ファイルにあるアドレスかアプリがそのフォルダについて知っているアドレスとともに一覧し、インストールを、フォルダがインストール済みなら再起動を提案する。アドレスのないパックは「不明な取得元」と表示する。
- インストールは拡張機能のインストール経路を使う。バックエンドが受け付けるのは `https://github.com/<owner>/<repo>` だけ（`parse_github`、`backend/crates/novira-core/src/comfy/node_packs.rs`）。
- ComfyUI のノード定義が再読み込みされたとき、待機中のファイルが読めるようになっていれば自動で開く（`register.ts` が `useComfyNodes` を購読する）。待機はメモリ上だけで、再起動すると失われる。

## 境界

| 境界 | ガード |
|---|---|
| 保存したワークフローの行（`save_workflow`、`delete_workflow`） | 型付きの引数（`WorkflowInput`）の後に `check`。名前・作者・説明・タグは長さが有限で制御文字なし、グラフは 32 MiB までの JSON オブジェクト。id は保存済みのユーザーワークフローとだけ照合する。`db.rs` はバインドパラメータ。 |
| ワークフローファイルとアシスタントの編集 | `deserializeWorkflow` は、未知のノード型、壊れたノード、知らない `format` や `version` を拒否し、宙に浮いた部分を捨てる。アシスタントの編集も同じパーサを通る（`frontend/src/features/workflows/aiOps.ts`）。 |
| ファイル内のパックのアドレス（`packs[].url`） | インストールのアドレスとしてのみ使い、`parse_github` により `https://github.com/<owner>/<repo>` に限る。 |

## 既知の限界

- 保存したワークフローはサイズに上限（32 MiB）があるが、グラフの内部は検査しない。
- 保存したワークフローはデータベース内で暗号化されず、バックアップにもそのまま入る。
- 保存はそれまでのグラフを置き換える。バージョン履歴はない。

## 未実装

- 保存したワークフローのバージョン履歴。
