# App 層のテスト

本物のエンジン（ComfyUI）と、隔離して動かしたアプリ全体を使うテスト。GPU を使うものは GPU ロックを取り、ユーザーが使っているときは動かさない。手順は [../verification.md](../verification.md) と `/verify-real-app` スキル。すべて手動で、CI は回さない。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 実エンジンでの実行 / Real-engine run | ウィンドウ無しで、キューからファイルまで、ジョブ 1 件を本物の ComfyUI で動かす | `backend/crates/novira-core/tests/models_live.rs`、`scripts/tools/models-live.mjs` | `node scripts/tools/models-live.mjs <model>`（GPU ロック） | `manual` |
| 実アプリでの実行 / Real-app run | 隔離したデスクトップアプリを CDP で操作する。IPC、WebView、起動、画面自身の要求を確かめる | `scripts/tools/verify-real-app.mjs` | `node scripts/tools/verify-real-app.mjs <test.mjs>` | `manual` |
| モデルの一括確認 / Models sweep | 導入済みのすべてのモデルについて、一覧に出ること、カバーが読めること、画面が選べること、種類と基盤ごとに 1 件の実ジョブが通ることを確かめる | `scripts/tools/models-sweep.mjs` | `node scripts/tools/models-sweep.mjs` | `manual` |
| 性能の測定 / Performance measurement | 起動、コマンド、IPC の時間を測り、保存した基準と比べる。失敗する予算は無い（一部） | `scripts/tools/perf.mjs`、`scripts/tools/perf-startup.mjs`、`backend/crates/novira-core/examples/backend_timing.rs` | `node scripts/tools/perf.mjs all --compare <name>` | `manual` |

## この層にも関わる手法

- E2E（モックの上）: [ui.md](ui.md)
- 結合（偽のエンジン）: [core.md](core.md)
