# テスト手法の一覧

このリポジトリで今動いているテスト手法を、層ごとのページに分けて並べた一覧。どの層をどの手法が守っているか、新しいケースをどこに置くかを調べるときに使う。まだ無い手法は末尾に名前だけ挙げる（作り方は `/testing` スキルの `reference/gaps.md`）。変更ごとの検査の回し方は [../verification.md](../verification.md)、ケースの選び方は `/testing` スキル（`.claude/skills/testing/SKILL.md`）。

## 層

| 層 | 対象 | ページ |
|---|---|---|
| UI | フロントエンドの画面と部品 | [01-ui.md](01-ui.md) |
| Logic | フロントエンドの状態と純粋なロジック（ストア、関数） | [02-logic.md](02-logic.md) |
| Mock | ブラウザで動くメモリ上のモックバックエンド | [03-mock.md](03-mock.md) |
| Wire | フロントエンドとバックエンドの間の契約 | [04-wire.md](04-wire.md) |
| Core | バックエンド本体（`novira-core`） | [05-core.md](05-core.md) |
| Server | ブラウザ用サーバー（`novira-server`） | [06-server.md](06-server.md) |
| Shell | Tauri のシェル（`src-tauri`） | [07-shell.md](07-shell.md) |
| Build | ビルドと配布 | [08-build.md](08-build.md) |
| App | 本物のエンジンを含むアプリ全体 | [09-app.md](09-app.md) |
| Repo | リポジトリの道具、文書、規則 | [10-repo.md](10-repo.md) |

各ページの表は、その層を主な対象とする手法の行を持つ。複数の層にまたがる手法は、主な層のページに行があり、ほかの層のページでは末尾の「この層にも関わる手法」から探せる。

## 表の見方

| 列 | 内容 |
|---|---|
| 手法 | テストの種類 |
| ここで確かめること | このリポジトリで実際に何を検査するか。「一部」とあるものは、足りない部分を文中に書いてある |
| 場所 | テストやスクリプトのパス |
| 実行 | 手元で回すコマンドと、深く回すための環境変数 |
| CI | 回す GitHub Actions のジョブ。`manual` は workflow のどれも回さない |

CI のジョブは、`.github/workflows/test.yml`（`static`、`rust-format`、`vitest`、`clippy`、`cargo-test`、`e2e-chromium`、`e2e-phone`、`diff-backends`）、`.github/workflows/audit.yml`（`audit`）、`.github/workflows/supply-chain.yml`（`cargo-deny`、`gitleaks`）、`.github/workflows/release.yml`（`build`）にある。

## 手法と層

| 手法 | 層 |
|---|---|
| 単体・部品テスト / Unit, component | [Logic](02-logic.md)、[UI](01-ui.md)、[Core](05-core.md)、[Mock](03-mock.md)、[Shell](07-shell.md) |
| 結合テスト / Integration | [Core](05-core.md)、[Server](06-server.md) |
| 契約・ノード定義の契約 / Contract, node-definition contract | [Wire](04-wire.md)、[Core](05-core.md) |
| スナップショット / Snapshot | [Logic](02-logic.md)、[Core](05-core.md) |
| 性質ベース・モデルベース・状態遷移 / Property-based, model-based, state transition | [Logic](02-logic.md)、[Core](05-core.md) |
| ファジング（バイト列・コマンド・リクエスト） / Fuzzing (bytes, commands, requests) | [Core](05-core.md)、[Server](06-server.md) |
| 差分テスト / Differential | [Mock](03-mock.md)、[Wire](04-wire.md) |
| クラッシュ時の整合性・旧データ / Crash consistency, old data | [Core](05-core.md)、[Build](08-build.md) |
| E2E・モンキー・ブラウザー横断・見た目・レイアウト・アクセシビリティ / End-to-end, monkey, cross-browser, visual, layout, accessibility | [UI](01-ui.md) |
| リリース確認・依存関係の監査 / Release smoke, dependency audit | [Build](08-build.md) |
| セキュリティ・秘密情報 / Security, secret scan | [Shell](07-shell.md)、[Core](05-core.md) |
| 実エンジン・実アプリ・モデル一括確認・性能の測定 / Real-engine, real-app, models sweep, performance | [App](09-app.md) |
| 型・lint・文書・テストの衛生・影響分析・カバレッジ / Type, lint, docs, test hygiene, impact analysis, coverage | [Repo](10-repo.md) |
| メタモルフィック / Metamorphic | [Core](05-core.md) |
| ミューテーション / Mutation | [Core](05-core.md) |

## 未実装

競合の探索（loom、shuttle）と不安定テストの夜間反復、カバレッジ誘導のファジング、段階ごとの停止と再起動（復元とデータ移動以外。ComfyUI とモデルの導入）、長時間運転とリークの検査、サーバーの負荷試験、外部の静的解析（CodeQL、semgrep）、擬似ローカライズ、実エンジンの出力比較、インストーラーの試験、Firefox、Miri、形式手法。
