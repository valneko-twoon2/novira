---
name: verify-real-app
description: "Verifies a change on the real engine without touching the user's novira: picks the lightest real run that covers it (models-live with no window, the isolated desktop app driven by Playwright over CDP, or the model sweep), checks the GPU and runs the harness, which cleans up after itself. Use when a change touches IPC commands, the Tauri shell, the WebView, start-up, the engine, the queue worker, models, packs or the GPU, or when the user asks to check it in the real app (実アプリで確認, 実機で試して, 本物のエンジンで)."
argument-hint: "What to verify in the real app"
user-invocable: true
disable-model-invocation: false
---

The recipe and its safety rules are in `docs/verification.md`; read "Real engine, no window", "Real app, isolated" and "Rules that keep it safe" there before the first run. This machine's values (the GPU lock directory and the like) are in the memory note `gui-verification-setup`.

```
Real-app progress:
- [ ] 1. Lighter checks passed (unit, mock browser)
- [ ] 2. Run chosen (table below)
- [ ] 3. GPU free, the user's job not running
- [ ] 4. Harness run, result read
- [ ] 5. Cleanup line checked, report written
```

## 1. Choose the run

Static, unit and mock-browser checks come first (`node tools/affected.mjs`, and for a CSP or capability change `cargo test -p novira --test security`); a real run is slow and holds the GPU. Before a run, tell the user in one line that the PC will be busy for a while (a first build takes minutes).

| What changed | Run |
|---|---|
| The worker, a graph, model files, the GPU path | `node tools/models-live.mjs <part of the model name>` (no window, about a minute) |
| A screen or flow on the real backend that a browser can show (no IPC, shell, CSP or start-up in question) | the browser path: `tools/server-run.mjs` (`startServer`) with Playwright's Chromium, or `node tools/models-sweep.mjs --via server`; no window opens |
| IPC, the Tauri shell, the WebView (picture or video display, CSP), start-up, what a screen sends | `node tools/verify-real-app.mjs <test.mjs>` (the window, driven over CDP) |
| How models are listed, classified or drawn with (`.claude/rules/models.md`) | `node tools/models-sweep.mjs` with `--category` or `--model` to narrow it |

Run each from the main checkout's root with `NOVIRA_GPU_LOCK` set. All three use the user's models through `modelRoots` (no copy). The user checks the desktop app themselves by default; do not open the window when the no-window run or the browser path covers the change (the user dislikes the window: browser first).

A window run that only needs files to display (a picture, a video, a CSP check) takes `--no-engine` when what it shows is already in the isolated data; it then skips ComfyUI and the GPU. A change to models or a graph is checked on more than one model category when others take the same path (`.claude/rules/models.md`): run one per category without being asked.

## 2. Write the test (window runs)

1. Put the script under `novira-data/work/<name>/` (git-ignored, pruned after 3 days unused). Nothing anywhere else.
2. Connect with `chromium.connectOverCDP('http://127.0.0.1:9333')`; import `@playwright/test` from `frontend/node_modules`. Context-menu items do not forward `data-testid`: select them by role and name.
3. Read results from the isolated data's SQLite with `node:sqlite` (table `images`, JSON in `data`), not from the screen alone.

## 3. Run it

```bash
node tools/verify-real-app.mjs novira-data/work/<name>/test.mjs
```

Use exactly this; the harness builds the exe when missing, starts the isolated app (own data, WebView2 profile, port 9333), runs the GPU check, runs the script, then closes the window, stops its ComfyUI copy and deletes the exe. It refuses the user's own exe or data. Flags: `--build` rebuilds, `--keep` keeps the exe, `--no-engine` runs without ComfyUI (the data folder's `settings.json` is put back afterwards).

If the GPU check stops it, wait or ask the user; set `NOVIRA_GPU_CHECK=0` only after they agree.

## 4. Hard rules

- Never stop the user's `novira.exe`, their ComfyUI or python; stop only the verification exe and python whose command line contains `comfy-copy`.
- The verification window is on the user's screen: check its queue is idle before restarting it, and never drive it while their job runs.
- Do not hold the GPU lock by hand while the app runs a job (the app takes the same lock and would wait forever).
- Never delete or install into `novira-data/models` (shared through `modelRoots`), and never make a junction or symlink to it.

## 5. Report

- Which run (no window, window, sweep), on which model and settings, and what was judged by eye. Do not extend one model's or one picture's result to others.
- The harness's closing line: what it stopped and deleted.
- A measured fact that backs a limit goes into the feature's `docs/design/` page, with the date.

Request: $ARGUMENTS
