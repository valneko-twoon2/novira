# ガード: 何が何を止めるか

一覧に戻る: [README.md](README.md)

リポジトリの機械による検査すべてと、それが止めるもの。散文で書いた規則でここに行がないものは、ガードにする候補（`/hardening-harness` スキル）。変更に対して検査を回す方法: [../verification.md](../verification.md)。ランチャーとツール自体: [03-tooling.md](03-tooling.md)。上: [README.md](README.md)。

| ガード | 止めるもの |
|---|---|
| `scripts/tools/typecheck.mjs`（`tsc`、増分。pre-commit） | src・テスト・e2e・設定の型エラー、ja にない文言キー |
| `frontend/tests/i18n.test.ts` | ja にあって en にないキー、ja にないキーやエリアを持つ他の言語、プレースホルダーの不一致、ts / tsx に直接書かれた日本語 |
| `frontend/scripts/check-glossary.mjs`（`src/i18n/glossary.json`、そのテスト、pre-commit） | 用語一覧が禁じる語（ja/en のカタログとマニュアルの中） |
| `frontend/tests/manual.test.ts` | アプリの言語にマニュアルフォルダがない、章のファイルや構造（見出し、表、リスト、画像）が `ja` と違う、存在しない `{{ui:key}}` / リンク / 画像 ID、場面と画像の不整合 |
| `frontend/scripts/check-i18n-sync.mjs`（pre-commit） | ja か en の一方だけで文言を変えるコミット、ja か en が変えた文言に対して他の言語の文を残すコミット |
| `frontend/scripts/check-manual-sync.mjs`（pre-commit） | ja か en の一方だけで変えたマニュアルの章、ほかの言語で翻訳もされず `docs/manual/pending.json` にも載らないもの |
| ESLint | `src/backend/` の外のネットワークアクセス、LF 以外の改行、react-hooks の規則、ユニオンの `switch` がメンバーを `default` に任せること、type main に絞ったモデル一覧 |
| ESLint `frontend/scripts/eslint-layers.mjs` | レイヤーの向きに反する import、機能が別の機能を import すること（`features/media` と `features/invoke` を除く）。列挙された例外は減る方向にだけ変えられる |
| ESLint `frontend/scripts/eslint-test-hygiene.mjs` | コミットされた `.only` テスト |
| `frontend/tests/structure.test.ts` | `utils/`、`misc/`、`helpers/` フォルダ、もう要らないレイヤーの例外 |
| `frontend/tests/generate-parity.test.ts` | 生成画面と違う部品でメインモデルを選ばせる画面（`Select` に名前で並べたもの。`ModelPicker` を使う） |
| `frontend/tests/test-hygiene.test.ts` | `tests/*_live.rs` の外の `#[ignore]`、どのテストも書かないプロンプトのスナップショット（フロントと `comfy/__snapshots__/graph/`） |
| `frontend/tests/test-tags.test.ts` | 設計技法のタグのないテスト、語彙にないタグ、`docs/tests/README.md` の件数表が今のソースと食い違うこと（`scripts/tools/test-tags.mjs --write` で直す） |
| `comfy::node_defs_check`（`cargo test -p novira-core --lib` の中） | 本物の ComfyUI が拒むグラフ（未知のノードや入力、足りない入力、誤ったリンク、受け付けない選択肢や数値。`scripts/tools/comfy-node-defs.mjs` による `node-defs.json` に対して）。ファイル不足や実行時の失敗は止めない |
| ESLint `frontend/scripts/eslint-security.mjs`、`cargo test -p novira --test security` | DOM への HTML の直接挿入、`eval`、`window.open`、緩めた CSP や capability、シェル経由の起動、値を整形して作る SQL、コミットされた秘密（詳細と限界は `.claude/rules/security.md`） |
| stylelint | `tokens.css` の外の hex・`rgb()`・`hsl()` の色、`--radius-*` でない角丸、9 を超える z-index が `--z-*` でないこと |
| `npm run check:eol` | 改行が違うテキストファイル（追跡中も未追跡も。無視されるものは除く）: LF が期待値、`.bat` と `.cmd` は CRLF |
| `scripts/tools/docs-check.mjs`（`tests/docs-check.test.ts` が `npm run check` と CI に入る。pre-commit では `--git`） | 地図のどのページも AGENTS.md も名前を挙げないフォルダ・クレート・ランチャー・ツール・フック本体・規則・スキル、地図や設計ページの backtick のパスやリンクが存在しないこと、`docs/`（マニュアルを除く）・`.claude/`・AGENTS.md の backtick 内のコード名をどのコードも持たないこと、上限を超えたページ、対応する `covers` 一覧のない設計ページや索引にない設計ページ、設計ページを伴わないセキュリティ境界の変更、設計ページが対象とするコードを変えてページを変えないコミットへの**警告** |
| `scripts/tools/ui-refs.mjs`（pre-commit。`tests/ui-refs.test.ts`。`verify-real-app.mjs` がビルドの前にテストスクリプトに対して実行） | e2e の spec、`frontend/scripts/`、`scripts/tools/`、ドキュメント、`.claude/` が挙げるテスト ID や文言キー（形式はツールの冒頭に書いてある）のうち、`frontend/src` のどのソースにも ja カタログにもないもの。1 つのビルドに隠れた ID や変数に入った ID は対象外 |
| `.githooks/commit-msg.mjs`（`.githooks/commit-msg`。`tests/commit-msg.test.ts`） | `.claude/rules/commit-messages.md` に反するメッセージ: 72 文字を超える、または句点で終わる要約、100 文字以内の 1 行の `- ` 箇条書きが 8 を超える本文、名前付きの作業ブランチ（マージ・revert・fixup・squash のコミットは除く）。種類が `fix` で、アプリかハーネスのコード（`frontend/src/**/*.ts(x)`、`backend/**/src/**/*.rs`、`scripts/**/*.mjs`、`.githooks`、`.claude/hooks`）を変えるのに、テストをステージしていないコミット（テストのパス、または Rust のファイルに足された `#[test]` があれば通る。テストが書けないときは `Test: <理由>` の行を足す）。テストが修正の前に落ちたかは見えない |
| `scripts/tools/commit-gates.mjs`（pre-commit が実行。`tests/commit-gates.test.ts`） | 長くない CI ジョブ。ステージしたファイルが結果を変えうるときだけ各ジョブを回す: `rust-format`、`clippy`、フロントの lint、`diff-backends`、`e2e-phone`。長いもの（vitest、cargo test、Chromium のフロー、ビジュアル回帰）は `affected.mjs` と CI（`e2e-visual` など）に任せる |
| `scripts/tools/checks.mjs`（`tests/checks-tool.test.ts`）と `.claude/hooks/use-checks.mjs`（PreToolUse） | 検査を生のコマンドで回すミス（違う場所、cargo の PATH 抜け、動いているアプリの `target` へのビルド、e2e ロックなしの Playwright）。フックは生の `cargo fmt/clippy/test`、`eslint`、`vitest`、`playwright test`、`tsc` を止め、同じ引数のまま呼ぶ `checks.mjs` のコマンドを返す。`cargo build` や `affected.mjs` などは止めない |
| `.githooks/pre-commit`（拒むものは `tests/pre-commit.test.ts`） | ステージした改行、製品名の綴り（`check-name.mjs`、`frontend/tests/product-name.test.ts` が追跡中の全ファイルにも）、型エラー、言語の不整合、禁止語、古いドキュメントと UI 参照、変更履歴の形、レイアウトスキャンの合格がないレイアウトソース、ステージされた `novira-data/`（つまり `novira-data/work/` も）・`logs/`・`out/`・`data/`・`outputs/`・`config.json`・`.env*` |
| `frontend/scripts/oss-licenses.mjs`（pre-commit。入力の 1 つがステージされたとき再生成して通知文をステージする） | ライセンス文のない依存やダウンロードの追加（ないパッケージは名前を挙げる）、`oss-downloads.json` のどの項目にもないダウンロードファイル（透かしのファイルは読む）。「情報」の一覧と通知文をロックファイルに合わせる |
| `e2e/a11y.spec.ts`・`a11yContrast.spec.ts`・`a11yKeyboard.spec.ts`・`a11yMotion.spec.ts`・`a11yZoom.spec.ts`（それぞれの `*Known.ts`。`npm run e2e` の中） | モックの主要な各タブで、axe-core（WCAG A/AA。コントラストは除く）の違反、単色の背景上の文字のコントラスト、キーボード（フォーカスの輪、Tab の順、メニューとダイアログのフォーカスの保持）、動きを減らす設定での繰り返しの動き、UI ズームと最小ウィンドウでの横スクロールとはみ出し。既知の一覧を超えると失敗し、一覧は減る方向にだけ変えられる |
| `e2e/perf-budget.spec.ts` | よく使う操作の時間が予算の数倍に増えること（モック、開発ビルドなので緩い） |
| `scripts/tools/visual-baselines.mjs`（`affected.mjs` がそのトリガー規則を使う。`tests/visual-baselines.test.ts`） | どの変更ファイルが主要な画面を変えうるか。`npm run e2e:visual` は pre-commit が毎回回す（`commit-gates.mjs`）。対象は `e2e/visual/` の画面だけ |
| `scripts/tools/layout-scan.mjs`（`e2e/layout.spec.ts`、規則は `e2e/layoutRules.ts`、`e2e/textFit.ts`。`affected.mjs` が実行） | モックの全画面で ja と en、ダークとライトについて: 枠やウィンドウからはみ出たコントロール、切れた文字や「…」に省略された文字、1px より近い・重なる見えているコントロールやカード、はみ出る・折り返すラベル、ウィンドウの外へ出るツールチップやメニュー。pre-commit はステージ内容に対する記録済みの合格を要る |
| Claude Code のフック（`.claude/hooks/`） | セッションやサブエージェントに地図の入口ページがないこと（`architecture-map.mjs`）、編集やシェルによる書き換えの後の誤った改行（`eol.mjs edit\|shell`）、ターン終了時の未コミットの作業（`commit-before-stop.mjs` が 1 回知らせる）、HEAD の掃引記録がないままコミットされたモデルのコード、`work/` の外の `novira-data/`（またはアプリが移した先）への書き込み（`data-guard.mjs`: 前は拒み、後は報告）、`scripts/tools/worktree.mjs remove` で消されていない終えた worktree。改行と未コミット作業のフックはすべての worktree を見る |
| `cargo test -p novira --test robustness` | ロックへの `unwrap` / `expect`（`novira_core::sync` を使う）、`commands::guard` を通らない同期コマンド（メインスレッドの panic でアプリが死ぬ） |
| `frontend/tests/rust-debuginfo.test.ts` | Rust のデバッグ情報の復活: プロファイルの `debug`、`backend/.cargo/config.toml` から消えた `/DEBUG:NONE`、`RUSTFLAGS` を設定するスクリプト |
| `cargo test -p novira --test window_config` | どのウィンドウも `dragDropEnabled` を false にしないこと（Tauri 既定の有効のままだと、Windows では HTML5 のドラッグ&ドロップがページに届かない）、ウィンドウが非表示で開き、テーマを当ててから表示すること |
| `checks/coverage.bat`（`npm run coverage`） | `frontend/vitest.config.ts` の下限を下回るフロントのカバレッジ、行の下限を下回る Rust（`backend`）のカバレッジ。`e2e` は Playwright の実行を加える。手で回す。`npm run check` には入らない。最後に統合レポートを出す（`coverage-report.mjs`） |
| `checks/mutation.bat rust`（`cargo mutants`、設定は `backend/.cargo/mutants.toml`） | コードの実際の変更に気づかないテスト（生き残ったミュータント）。`check.bat` と CI には入らない（クレート全体で 1 日かかる。1 ファイルなら `-- -f <path>`）。同等のミュータントは設定で理由つきで除外する |
| `npx vitest run <file>.property.test.ts`（`npm run check` の一部。fast-check、共通の準備は `frontend/src/propertyTest.testkit.ts`） | 純粋なフロントのロジックとストアに届く、悪意のある・ランダムな入力。プロセス内だけ（`fetch` は投げる）。実行回数と種は固定（`NOVIRA_PBT_RUNS`、`NOVIRA_PBT_SEED`）。既知の不具合は `known bug:` コメント付きの `it.fails` テスト |
| novira-core の `prop_*` テスト（`--test prop_paths` ほか） | 純粋関数やパーサーに届く、悪意のある・ランダムな入力: フォルダを抜け出す、デバイスや別ホストを指すパス、リンクが宙に浮く・循環する・null 入力を持つプロンプト、panic やオーバーフローするパーサー、往復で変わる契約型。種は固定 | ジェネレーター\| ジェネレーターが届く範囲だけ: 本物のエンジン、ネットワーク、GPU はなく、生成した形の外の不具合は見つからない |
| main と develop のブランチ保護（GitHub の設定。[02-ci.md](../design/01-app/04-release/02-ci.md)） | 強制 push と削除（管理者も）。main はさらに、PR を通さない push と、必須の検査（`Test` と `Supply chain` のジョブ）が通らない PR のマージ（develop は PR を求めない。`land.mjs` が入れる） |
| `scripts/tools/land.mjs`（`/ship`。`tests/land.test.ts`） | 作業ブランチの develop への取り込みで、未コミットの変更、`origin/develop` を含まないブランチ、コミットの規則に合わないタイトル、レビューのないもの（変更履歴・テストだけのものを除く）、ok でない・書式どおりでない・別の変更を見たレビュー、強制の push |
| `scripts/tools/pr.mjs`（`/release-notes`。`tests/pr-tool.test.ts`） | 作業ブランチから develop への PR のマージ（`land.mjs` へ回す）、プログラムへの指摘に動かして確かめた「検証」の行がないレビュー、今の head に対するエージェントのレビュー（サインインしたアカウントのもの）が ok でない PR、まだ始まっていない必須の検査と終わっていない CodeQL の解析、下書きのときに飛ばした検査を通ったとみなすこと、未解決の・読めない code scanning の警告、develop・main 以外への PR、release/ の写し以外から main への PR（develop そのものや作業ブランチ）、フォークからの PR、develop の検査を待つこと（待たない）、main を develop に戻す PR の、マージ後の develop の中身が変わるもの、コミットの規則に合わないタイトル、テンプレートの節が欠けた説明、決まった書式でないレビューのマージや投稿 |
| `.github/workflows/supply-chain.yml`（`backend/deny.toml`、`.gitleaks.toml`。main 向けの PR、main への push、手動、毎週） | 許可リストにないライセンス、ワイルドカードのバージョン、未知のレジストリや git 依存（cargo-deny）、ファイルと git 履歴の中の秘密（gitleaks、既定の規則）。アドバイザリ（`audit.yml`）とコードの欠陥は対象外 |
| `backend/rustfmt.toml`（`newline_style = "Unix"`） | Rust の改行 |
