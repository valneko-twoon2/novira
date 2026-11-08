# Build 層のテスト

ビルドと配布を守るテスト。配布物は zip で、インストーラーは無い。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| リリース確認 / Release smoke | ビルドした `novira.exe` と `novira-server.exe` が起動し、旧データのフィクスチャーを開けること | `scripts/tools/release-smoke.mjs` | `node scripts/tools/release-smoke.mjs` | `build`（release） |
| 依存関係の監査 / Dependency audit | Rust のロックファイルと、出荷する npm パッケージの既知の脆弱性 | `.github/workflows/audit.yml`、`backend/.cargo/audit.toml` | `frontend/` で `npm run audit` | `audit` |
| 供給網の検査 / Supply chain | `cargo deny` で依存のライセンス、禁止、ワイルドカード、未知のレジストリと git 元を調べ、`gitleaks` で作業ツリーと全履歴の秘密を探す。push、手動実行、毎週月曜に回る。GitHub のランナーでは `main` から作った試験用ブランチで一度通った | `.github/workflows/supply-chain.yml`、`backend/deny.toml`、`.gitleaks.toml` | `cargo deny --manifest-path backend/Cargo.toml check bans licenses sources`、リポジトリ直下で `gitleaks detect --source . --no-banner` | `cargo-deny`、`gitleaks` |

監査は専用の workflow で、毎週月曜と、ロックファイルを変えた push で回る。判断済みの警告は `backend/.cargo/audit.toml` に理由つきで置く。

## この層にも関わる手法

- 旧データからの更新: [05-core.md](05-core.md)
- 起動する実行ファイルの側: [07-shell.md](07-shell.md)、[06-server.md](06-server.md)
