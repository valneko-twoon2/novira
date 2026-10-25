---
name: i18n
description: "Adds, changes or removes screen messages in every language at once, adds a message area, catches up missing translations, or adds or removes a language in novira (locales, catalog, settings list, e2e, manual folder). Use whenever user-visible text is added or changed, or the user asks about wording or translation (文言, 表示テキスト, 翻訳, 言語を追加)."
argument-hint: "What to add or change (messages, an area, or a language such as fr)"
user-invocable: true
disable-model-invocation: false
---

What must hold (no hard-coded text, every language together, keys, what is not translated) is in `.claude/rules/i18n.md`; read it first. These are the steps.

## Add or change messages

1. Look for an existing key and an existing translation of the same term first (`grep -rn "<word>" frontend/src/i18n/locales/<lang>`), so terms stay the same.
2. Write a spec JSON in the scratchpad with **ja and en** and the same `{placeholders}`:
   `{ "<area>": { "<area>.<name>": { "ja": "…", "en": "…" } } }`
   Counts use two keys, `<key>.one` and `<key>.other`. The other languages may be added too (`"ko": "…"`, …) but need not be: they show the English text until they are translated.
3. Run `node frontend/scripts/i18n-add.mjs <spec.json>` from the repository root. `--replace` changes existing texts: ja and en get the new text, and a language not given one loses its old text (it falls back to English); `--new-area` creates a new area file in every language. It refuses a spec that leaves ja or en out.
4. Use the keys with `t('<key>')` / `tCount('<key>', n)`.
5. Changed or removed a key: `grep -rn "{{ui:<key>}}" docs/manual` and fix the chapters; if the screen itself changed, update the chapter and its scene (the `manual` skill).

## Translate what is missing (catching up)

Only when the user asks (languages other than ja and en wait for their word):

1. `node frontend/scripts/i18n-todo.mjs --out <todo.json>` (or `npm run i18n:todo` for the counts). The file holds, per language, the missing keys with their ja and en texts.
2. Translate each language's messages in one go (a helper may take a language each, with the same rules as above: terms as in that language's catalog, same `{placeholders}`). Write `{ "<area>": { "<key>": { "<language>": "…" } } }`.
3. `node frontend/scripts/i18n-add.mjs <spec.json> --fill` adds only what the languages still lack and never touches ja and en. Then `npx vitest run tests/i18n.test.ts tests/i18n-glossary.test.ts`.

## Add an area

1. `i18n-add.mjs --new-area` with the first keys of the area (it writes `locales/<lang>/<area>.json` for every language).
2. Register it in `frontend/src/i18n/catalog.ts` for ja and en: an `import` and a `...ja<Area>` / `...en<Area>` spread in `ja` and `en`. The other languages are loaded when chosen, by `src/i18n/bundles/<lang>.ts`, which take every area file of their folder by themselves. Forgetting it makes `t()` fail to type-check; `tests/i18n.test.ts` finds an area file ja or en does not hold.
3. Update the code that uses the keys and the tests that look them up (`msg('<key>')`) in the same change.

## Add a language (for example `fr`)

All in one commit:

1. `frontend/src/i18n/locales/fr/`: every area file of `ja` (the keys may follow later, as for every language other than ja and en).
2. `frontend/src/i18n/bundles/fr.ts` (a copy of another language's bundle with the folder changed: the language's chunk, loaded when it is chosen) and `'fr'` in `LOCALES` in `catalog.ts`. `tests/i18n.test.ts` checks that every language loads and holds its area files.
3. Settings: `LANGUAGE_KEYS` in `frontend/src/features/settings/SettingsModal.tsx`, and `settings.language.<name>` (the language's own name, e.g. `Français`) in `settings.json` of **every** language.
4. Tests: the `Locale` type and `CATALOGS` in `frontend/e2e/fixtures.ts`, the language list in `frontend/e2e/settings.spec.ts`.
5. Manual: `docs/manual/fr/` with `_meta.json` and every chapter of `ja` under the same file names (the `manual` skill, "Add a language"), then `scripts\manual.bat shots fr`.
6. Dates and numbers go through `Intl` with the current language, so they usually need nothing. Check by eye: the gallery's date filter and the Browse tab in that language, and `node tools/layout-scan.mjs --locales fr` for overflow, cut-off text and crowded controls.

## Remove a language

In one commit remove `locales/<lang>/`, `src/i18n/bundles/<lang>.ts`, the language in `LOCALES` in `catalog.ts`, the settings choice and its `settings.language.*` key in every language, the e2e lists, and `docs/manual/<lang>/`. A saved setting that still names the language falls back to ja (`setLocale`).

## Check

In `frontend/`: `npx vitest run tests/i18n.test.ts tests/i18n-add.test.ts tests/manual.test.ts`, `npm run typecheck`, `npm run check:eol`. For a new language also run `npx playwright test e2e/settings.spec.ts --project=chromium`. The pre-commit hook stops a commit that changes ja or en without the other, or leaves another language an out-of-date text.

Request: $ARGUMENTS
