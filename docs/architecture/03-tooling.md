# ツール類: ランチャー、検査、ガード

一覧に戻る: [README.md](README.md)

プロジェクトの起動と検査のしかた、規則とスキルの場所。各ガードが何を止めるかは [04-guards.md](04-guards.md)。変更に対して検査を回す方法: [../verification.md](../verification.md)。上: [README.md](README.md)。

## ランチャーとツール

`scripts/` は手で動かすものを置く: Windows のランチャー（`.bat`）で、日常のものは最上位、長い検査は `checks/`、リリースは `release/`。`scripts/tools/` は AI セッション、Git フック、CI が呼ぶものを置く。ほかの場所のツールは `scripts/tools/` の表の後ろにまとめた。

| `scripts/` の中 | 中身 |
|---|---|
| `start.bat` | 変わったものをビルドして `backend\target\debug\novira.exe` を開く（`fast` はビルドを飛ばす。`clean` は先に `frontend/dist` とアプリのクレートを掃除し、`clean full` は `backend/target` 全体を掃除する） |
| `dev.bat` | `cargo tauri dev`: 本物のバックエンドで Vite のホットリロード |
| `server.bat` | 変わったものをビルドし（`ensure-frontend.mjs`）、エンジン付きで `novira-data` に対して `novira-server` を起動してブラウザを開く（`fast` はビルドを飛ばす） |
| `check.bat` | 速い検査すべて: `npm run check` に加え、`cargo fmt --check`、`-D warnings` 付きの clippy、`cargo test` |
| `checks/full-check.bat` | 手で回す全テスト: `check.bat`、`novira-server`、それに対するモック（`diff-backends.mjs`）、Playwright、レイアウトスキャン（`full-check.mjs`） |
| `checks/coverage.bat`、`checks/mutation.bat` | カバレッジ、ミューテーションテスト |
| `checks/manual.bat` | マニュアル: モックアプリのスクリーンショットを撮り、`novira-data/work/manual/<language>/` へ |
| `release/package.bat` | リリースビルドを `artifacts/` へ出し、zip と `.sha256` を作る（`package-release.mjs`）。`build` は zip を作らず、`release-smoke.mjs` 用。リリースのワークフローも同じ手順を踏む |
| `release/set-version.bat` | `Cargo.toml`、`package.json`、ロックファイルの唯一のバージョンを設定する（`set-version.mjs`） |

| `scripts/tools/` の中 | 中身 |
|---|---|
| `checks.mjs` | 検査を回す唯一の入口（`--list` で一覧。fmt、clippy、cargo-test、lint、typecheck、vitest、e2e、phone、diff-backends、layout、docs）。場所、PATH、Rust のビルド先（`novira-data/work/check-target`）、e2e ロックを整え、引数はそのまま渡す。生の `cargo test` や `npx vitest` は `.claude/hooks/use-checks.mjs` が止めて、このツールの呼び方を返す |
| `affected.mjs` | 変更したファイルに必要な検査だけ |
| `coverage-report.mjs` | 計測した全部分を 1 つにまとめたグラフィカルなカバレッジレポート（ReportGenerator。`.config/dotnet-tools.json` で固定） |
| `typecheck.mjs`、`commit-gates.mjs`、`docs-check.mjs`、`ui-refs.mjs`、`visual-baselines.mjs`、`check-eol.mjs`、`fix-eol.mjs`、`eol.mjs`、`check-name.mjs`、`changelog.mjs`、`ci-summary.mjs` | リポジトリ全体の検査: 型、コミットが通すべき CI ジョブ（Rust の整形、clippy、lint、モックと本物のバックエンドの比較、スマホ）、地図と設計ページ、存在しないテスト ID と文言キー、画面を変えうる変更の判定（基準画像）、改行、名前の綴り、変更履歴の形、CI のテスト数 |
| `layout-scan.mjs`、`e2e-lock.mjs` | レイアウトスキャン（テキストの収まりを含む）とその合格記録。重い Playwright の実行を一度に 1 つにするロック |
| `worktree.mjs` | サブエージェントの worktree を作って消す |
| `repeat-test.mjs` | 1 つのコマンドを N 回（既定 20、`--parallel` で負荷をかける）実行し、不安定なテストや競合するテストを捕まえる。最初の失敗の出力は `logs/repeat-test/` に残る |
| `prune-stale.mjs` | `novira-data/work/` と `logs/` の古い項目を消す（下記） |
| `prune-target.mjs` | 毎日、Rust の検査の前に: 50 GB を超えたら `cargo clean --profile dev`。そこからプログラムが動いていれば行わない |
| `verify-real-app.mjs`、`models-live.mjs`、`gpu-check.mjs`、`harness-paths.mjs`、`harness-process.mjs`、`server-run.mjs` | 隔離した本物のアプリ（またはブラウザサーバー）、またはエンジンのジョブ 1 つ（`docs/verification.md`）。worktree は本体のチェックアウトの `novira-data/` と `logs/` を使う。GPU が使用中なら止まる。共有部分: パス、ハーネスのビルド（全画面入り）、プロセス、cargo |
| `models-sweep.mjs`、`models-sweep-app.mjs`、`models-sweep-lib.mjs` | インストール済みの全モデルを、隔離したアプリか（`--via server` では）Chromium で確かめる（`.claude/rules/models.md`） |
| `perf.mjs`（`perf-startup.mjs`、`backend/crates/novira-core/examples/backend_timing.rs` を実行） | バックエンド、フロントの起動、本物のアプリの IPC の速さを、保存した基準と比べる |
| `fetch-trustmark.mjs`、`comfy-node-defs.mjs` | 透かしの固定ファイル（ハッシュ検査つき）、保存した ComfyUI のノード定義 |
| `package-release.mjs`、`set-version.mjs`、`release-smoke.mjs`（`start-medium.ps1`） | `package.bat` と `set-version.bat` の本体。`release-smoke.mjs` は `package.bat build` の出力が起動して主画面に着くかを確かめる（`start-medium.ps1` は CI の管理者権限の実行から通常権限でアプリを起動する） |
| `diff-backends.mjs`、`full-check.mjs`、`ensure-frontend.mjs` | モックと `novira-server` の比較、`full-check.bat` の本体、`frontend/dist` が古いときだけのビルド |

