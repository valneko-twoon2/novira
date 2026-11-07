# Repo 層のテスト

リポジトリの道具、文書、規則、テストそのものを守る検査。多くは pre-commit か CI の `static` が回す。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 型・lint・書式 / Type, lint and format | 型、ESLint、stylelint、警告を禁止した clippy、rustfmt、行末、製品名の表記 | `scripts/tools/typecheck.mjs`、`scripts/tools/check-eol.mjs`、`scripts/tools/check-name.mjs`、`backend/rustfmt.toml` | `frontend/` で `npm run check`、`cargo clippy -p novira-core --tests -- -D warnings` | `static`、`rust-format`、`clippy` |
| 独自の lint 規則 / Custom lint rules | import の層の向き、DOM と CSP まわりの危ない書き方、コミットされた `.only` | `frontend/scripts/eslint-layers.mjs`、`frontend/scripts/eslint-security.mjs`、`frontend/scripts/eslint-test-hygiene.mjs` | `frontend/` で `npm run lint` | `static`、`vitest` |
| 文書とマニュアルの検査 / Docs and manual checks | 地図とデザインページがコードと合っていること、文書が挙げるテスト ID と文言キー、用語表、全言語のカタログ、マニュアルの章の揃い | `scripts/tools/docs-check.mjs`、`scripts/tools/ui-refs.mjs`、`frontend/scripts/check-glossary.mjs`、`frontend/tests/i18n.test.ts`、`frontend/tests/manual.test.ts` | `node scripts/tools/docs-check.mjs`、`npx vitest run tests/i18n.test.ts tests/manual.test.ts` | `static`、`vitest` |
| テストの衛生 / Test hygiene | 雑多なフォルダーが無いこと、実行時以外の `#[ignore]` が無いこと、孤立したスナップショットが無いこと、フォーカスされたテストが無いこと | `frontend/tests/test-hygiene.test.ts`、`frontend/tests/structure.test.ts`、`frontend/scripts/eslint-test-hygiene.mjs` | `npx vitest run tests/test-hygiene.test.ts tests/structure.test.ts` | `vitest`、`static` |
| 影響範囲の分析 / Test-impact analysis | 変更したファイルから必要な検査を選び、すべて回す | `scripts/tools/affected.mjs` | `node scripts/tools/affected.mjs`（`--list`、`--e2e`） | `manual` |
| カバレッジ / Coverage | フロントエンドの文、分岐、関数、行を下限と比べる。`novira-core` の行、関数、領域を測る。1 枚の報告にまとめる。Rust の分岐と条件は測らない（一部） | `frontend/vitest.config.ts`、`scripts/checks/coverage.bat`、`scripts/tools/coverage-report.mjs` | `scripts\checks\coverage.bat` | `manual` |

## この層にも関わる手法

- ミューテーション（テストの質）: [core.md](core.md)
- 単体、スナップショットの孤立検査: [logic.md](logic.md)
