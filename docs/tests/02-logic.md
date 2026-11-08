# Logic 層のテスト

フロントエンドの状態（ストア）と純粋なロジックを守るテスト。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 単体テスト / Unit | 純粋なロジックと単独のモジュール。正常系、失敗、境界を確かめる | `frontend/src/` の `*.test.ts` | `npx vitest run <path>` | `vitest` |
| 性質ベース / Property-based (frontend) | ストアと純粋なロジックにランダムな入力を与える。処理は同じプロセス内で、`fetch` は呼ぶと失敗する差し替えにする。既知の不具合は、印を付けた失敗するテストとして残す | `frontend/src/propertyTest.testkit.ts` と各 `*.property.test.ts` | `npx vitest run <file>.property.test.ts`、`NOVIRA_PBT_RUNS`、`NOVIRA_PBT_SEED` | `vitest` |
| 資源の件数の上限 / Resource count budget | 時間ではなく数で測る性能の検査。IPC の呼び出し回数（待機中のキューの取消しは 1 回）、検索の再実行（Browse を開き直しても 5 分以内は 0 回）、画面へ送る進捗の絵（ステップごとに 1 回）、生き残る blob URL（キャンバスの編集を繰り返しても undo の上限を超えて増えない。バックエンドが読んだ一度きりの URL は取り消す）を、呼び出しや URL の数で数える | `frontend/src/features/queue/QueueControls.test.tsx`、`frontend/src/features/browse/useCivitaiSearch.test.tsx`、`frontend/src/state/queue.test.ts`、`frontend/src/state/canvasUrls.test.ts`、`frontend/src/backend/oneShotUrl.test.ts`、`frontend/src/backend/tauri/TauriBackend.test.ts` | `npx vitest run <file>` | `vitest` |
| スナップショット / Snapshot (frontend) | 画面が組み立てる ComfyUI の要求を保存済みの JSON と比べる。書き込むテストを持たない孤立したファイルは失敗にする | `frontend/tests/test-hygiene.test.ts` と各 `*.snapshot.test.ts` | `npx vitest run <file>.snapshot.test.ts`、更新は `-u` | `vitest` |

## この層にも関わる手法

- 状態遷移（ストアの見え方を含む）: [05-core.md](05-core.md)
- カバレッジ、型と lint、テストの衛生: [10-repo.md](10-repo.md)
