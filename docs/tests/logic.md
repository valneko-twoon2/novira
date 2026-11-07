# Logic 層のテスト

フロントエンドの状態（ストア）と純粋なロジックを守るテスト。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 単体 | 純粋なロジックと単独のモジュール。正常系、失敗、境界を確かめる | `frontend/src/` の `*.test.ts` | `npx vitest run <path>` | `vitest` |
| 性質ベース（フロントエンド） | ストアと純粋なロジックにランダムな入力を与える。処理は同じプロセス内で、`fetch` は呼ぶと失敗する差し替えにする。既知の不具合は、印を付けた失敗するテストとして残す | `frontend/src/propertyTest.testkit.ts` と各 `*.property.test.ts` | `npx vitest run <file>.property.test.ts`、`NOVIRA_PBT_RUNS`、`NOVIRA_PBT_SEED` | `vitest` |
| スナップショット（フロントエンド） | 画面が組み立てる ComfyUI の要求を保存済みの JSON と比べる。書き込むテストを持たない孤立したファイルは失敗にする | `frontend/tests/test-hygiene.test.ts` と各 `*.snapshot.test.ts` | `npx vitest run <file>.snapshot.test.ts`、更新は `-u` | `vitest` |

## この層にも関わる手法

- 状態遷移（ストアの見え方を含む）: [core.md](core.md)
- カバレッジ、型と lint、テストの衛生: [repo.md](repo.md)
