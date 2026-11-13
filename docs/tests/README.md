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
| Formal | 仕様の総当たり検査（形式検証） | [11-formal.md](11-formal.md) |

各ページの表は、その層を主な対象とする手法の行を持つ。複数の層にまたがる手法は、主な層のページに行があり、ほかの層のページでは末尾の「この層にも関わる手法」から探せる。

## 表の見方

| 列 | 内容 |
|---|---|
| 手法 | テストの種類 |
| ここで確かめること | このリポジトリで実際に何を検査するか。「一部」とあるものは、足りない部分を文中に書いてある |
| 場所 | テストやスクリプトのパス |
| 実行 | 手元で回すコマンドと、深く回すための環境変数 |
| CI | 回す GitHub Actions のジョブ。`manual` は workflow のどれも回さない |

CI のジョブは、`.github/workflows/test.yml`（`static`、`rust-format`、`vitest`、`clippy`、`cargo-test`、`e2e-chromium`、`e2e-phone`、`e2e-visual`、`diff-backends`）、`.github/workflows/audit.yml`（`audit`）、`.github/workflows/supply-chain.yml`（`cargo-deny`、`gitleaks`）、`.github/workflows/release.yml`（`build`）にある。

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
| 形式検証・モデル検査 / Formal verification, model checking | [Formal](11-formal.md) |

## 件数

<!-- test-counts:start (node scripts/tools/test-tags.mjs --write) -->

宣言されたテストは全部で **7678 件**（フロント（vitest） 5662、ブラウザ（Playwright） 240、バックエンド（cargo） 1776）。ソースを静的に数えた件数で、`it.each` は行数、ループや実行時の表で作るテストは 1 件と数える（そのぶん、vitest や cargo が報告する実行件数より少ない）。

### 手法別

| 手法 | フロント（vitest） | ブラウザ（Playwright） | バックエンド（cargo） | 計 | 内容 |
|---|---:|---:|---:|---:|---|
| 単体（`unit`） | 3743 | - | 828 | 4571 | 関数・モジュールを単独で（フロントの状態やロジック、Rust のモジュール内、道具のスクリプト） |
| 部品（`component`） | 1626 | - | - | 1626 | React の部品を描画して操作する |
| 結合（`integration`） | - | - | 727 | 727 | 複数のモジュールや本物のサービス・ファイル・SQLite・疑似サーバーをつないで動かす |
| 契約（`contract`） | 18 | - | 5 | 23 | フロントとバックエンドの型、JSON フィクスチャ、ノード定義の一致 |
| スナップショット（`snapshot`） | 18 | - | - | 18 | 大きな出力（グラフなど）を保存した形と比べる |
| 性質ベース（`property`） | 196 | - | 121 | 317 | fast-check・proptest の乱数入力で、常に成り立つ性質を確かめる |
| モデルベース（`model-based`） | - | - | 5 | 5 | 操作列を単純なモデルと並べて実行し、状態を比べる |
| ファジング（`fuzz`） | - | - | 9 | 9 | バイト列・コマンド・リクエストを崩して、落ちないことを確かめる |
| 差分（`differential`） | 8 | - | - | 8 | 二つの実装（モックと本物）に同じ操作をして、答えを比べる |
| メタモルフィック（`metamorphic`） | - | - | 19 | 19 | 入力を変えたとき、出力が満たすべき関係を確かめる |
| モンキー（`monkey`） | - | 1 | - | 1 | 画面を乱暴に操作して、壊れないことを確かめる |
| E2E（`e2e`） | - | 176 | - | 176 | ブラウザで画面を通しで操作する（Playwright） |
| 見た目（`visual`） | - | 33 | - | 33 | スクリーンショットを基準画像と比べる |
| レイアウト（`layout`） | - | 13 | - | 13 | はみ出し・重なり・幅の規則を、画面を開いて測る |
| アクセシビリティ（`accessibility`） | - | 11 | - | 11 | キーボード、コントラスト、動きの抑制、拡大表示 |
| 性能（`performance`） | - | 6 | - | 6 | 時間・サイズの予算 |
| クラッシュ時（`crash`） | - | - | 14 | 14 | 書き込みの途中で止まったときの整合性、復元 |
| 旧データ（`old-data`） | 23 | - | 1 | 24 | 古い版が作ったデータを新しい版で開く |
| セキュリティ（`security`） | - | - | 2 | 2 | 設定・ソースの走査、秘密情報、入力の検証 |
| 静的検査（`static`） | 30 | - | 19 | 49 | ソース・文書・設定・規則の形をツリー全体で検査する |
| 実エンジン（`live`） | - | - | 26 | 26 | 本物の外部（ComfyUI、Civitai、Hugging Face、モデル）に当てる。普段は回さない |

