# アーキテクチャ

最初に読む。つながり、正本、変更の入口を示す。探索は `Glob`・`grep`。分野ごとは [01-frontend.md](01-frontend.md)・[02-backend.md](02-backend.md)、起動と検査は [03-tooling.md](03-tooling.md)・[04-guards.md](04-guards.md)。機能は [設計](../design/README.md)。

## 部品

画像・動画・音楽・音声を作るアプリ。画面は InvokeAI v6 の再現、生成はアプリ自身がインストール・起動する ComfyUI。

```text
WebView (frontend/dist)
   │  invoke('<command>', args)            novira://event (backend events; WebSocket /events in a browser)
   ▼                                        ▲
src-tauri  ── commands.rs (validate) ──▶ novira-core::service ──▶ comfy / voice (owned child processes)
   │                                        │
   └─ novira-image:// (names only)          └─ novira-data/ (SQLite, outputs, models, comfyui, secrets, logs)
```

- `frontend/`: UI（React 19、TypeScript、Vite）。知るのは `BackendClient` だけ。アプリでは Rust（Tauri IPC）、ブラウザではメモリ上のモック（`frontend/src/backend/mock/`）が WebView より右の代わり。
- `backend/crates/novira-core/`: バックエンド全体のライブラリ。Tauri を含まず、ウィンドウなしでテストする。`backend/src-tauri/` は薄いシェルで、WebView の入力を検証してサービスを呼ぶ。
- 接点は契約だけ。画像やパスは越えず、WebView には名前だけ渡す。ネイティブダイアログはシェルが開く。

## 正本

| 何 | どこ |
|---|---|
| ワイヤ型 | `frontend/src/backend/types.ts` と `backend/crates/novira-core/src/types.rs`。`contract/` の JSON フィクスチャで等しく保つ（両側が検査） |
| フロントの呼び出し | `frontend/src/backend/client.ts`。Rust 側は `backend/crates/novira-core/src/api.rs`（バックエンド専用の全コマンド。共用）と `backend/src-tauri/src/command_list.rs`（テストが `capabilities/default.json` と、`api.rs` + シェル専用コマンドとの一致を保つ） |
| 設定 | `backend/crates/novira-core/src/settings.rs`（`Settings` 型） |
| 画面の文言 | `frontend/src/i18n/locales/<language>/<area>.json`（`ja` が先。`/i18n`）、`frontend/src/i18n/catalog.ts` に登録 |
| 依存、スクリプト | `frontend/package.json`、`backend/Cargo.toml` |
| 用語 | [../glossary.md](../glossary.md) |

## 変更の入口

| 変えるもの | 入口 |
|---|---|
| 画面からバックエンドへの新規呼び出し | `frontend/src/backend/client.ts` と実装（`tauri/`・`http/`・`mock/`）、`backend/crates/novira-core/src/api.rs`、`backend/src-tauri/src/commands.rs` と `command_list.rs`、`backend/crates/novira-server/src/lib.rs`（`SERVED`）、`backend/src-tauri/capabilities/default.json`、`backend/crates/novira-core/src/service/` の該当モジュール、次に両側の型、`contract/` のサンプル |
| キュー、ジョブの状態、ワーカー | `backend/crates/novira-core/src/service/queue.rs`・`worker.rs`。画面側 `frontend/src/state/queue.ts`・`wiring.ts`（イベントをストアへ） |
| ComfyUI のグラフ | `backend/crates/novira-core/src/comfy/`（`graph.rs` 画像、`video.rs`、`music.rs`）。画面の要求は `frontend/src/state/invoke.ts` のレジストリ経由 |
| ComfyUI のインストール・プロセス、拡張機能 | `backend/crates/novira-core/src/comfy/`（`install.rs`・`process.rs`・`node_packs.rs`）、`service/node_pack_store.rs`、`frontend/src/state/comfy/` |
| モデル（インストール、分類、Civitai、Hugging Face） | `backend/crates/novira-core/src/models/`、`service/model_store.rs`、`frontend/src/features/models/`・`browse/` |
| 設定項目 | `settings.rs`。エンジン設定は `service/engine_settings.rs`、`frontend/src/features/settings/` も |
| AI アシスタント | `backend/crates/novira-core/src/agent/`（指示、道具）、`frontend/src/state/agentGuide.ts`・`agentTools.ts`（規則 `.claude/rules/assistant.md`）、コミックの `scene` 操作は `frontend/src/state/comic/scene.ts` |
| 新しい画面 | `frontend/src/features/<name>/` に `register.ts` を置き、`frontend/src/state/` のレジストリへつなぐ。載せるのは `frontend/src/app/Workspace.tsx` か `SideNav.tsx` |
| 共通部品、色 | `frontend/src/ui/`。生の色は `frontend/src/theme/tokens.css` だけ |
| モックの返答 | `frontend/src/backend/mock/`（`MockBackend.ts`、`mockEngine.ts`） |
| コミック | `frontend/src/state/comic/`、`frontend/src/features/comic/`。保存は `backend/crates/novira-core/src/service/comics.rs` |
| 共有用の書き出し、透かし | `backend/crates/novira-core/src/service/share.rs`、`media/export.rs`、`provenance/` |
| 機能の現行の動き、境界、限界 | `docs/design/README.md`。ページは `node scripts/tools/docs-check.mjs --find <path>` |

## フォルダ

| フォルダ | 中身 |
|---|---|
| `frontend/` | UI、テスト（`tests/`、`e2e/`）、スクリプト |
| `backend/` | Cargo ワークスペース（`crates/novira-core/`、`crates/novira-server/`、`src-tauri/`） |
| `contract/` | ワイヤ型の JSON フィクスチャ。両側が検査 |
| `docs/` | `design/` 機能仕様・安全、`manual/<language>/` マニュアル、`development.md`、`verification.md`、`tests/` テスト技法 |
| `scripts/` | 手で動かす Windows ランチャー（`.bat`）。`tools/` は AI・Git フック・CI が呼ぶもの |
| `.githooks/`、`.github/`、`.claude/`、`.config/` | Git フック（sh + Node）、テスト・リリースの ワークフロー、Claude Code のフック・規則・スキル、カバレッジ用の固定 .NET ツール（[03-tooling.md](03-tooling.md)） |
| `novira-data/` | ユーザーデータと生成物（非コミット）。`novira-data/work/` はハーネス生成物（検証データ、ビルド、一時） |
| `artifacts/` | リリースビルドの出力（非コミット） |
| `logs/` | テスト結果とレポート。git の対象外 |

## 更新

検索で分からないこと（つながり、正本、入口）だけを置く。部品の追加・削除・移動、境界の変更、入口の行の誤りは同じコミットで直す。`scripts/tools/docs-check.mjs` は、名前のない部品、存在しない backtick のパス、上限超過のページで失敗する（[規則](../../.claude/rules/docs.md)）。
