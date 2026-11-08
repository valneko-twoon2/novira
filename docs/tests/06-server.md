# Server 層のテスト

ブラウザー用サーバー（`backend/crates/novira-server/`）を守るテスト。待ち受け、ペアリング、認証、アップロードが中心。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 結合テスト / Integration | ループバック上で、サーバーの HTTP ルート、ペアリング、ソケット、アップロードを動かす | `backend/crates/novira-server/tests/auth.rs`、`backend/crates/novira-server/tests/commands.rs` | `cargo test -p novira-server` | `cargo-test` |
| ファジング（リクエスト） / Fuzzing (requests) | サーバー自身のルートへ、壊した生の HTTP リクエストを送る。必ず応答があり 5xx にならないこと、リクエストの検査が守られること、トークンが漏れないことを確かめる | `backend/crates/novira-server/tests/http_fuzz.rs` | `cargo test -p novira-server --test http_fuzz`、`NOVIRA_FUZZ_ITERATIONS`、`NOVIRA_FUZZ_SEED` | `cargo-test` |
| モデルベース / Model-based | ペアリングの状態機械（コード、要求、承認、セッション、失効、期限）に、仮想時計とランダムな操作列を与え、毎手、素朴なモデルと比べる。承認なしにセッションが出ないこと、失効や期限切れのセッションが通らないこと、コードが 1 回限りで切れること、要求ごとにセッションが 1 つであることなどを確かめる | `backend/crates/novira-server/src/pair/model_tests/` | `cargo test -p novira-server --lib pair::model_tests`、`PROPTEST_CASES`、`PROPTEST_SEED` | `cargo-test` |


## この層にも関わる手法

- 差分（サーバーを通して本物のバックエンドと比べる）: [03-mock.md](03-mock.md)
- リリース確認（`novira-server.exe` の起動）: [08-build.md](08-build.md)
- セキュリティのテスト（認証）: [07-shell.md](07-shell.md)
