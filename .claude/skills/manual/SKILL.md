---
name: manual
description: "Writes, translates, screenshots and builds the novira user manual (Markdown chapters per language under docs/manual to HTML in novira-data/work/manual, pictures taken from the mock app). Use when a user-facing feature changes, when a language is added, to catch up translations, or to produce the HTML (マニュアル, 取扱説明書, 説明書を更新)."
argument-hint: "What to do: build, take pictures, update a chapter for a feature, translate, add a scene or a language"
user-invocable: true
disable-model-invocation: false
---

When the manual must change and how chapters, translations and scenes must be written is in `.claude/rules/manual.md`; read it first. These are the steps.

> Shots (`shots`, `all`) only when the user asks (rule, section 5).

## The pieces

| Piece | Where |
|---|---|
| Source, one folder per app language | `docs/manual/<language>/_meta.json` and `NN-name.md` (Japanese is the master) |
| Screens to photograph | `frontend/scripts/manual/scenes.mjs` |
| One script for both | `node frontend/scripts/manual.mjs [all\|shots\|build] [--locale ja,en] [--scene id,id] [--theme …] [--list] [--allow-missing-images] [--open\|--no-open]` |
| Pictures (`shots`) | → `novira-data/work/manual/<language>/images/<id>.png` |
| HTML (`build`) | → `novira-data/work/manual/<language>/index.html` (contents), `novira-data/work/manual/<language>/<NN-name>.html` (one per chapter) and `novira-data/work/manual/index.html` (languages) |
| From the repository root | `scripts\manual.bat` (shots + build + open), `scripts\manual.bat shots [languages]`, `scripts\manual.bat build [languages]` |

## Steps by request

1. **Produce the HTML** (no content change): `scripts\manual.bat` (or `shots` then `build`). Pictures are not in git, so a fresh clone needs the shots step first. Report the path `novira-data/work/manual/index.html`.
2. **A feature changed** (screen, flow or wording the user sees): find the chapter (`grep -rln "<message key>" docs/manual/ja`, or by topic), edit the **Japanese** chapter first, then the same place in **en** (same structure). Run `npm run manual:check` in `frontend/` now, before anything else. Then `node frontend/scripts/manual-pending.mjs add` marks the chapter as behind for the other eight languages (they show the English chapter until translated). Name controls with `{{ui:<key>}}`. If a screen changed, keep its scene's steps in step and report its pictures as not retaken (`.claude/rules/manual.md` section 5); take them only when the user asks: `node frontend/scripts/manual.mjs shots --locale ja --scene <id>`, then open the picture.
3. **A new screen to show:** add a scene, then use it with `![caption](shot:<id>)` in the Japanese chapter and in every translation.
   - A scene is `{ id, query?, settings?, run(s) }`. Take the picture with `s.shot()`, or `s.shot(element)` to cut out one part.
   - Find controls by test id and by message key: `s.msg('<key>')`, `s.menuItem('<key>')`.
   - An empty gallery: `query: '?scenario=empty'`. A slow display caught mid-way: `settings: { mockStepDelay: 700 }`.
   - Open the picture and check it by eye: the right state is open, the content is there, nothing overflows.
4. **Catch up the translations** (when a piece of work ends, before a release, or when asked): `node frontend/scripts/manual-pending.mjs list` shows what each language lacks. Translate those chapters from the English or Japanese one (a helper may take a language each; the brief: "Translate the chapters listed for <lang> in docs/manual/pending.json from docs/manual/ja into docs/manual/<lang>, same structure, LF, terms of that language's catalog; report in Japanese"), then `node frontend/scripts/manual-pending.mjs clear <lang> [chapter...]` and `npx vitest run tests/manual.test.ts`.
5. **Translate:** follow section 3 of the rule (same structure, `{{ui:…}}`, `shot:` and URLs unchanged, the app's own words, `_meta.json`).
6. **Add a language:** after the app's own locale folder exists (the `i18n` skill), create `docs/manual/<code>/` with `_meta.json` and every chapter under the same file names, then `scripts\manual.bat shots <code>`.

## Check

| Changed | Run |
|---|---|
| Chapters, `_meta.json` | `npx vitest run tests/manual.test.ts` in `frontend/`; to look at it, `scripts\manual.bat build ja` |
| Scenes, the shots runner | `scripts\manual.bat shots ja` (every language: `scripts\manual.bat shots`), then the pictures |
| The renderer, the build | `npx vitest run tests/manual.test.ts` |

Also `npm run check:eol` (and `npm run typecheck` when scripts changed). Commit the Markdown, scenes and scripts only; `novira-data/work/` stays untracked.

Request: $ARGUMENTS
