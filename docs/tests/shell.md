# Shell 層のテスト

Tauri のシェル（`backend/src-tauri/`）を守るテスト。WebView が送るものを検証してサービスを呼ぶ薄い層なので、境界の安全が中心。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| セキュリティ / Security | CSP と権限が緩められていないこと、シェル起動が無いこと、値から SQL を組み立てていないこと、ソースの走査、コマンドがパニックしても安全なこと、ウィンドウ設定 | `backend/src-tauri/tests/security/`、`backend/src-tauri/tests/robustness.rs`、`backend/src-tauri/tests/window_config.rs` | `cargo test -p novira` | `cargo-test` |
| 秘密情報の検査 / Secret scan | 鍵や資格情報が書き出されたままになっていないこと。リポジトリ自前の走査で、専用のスキャナーは使わない | `backend/src-tauri/tests/security/secrets.rs` | `cargo test -p novira --test security` | `cargo-test` |
| コマンド一覧と権限の一致 / Command list against capabilities | IPC のコマンド一覧が、権限ファイルおよび `api.rs` と等しいこと | `backend/src-tauri/src/command_list.rs` のテスト | `cargo test -p novira` | `cargo-test` |

## この層にも関わる手法

- 契約（IPC のサンプル）: [wire.md](wire.md)
- リリース確認（`novira.exe` の起動）: [build.md](build.md)
- 実アプリでの確認: [app.md](app.md)
