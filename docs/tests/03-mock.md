# Mock 層のテスト

ブラウザーで動くメモリ上のモックバックエンド（`frontend/src/backend/mock/`）を守るテスト。モックが本物のバックエンドと同じ答えを返すことが中心。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 単体テスト / Unit | モックの各呼び出しと状態の動き。状態が変わるときは、バックエンドの状態遷移表と合わせる | `frontend/src/backend/mock/MockBackend.test.ts` | `npx vitest run src/backend/mock/MockBackend.test.ts` | `vitest` |
| 差分テスト / Differential (mock against real) | 同じ呼び出しと、シード付きのランダムな呼び出し列を、モックと、サーバー経由の本物のバックエンドに送る。食い違いはすべて失敗で、最初に食い違った手を示す | `frontend/difftest/backends.difftest.ts`、`frontend/difftest/sequences.difftest.ts`、`scripts/tools/diff-backends.mjs` | `node scripts/tools/diff-backends.mjs`、`NOVIRA_DIFF_SEED` | `diff-backends` |

差分の食い違いは、モックを直して解消する。サーバーが「シェル専用」と答える呼び出しは、理由を書いて対象から外す。

## この層にも関わる手法

- E2E、モンキー: [01-ui.md](01-ui.md)（モックの上で動く）
- 差分の相手側: [06-server.md](06-server.md)、[05-core.md](05-core.md)
