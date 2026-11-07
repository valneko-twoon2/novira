# テスト手法の一覧

このリポジトリで今動いているテスト手法を、層ごとのページに分けて並べた一覧。どの層をどの手法が守っているか、新しいケースをどこに置くかを調べるときに使う。まだ無い手法は末尾に名前だけ挙げる（作り方は `/testing` スキルの `reference/gaps.md`）。変更ごとの検査の回し方は [../verification.md](../verification.md)、ケースの選び方は `/testing` スキル（`.claude/skills/testing/SKILL.md`）。

## 層

| 層 | 対象 | ページ |
|---|---|---|
| UI | フロントエンドの画面と部品 | [ui.md](ui.md) |
| Logic | フロントエンドの状態と純粋なロジック（ストア、関数） | [logic.md](logic.md) |
| Mock | ブラウザで動くメモリ上のモックバックエンド | [mock.md](mock.md) |
| Wire | フロントエンドとバックエンドの間の契約 | [wire.md](wire.md) |
| Core | バックエンド本体（`novira-core`） | [core.md](core.md) |
| Server | ブラウザ用サーバー（`novira-server`） | [server.md](server.md) |
| Shell | Tauri のシェル（`src-tauri`） | [shell.md](shell.md) |
| Build | ビルドと配布 | [build.md](build.md) |
| App | 本物のエンジンを含むアプリ全体 | [app.md](app.md) |
| Repo | リポジトリの道具、文書、規則 | [repo.md](repo.md) |

各ページの表は、その層を主な対象とする手法の行を持つ。複数の層にまたがる手法は、主な層のページに行があり、ほかの層のページでは末尾の「この層にも関わる手法」から探せる。

## 表の見方

| 列 | 内容 |
|---|---|
| 手法 | テストの種類 |
| ここで確かめること | このリポジトリで実際に何を検査するか。「一部」とあるものは、足りない部分を文中に書いてある |
| 場所 | テストやスクリプトのパス |
| 実行 | 手元で回すコマンドと、深く回すための環境変数 |
| CI | 回す GitHub Actions のジョブ。`manual` は workflow のどれも回さない |

CI のジョブは、`.github/workflows/test.yml`（`static`、`rust-format`、`vitest`、`clippy`、`cargo-test`、`e2e-chromium`、`e2e-phone`、`diff-backends`）、`.github/workflows/audit.yml`（`audit`）、`.github/workflows/release.yml`（`build`）にある。

## 手法と層

| 手法 | 層 |
|---|---|
| 単体・部品テスト / Unit, component | [Logic](logic.md)、[UI](ui.md)、[Core](core.md)、[Mock](mock.md)、[Shell](shell.md) |
| 結合テスト / Integration | [Core](core.md)、[Server](server.md) |
| 契約・ノード定義の契約 / Contract, node-definition contract | [Wire](wire.md)、[Core](core.md) |
| スナップショット / Snapshot | [Logic](logic.md)、[Core](core.md) |
| 性質ベース・モデルベース・状態遷移 / Property-based, model-based, state transition | [Logic](logic.md)、[Core](core.md) |
| ファジング（バイト列・コマンド・リクエスト） / Fuzzing (bytes, commands, requests) | [Core](core.md)、[Server](server.md) |
| 差分テスト / Differential | [Mock](mock.md)、[Wire](wire.md) |
| クラッシュ時の整合性・旧データ / Crash consistency, old data | [Core](core.md)、[Build](build.md) |
| E2E・モンキー・ブラウザー横断・見た目・レイアウト・アクセシビリティ / End-to-end, monkey, cross-browser, visual, layout, accessibility | [UI](ui.md) |
| リリース確認・依存関係の監査 / Release smoke, dependency audit | [Build](build.md) |
| セキュリティ・秘密情報 / Security, secret scan | [Shell](shell.md)、[Core](core.md) |
| 実エンジン・実アプリ・モデル一括確認・性能の測定 / Real-engine, real-app, models sweep, performance | [App](app.md) |
| 型・lint・文書・テストの衛生・影響分析・カバレッジ / Type, lint, docs, test hygiene, impact analysis, coverage | [Repo](repo.md) |
| メタモルフィック / Metamorphic | [Core](core.md) |
| ミューテーション / Mutation | [Core](core.md) |

## 未実装

競合の探索（loom、shuttle）と不安定テストの夜間反復、カバレッジ誘導のファジング、段階ごとの停止と再起動（復元とデータ移動以外）、長時間運転とリークの検査、サーバーの負荷試験、外部の静的解析、依存のライセンスと出所の検査、秘密スキャナー、擬似ローカライズ、実エンジンの出力比較、インストーラーの試験、Firefox、Miri、形式手法。
