# Core 層のテスト

バックエンド本体（`backend/crates/novira-core/`）を守るテスト。この層が最も多様な手法を持つ。一覧に戻る: [README.md](README.md)。

## 例にもとづくテスト

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 単体テスト / Unit | 純粋なロジックと単独のモジュール。正常系、失敗、境界 | 各 `.rs` の `#[cfg(test)]`、`backend/crates/novira-core/tests/` の `*_edge_cases.rs`、`mutation_media.rs` | `cargo test -p novira-core --lib` | `cargo-test` |
| 結合テスト / Integration | 本物の SQLite ファイルと一時フォルダー上でサービスを動かす。ネットワークの代わりに偽の ComfyUI と偽のサイトを使う | `backend/crates/novira-core/tests/backend_service/`、`backend/crates/novira-core/tests/comfy_fake_server/`、`backend/crates/novira-core/tests/fake_site/` | `cargo test -p novira-core --test <name>` | `cargo-test` |
| スナップショット / Snapshot | アプリが組み立てる ComfyUI の要求を、モデルの系統ごとに保存済みの JSON と比べる | `backend/crates/novira-core/src/comfy/graph_snapshots.rs`、`backend/crates/novira-core/src/comfy/__snapshots__/` | `cargo test -p novira-core --lib comfy::graph_snapshots`、更新は `UPDATE_SNAPSHOTS=1` | `cargo-test` |
| ノード定義の契約 / Node-definition contract | すべてのスナップショットの要求を、本物の ComfyUI のノード定義と突き合わせる。未知のノード、入力、リンク、選択肢を失敗にする | `backend/crates/novira-core/src/comfy/node_defs_check.rs`、`backend/crates/novira-core/src/comfy/__snapshots__/node-defs.json` | `cargo test -p novira-core --lib comfy::node_defs_check` | `cargo-test` |
| 状態遷移テスト / State transition | キュー、モデル導入、パックの各状態とイベント。表は文書であり、全セルにケースがあることを証明する検査は無い（一部） | `.claude/skills/testing/reference/state-machines.md`、`backend/crates/novira-core/tests/prop_queue.rs` | `cargo test -p novira-core --test prop_queue` | `cargo-test` |

## ランダムなテスト

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 性質ベース / Property-based | 純粋な関数とパーサーにランダムな入力を与える。外へ出るパス、循環のある要求、ラウンドトリップなど。シードは固定 | `backend/crates/novira-core/tests/prop_paths.rs`、`backend/crates/novira-core/tests/prop_graph.rs`、`backend/crates/novira-core/tests/prop_roundtrip.rs` | `cargo test -p novira-core --test prop_paths`、`PROPTEST_CASES`、`PROPTEST_SEED` | `cargo-test` |
| モデルベース / Model-based | キュー操作のランダムな列を素朴なモデルと比べる。ワーカーは止めてあり、実行中のジョブとの競合は対象外。ストアもモデルと比べる | `backend/crates/novira-core/tests/prop_queue.rs`、`backend/crates/novira-core/tests/prop_db.rs` | `cargo test -p novira-core --test prop_queue` | `cargo-test` |
| ファジング（バイト列） / Fuzzing (bytes) | 正しい画像、資格情報、モデルのヘッダー、バックアップの zip を壊して読み直す。パニック、遅い読み取り、ステージング外への展開を失敗にする。カバレッジ誘導は無い | `backend/crates/novira-core/tests/fuzz_inputs.rs` | `cargo test -p novira-core --test fuzz_inputs`、`NOVIRA_FUZZ_ITERATIONS`、`NOVIRA_FUZZ_SEED` | `cargo-test` |
| ファジング（コマンド） / Fuzzing (commands) | この機械の中で完結する全コマンドの引数を JSON の木として壊し、ワーカーを動かしたまま振り分け口へ送る。構造を意識するが一部 | `backend/crates/novira-core/tests/backend_service/api_fuzz.rs` | `cargo test -p novira-core --test backend_service`、同じ環境変数 | `cargo-test` |

## データの保護

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| クラッシュ時の整合性 / Crash consistency | 復元とデータフォルダーの移動を、すべての段階 k の後で止めて再起動し、データが完全であることを確かめる。復元の段階、リネーム、ダウンロードには失敗も注入する。ComfyUI とモデルの導入は対象外（一部） | `backend/crates/novira-core/src/backup/restore/crash_tests.rs`、`backend/crates/novira-core/src/data_location/crash_tests.rs`、`backend/crates/novira-core/tests/restore_stage_failures.rs` | `cargo test -p novira-core --lib crash_tests` | `cargo-test` |
| 旧データからの更新 / Old-data upgrade | 旧版が書いたデータフォルダーを現行のコードで開き、ボード、画像、設定、ジョブがすべて残ることを確かめる | `backend/crates/novira-core/tests/fixtures/data-v0.3.0/`、`backend/crates/novira-core/tests/backend_service/old_data.rs` | `cargo test -p novira-core --test backend_service old_data` | `cargo-test` |
| 秘密情報の検査 / Secret scan | 鍵ファイルの残りを調べる。リポジトリ自前の走査で、専用のスキャナーは使わない | `backend/crates/novira-core/tests/key_cleanup/` | `cargo test -p novira-core --test model_store_odd_paths`（ほかのテストも取り込む） | `cargo-test` |

## テストの質

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| ミューテーション / Mutation | Rust のテストが、演算子や関数本体の変更に気づくか。1 ファイルずつ回す。フロントエンドの道具は無い（一部） | `scripts/checks/mutation.bat`、`backend/.cargo/mutants.toml`、`backend/crates/novira-core/tests/mutation_models.rs` | `scripts\checks\mutation.bat rust -- -f <file>` | `manual` |

## この層にも関わる手法

- 差分（本物の側）: [mock.md](mock.md)
- 契約、ラウンドトリップ: [wire.md](wire.md)
- 実エンジンでの実行: [app.md](app.md)
- 旧データのリリース確認: [build.md](build.md)
