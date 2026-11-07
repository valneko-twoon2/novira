# Server 層のテスト

ブラウザー用サーバー（`backend/crates/novira-server/`）を守るテスト。待ち受け、ペアリング、認証、アップロードが中心。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 結合テスト / Integration | ループバック上で、サーバーの HTTP ルート、ペアリング、ソケット、アップロードを動かす | `backend/crates/novira-server/tests/auth.rs`、`backend/crates/novira-server/tests/commands.rs` | `cargo test -p novira-server` | `cargo-test` |
| ファジング（リクエスト） / Fuzzing (requests) | サーバー自身のルートへ、壊した生の HTTP リクエストを送る。必ず応答があり 5xx にならないこと、リクエストの検査が守られること、トークンが漏れないことを確かめる | `backend/crates/novira-server/tests/http_fuzz.rs` | `cargo test -p novira-server --test http_fuzz`、`NOVIRA_FUZZ_ITERATIONS`、`NOVIRA_FUZZ_SEED` | `cargo-test` |

ペアリングの状態機械のモデルテストは未実装（`/testing` スキルの `reference/randomized.md` に手順がある）。

## この層にも関わる手法

- 差分（サーバーを通して本物のバックエンドと比べる）: [mock.md](mock.md)
- リリース確認（`novira-server.exe` の起動）: [build.md](build.md)
- セキュリティのテスト（認証）: [shell.md](shell.md)
