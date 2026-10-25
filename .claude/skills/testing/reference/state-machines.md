# State transition tests (queue, installs, packs)

Read the transitions in the code before you write a test. The table says where they are; it is not a copy of them.

| Machine | Statuses | Where the transitions are |
|---|---|---|
| Generation queue, one item | `QueueItemStatus` in `backend/crates/novira-core/src/types.rs`: pending, in_progress, completed, failed, canceled | `service/queue.rs` (enqueue, cancel, clear, prune, retry), `service/worker.rs` (start, finish, cancel, fail), `service/mod.rs` (start-up) |
| Model install | `ModelInstallStatus` in `types.rs`: waiting, downloading, running, completed, error, cancelled | `service/model_store.rs` (the spawned install, `cancel_install`) |
| Node pack | `PackStatus` in `packs.rs`: missing, downloading, installing, ready, error | `service/node_pack_store.rs` (`cancel_node_pack` returns the pack to missing) |
| Extension pack | `PackStatus` | `service/pack_store.rs` (`cancel_pack`) |

Queue rules the tests rely on (the code is the source; check it again when the change touches them):

- Cancel acts only on pending or in-progress items; on any other status it does nothing.
- Retry acts only on failed or canceled items and makes a new pending item with the same seed. A smaller size is allowed only for a picture made from a prompt (`check_retry_size`).
- The worker takes the first pending item, and only when the processor is not paused and no item is running.
- A job that stops because it was cancelled becomes canceled, never failed. Shutdown gives it an "interrupted" message.
- At start-up an item left in progress becomes failed, and pending items wait for an explicit resume.
- Clear removes every item and cancels the running one. Prune removes only items that are neither pending nor in progress.

The frontend mock keeps the same statuses (`frontend/src/backend/mock/MockBackend.ts`); when a status changes, change the mock in the same work.

1. Make the transition table first: rows are the current status, columns the events (start, finish, fail, cancel, retry, clear, prune, restart). Each cell is "moves to X", "no-op" or "refused (error)". This table is the test plan.
2. One test for each legal move that changes data (a status, a message, a timestamp). One test for each refused or no-op cell a user can reach (cancel on a completed item, retry on a pending one). Say in the report which no-op cells you left untested, and why.
3. Check that a move survives a restart when the item is saved (`backend/crates/novira-core/tests/backend_service/queue.rs`: `state_survives_a_restart_and_unfinished_jobs_are_not_resumed_silently`, `pruned_and_cleared_items_stay_gone_after_a_restart`).
4. Check that a failed save leaves no half-state (enqueue removes the items it could not save).
5. A move emits an event (`QueueItemStatusChanged`, `QueueCleared`). Assert the event for the item that changed.
6. Backend: integration tests in `backend/crates/novira-core/tests/backend_service/` with the fake ComfyUI in `tests/comfy_fake_server`; reuse the helpers those files define. For a pause in a retry, `NOVIRA_TEST_RETRY_PAUSE_MS` applies (debug builds only; see `security.md`).
7. No sleeps to wait for a job: wait for the event or the status. A cancel during a run is the case most likely to race; test it with the fake engine and assert the final status.
8. Frontend: store tests in `frontend/src/state/` for how a status is shown, and `frontend/src/backend/mock/MockBackend.test.ts` for the mock's moves, which must match the table.
9. A change to the worker, to cancelling a running job, or to a pack or model install is not verified by these tests. Confirm it on the real engine (`/verify-real-app`).

Run: `cargo test -p novira-core --test backend_service queue` (or `worker`), and `npx vitest run src/backend/mock/MockBackend.test.ts` plus the store tests in `frontend/`.
