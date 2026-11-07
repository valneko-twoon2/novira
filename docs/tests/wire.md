# Wire 層のテスト

フロントエンドとバックエンドの間の契約を守るテスト。型は `frontend/src/backend/types.ts` と `backend/crates/novira-core/src/types.rs` が正本で、JSON のサンプルで両側を揃える。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 契約 | 両側が、通信で使うすべての型について同じ JSON のサンプルを読み書きする。IPC のコマンド一覧が、権限ファイルと等しいことも確かめる | `contract/`、`frontend/src/backend/contract.test.ts`、`frontend/src/backend/tauri/commands.contract.test.ts`、`backend/crates/novira-core/tests/contract/` | `npx vitest run src/backend/contract.test.ts src/backend/tauri`、`cargo test -p novira-core --test contract` | `vitest`、`cargo-test` |

サンプルを変えたら `CONTRACT_UPDATE=1 npx vitest run src/backend/contract.test.ts` で作り直し、差分を読んでから Rust 側の検査も回す。

## この層にも関わる手法

- コマンド一覧と権限の一致: [shell.md](shell.md)
- ラウンドトリップの性質ベース: [core.md](core.md)
