# Wire 層のテスト

フロントエンドとバックエンドの間の契約を守るテスト。型は `frontend/src/backend/types.ts` と `backend/crates/novira-core/src/types.rs` が正本で、JSON のサンプルで両側を揃える。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 契約テスト / Contract | 両側が、通信で使うすべての型について同じ JSON のサンプルを読み書きする。IPC のコマンド一覧が、権限ファイルと等しいことも確かめる | `contract/`、`frontend/src/backend/contract.test.ts`、`frontend/src/backend/tauri/commands.contract.test.ts`、`backend/crates/novira-core/tests/contract/` | `npx vitest run src/backend/contract.test.ts src/backend/tauri`、`cargo test -p novira-core --test contract` | `vitest`、`cargo-test` |
| 契約の差分テスト / Contract differential | 見本から種付きで作った JSON（正しい変種と壊した変種、20 種の型で 800 件）を、Rust（serde）と `types.ts` の両方に読ませ、受理か拒否か、書き戻した値が一致することを確かめる。TypeScript 側は実行時の検証器を持たないため、型を読むテスト用の判定器で代用する。設計上の違いは理由つきの許可表に置く | `contract/corpus/`、`backend/crates/novira-core/tests/contract/corpus.rs`、`frontend/src/backend/contractCorpus.test.ts`、`frontend/src/backend/contract/wireValidator.testkit.ts` | `npx vitest run src/backend/contractCorpus.test.ts`、`cargo test -p novira-core --test contract corpus`。作り直しは `node contract/corpus/generate.mjs` | `vitest`、`cargo-test` |

サンプルを変えたら `CONTRACT_UPDATE=1 npx vitest run src/backend/contract.test.ts` で作り直し、差分を読んでから Rust 側の検査も回す。

## この層にも関わる手法

- コマンド一覧と権限の一致: [shell.md](shell.md)
- ラウンドトリップの性質ベース: [core.md](core.md)