### 設計技法別

技法は 1 つのテストに複数付けてよいので、合計は全体の件数と一致しない。タグのないテストは「未分類」に数える。

| 技法 | フロント（vitest） | ブラウザ（Playwright） | バックエンド（cargo） | 計 | 内容 |
|---|---:|---:|---:|---:|---|
| 同値分割（`equivalence`） | 1394 | 27 | 482 | 1903 | 入力の区分ごとに代表を取る（有効・無効の各区分） |
| 境界値（`boundary`） | 1055 | 16 | 276 | 1347 | 上限・下限、その前後、0・空 |
| 分岐・条件網羅（`condition`） | 1761 | 33 | 414 | 2208 | if・match の両側、複数条件の各項を真偽に振る |
| デシジョンテーブル・ペアワイズ（`decision-table`） | 260 | 1 | 61 | 322 | 複数の入力が一緒に結果を決める規則を、組み合わせで確かめる |
| 状態遷移（`state-transition`） | 568 | 37 | 247 | 852 | 状態と事象の組。許される遷移と拒まれる遷移 |
| エラー推測（`error-guessing`） | 847 | 17 | 704 | 1568 | 壊れたデータ、敵対的な入力、失敗する外部（ディスク・通信） |
| シナリオ（`scenario`） | 599 | 127 | 150 | 876 | 利用者の流れや典型的な使い方を通しで確かめる |
| 回帰（`regression`） | 107 | 5 | 8 | 120 | 見つかった不具合を再現し、再発を止める |
| 未分類 | - | - | - | - | 技法のタグがまだ付いていない |

### 手法 × 技法

| 手法 | 同値分割 | 境界値 | 分岐・条件網羅 | デシジョンテーブル・ペアワイズ | 状態遷移 | エラー推測 | シナリオ | 回帰 | 未分類 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 単体 | 1361 | 871 | 1373 | 234 | 392 | 811 | 230 | 85 | - |
| 部品 | 273 | 228 | 520 | 57 | 245 | 153 | 396 | 11 | - |
| 結合 | 115 | 92 | 177 | 14 | 147 | 359 | 90 | 6 | - |
| 契約 | 7 | - | 12 | 3 | - | 4 | 2 | 1 | - |
| スナップショット | 7 | - | 2 | 4 | - | - | 6 | - | - |
| 性質ベース | 76 | 116 | 56 | 8 | 7 | 170 | - | 5 | - |
| モデルベース | - | 1 | - | - | 4 | 2 | - | - | - |
| ファジング | 1 | 1 | 2 | - | - | 9 | - | - | - |
| 差分 | 3 | 1 | - | - | 3 | 6 | - | - | - |
| メタモルフィック | 6 | 5 | 7 | 1 | 1 | 12 | - | - | - |
| モンキー | - | - | - | - | - | 1 | - | - | - |
| E2E | 17 | 7 | 27 | 1 | 36 | 11 | 90 | 3 | - |
| 見た目 | - | - | - | - | - | - | 33 | - | - |
| レイアウト | 5 | - | 6 | - | - | 5 | 2 | 2 | - |
| アクセシビリティ | 5 | 3 | - | - | 1 | - | 2 | - | - |
| 性能 | - | 6 | - | - | - | - | - | - | - |
| クラッシュ時 | - | 2 | - | - | 12 | 12 | - | - | - |
| 旧データ | 5 | 8 | 8 | - | - | 3 | 1 | - | - |
| セキュリティ | 2 | - | - | - | - | 2 | - | - | - |
| 静的検査 | 18 | 4 | 15 | - | - | 7 | 2 | 7 | - |
| 実エンジン | 2 | 2 | 3 | - | 4 | 1 | 22 | - | - |

タグの付け方と語彙は [../../scripts/tools/test-tags.mjs](../../scripts/tools/test-tags.mjs) の冒頭に書いてある。

<!-- test-counts:end -->

## 未実装

競合の探索（loom、shuttle）と不安定テストの夜間反復、カバレッジ誘導のファジング、段階ごとの停止と再起動（復元とデータ移動以外。ComfyUI とモデルの導入）、長時間運転とリークの検査、サーバーの負荷試験、外部の静的解析（CodeQL、semgrep）、擬似ローカライズ、実エンジンの出力比較、インストーラーの試験、Firefox、Miri、コードの形式検証（Kani。[11-formal.md](11-formal.md)）。