| `scripts/tools/` の外 | 中身 |
|---|---|
| `.githooks/` | Git フック。`pre-commit` と `commit-msg`（sh のラッパー。`npm install` で有効になる）が `pre-commit.mjs` / `commit-msg.mjs` を実行する |
| `.github/workflows/` | `test.yml` はブランチの push で検査を回し（[02-ci.md](../design/01-app/04-release/02-ci.md)）、`release.yml` はタグでリリースをビルドする（[01-release-workflow.md](../design/01-app/04-release/01-release-workflow.md)）。`supply-chain.yml` と `audit.yml` は依存の検査（[04-guards.md](04-guards.md)） |
| `frontend/scripts/` | フロントに結びつくスクリプト: ローカルの lint 規則（`eslint-*.mjs`）、テキストとマニュアルの検査、`shot.mjs`、`e2e-server.mjs`（レイアウトスキャンのキャッシュ済みビルド、`novira-data/work/e2e-build/`） |
| `.claude/hooks/`、`.claude/settings.json` | Claude Code のフック（[04-guards.md](04-guards.md)） |

### 古い出力

ハーネスが作るものは、本体のチェックアウトの `logs/`（人が読む結果）か `novira-data/work/`（それ以外）の直下に置く（[../verification.md](../verification.md)）。古いものは消す: `prune-stale.mjs` は、項目ごとの期限より長く使われていないものを、ハーネスが項目に書く `.last-used` マーカーから数えて削除する。`logs/` では知っている項目にしか触れない。`--dry-run` は一覧を出すだけ。テスト: `tests/prune-stale.test.ts`。

## 規則とスキル

規則（`.claude/rules/`）は何が成り立つべきかを述べる。Claude Code は `paths` の下のファイルに触れると読み込む。スキル（`.claude/skills/<name>/`）はやり方を述べ、規則を指し返す。`AGENTS.md` は、自分では読み込まないエージェント向けに両方を挙げる。

| 規則 | 内容 |
|---|---|
| `docs.md` | 地図と設計ページに何を書くか、いつ更新するか |
| `frontend.md`、`i18n.md`、`manual.md`、`assistant.md`、`comfyui.md`、`security.md` | フロントのレイヤーと見た目、全言語の画面文言、マニュアル、機能と歩調を合わせた AI アシスタント、拡張機能の設定、各境界で何を検査するか |
| `models.md`、`tests.md`、`commit-messages.md` | モデルの変更は実アプリで全部確かめる、テストは動作と一緒に変え影響するものだけ回す、コミットメッセージ |

| スキル | 用途 |
|---|---|
| `i18n/`、`manual/` | 画面文言、マニュアル（ほかの言語の追いつきも） |
| `gatekeeper/`、`verify-real-app/` | サブエージェントのブランチを main に取り込む、本物のアプリを隔離して動かす |
| `testing/`、`hardening-harness/`、`release-notes/` | テストケース、カバレッジ、ミュータント、ガード・スキル・ハーネス見直し、リリースと変更履歴 |

## 何が何を守るか

すべてのガードと、それが止めるものの表は別のページにある: [04-guards.md](04-guards.md)。
