# Build 層のテスト

ビルドと配布を守るテスト。配布物は zip で、インストーラーは無い。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| リリース確認 | ビルドした `novira.exe` と `novira-server.exe` が起動し、旧データのフィクスチャーを開けること | `scripts/tools/release-smoke.mjs` | `node scripts/tools/release-smoke.mjs` | `build`（release） |
| 依存関係の監査 | Rust のロックファイルと、出荷する npm パッケージの既知の脆弱性 | `.github/workflows/audit.yml`、`backend/.cargo/audit.toml` | `frontend/` で `npm run audit` | `audit` |

監査は専用の workflow で、毎週月曜と、ロックファイルを変えた push で回る。判断済みの警告は `backend/.cargo/audit.toml` に理由つきで置く。

## この層にも関わる手法

- 旧データからの更新: [core.md](core.md)
- 起動する実行ファイルの側: [shell.md](shell.md)、[server.md](server.md)
