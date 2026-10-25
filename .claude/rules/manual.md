---
description: Writing, translating and checking the user manual (docs/manual/), and keeping it in step with the features users see
paths:
  - "docs/manual/**"
  - "frontend/scripts/manual.mjs"
  - "frontend/scripts/manual/**"
  - "frontend/tests/manual.test.ts"
---

# User manual

The manual is for users. The source is Markdown in `docs/manual/<language>/`, which `scripts\manual.bat` turns into HTML pages per language: a contents page and one page per chapter (`novira-data/work/manual/<language>/index.html`, `<NN-name>.html`). The built pages are `index.html`, a contents page with one card per chapter and the titles of its sections, and one page per chapter. Every chapter page has a left index of the chapters, with the sections of the chapter being read listed under it; it ends with links to the previous and next chapter, and the language list links to the same page in each language. The pages use no script, and `tests/manual.test.ts` checks them. The procedures (taking shots, building, updating chapters, translating, adding a language) are in the `/manual` skill. How to add a language is in [i18n.md](i18n.md).

## 1. When to update

When you add, change or remove a feature the user sees, update the manual **in the same change**.

| Change | What to do in the manual |
|---|---|
| A new screen, dialog or operation | Add an explanation to the relevant chapter, add a scene (`scripts/manual/scenes.mjs`) for any screen you want to show and bring it in with `shot:`. Write it in ja and en; the other languages follow (section 3) |
| A change of look or operation | Fix the explanation in the relevant chapter and keep the scene steps (`scenes.mjs`) in step with the screen. **Do not retake the shots yourself**: taking them is the user's to ask for (see section 5) |
| A change or removal of screen text | Chapters that use `{{ui:<key>}}` follow automatically. If you removed a key, the build and tests fail, so fix the chapter |
| Removing a feature | Delete the explanation and the scene. When you delete a scene, delete the chapters' `shot:` too (tests stop unused scenes and nonexistent scenes) |
| A change that does not show on screen (internal cleanup, a bug fix) | Do not update |

## 2. How to write chapters

- The source is **ja**, and **en** is written with it. Files are `NN-name.md` (the number is the reading order), and each starts with exactly one `# ` title. Every language has the same file names and, unless the chapter is pending (section 3), the same structure (headings, paragraph breaks, the number of rows in lists and tables, the order of images). `tests/manual.test.ts` checks this.
- Usable Markdown: headings `#` to `####`, paragraphs (**write one paragraph on one line**), bullet and numbered lists (nest with 2 spaces), pipe tables, code blocks, quotes (notes and tips), `---`, bold, italic, code, links, images. Raw HTML cannot be used. Links may be only https, `#heading`, and other chapters (`03-gallery.md`, `03-gallery.md#heading`).
- **Write screen words with `{{ui:<key>}}`** (buttons, tabs, menus, dialog titles). Make the part being operated bold (`**{{ui:app.tabs.generate}}** tab`). Text containing `{name}` cannot be used, so say it in your own words. Check keys with `grep`.
- One image per line: `![what is shown](shot:<scene id>)`. The description is required (it becomes the figure caption). Images are written the same way in every language; the per-language picture is produced by the shot-taking.
- Write only verified facts. For behavior that needs the real engine (install, GPU, models), write only what you confirmed from the code and the text, and do not write guesses. The text is read by users, so do not expose identifiers or internal names.

## 3. How to translate

- **Only ja and en are written with a change.** Then run `node frontend/scripts/manual-pending.mjs add`: it lists every changed chapter in `docs/manual/pending.json` for the other eight languages (and gives a language that lacks the file a copy of the English one). A chapter listed there is shown in English with a note and is not checked for structure. The pre-commit hook (`check-manual-sync.mjs`) stops a commit that changes a chapter in ja or en without en or ja, or without translating it or listing it as pending.
- **Catching up** (when a piece of work ends, before a release, or when asked): the `/manual` skill has the steps and a ready brief for a helper.
- Translate the ja chapter keeping the same structure. Do not change paragraph breaks, the number of table rows, the number of list items or the positions of images (tests stop this). Leave `{{ui:…}}`, `shot:` and URLs as they are.
- Match terminology to the app's text in that language (what `{{ui:…}}` produces). Do not invent words the app does not have.
- Translate each language's `_meta.json` too (`name` = the language's own name for itself, `title`, `subtitle`, `contents`, `language`).

## 4. How to write scenes

- A scene is one item of the array in `frontend/scripts/manual/scenes.mjs`, and one scene makes one picture. `id` is lowercase with hyphens.
- Write the steps with **`data-testid` and text keys**. Do not write concrete words such as Japanese (so it works in every language).
- A scene is used by a `shot:` in the ja chapter and in every translation.

## 5. Verifying and reporting

- **Never take the manual's shots (`shots`, `all`) on your own initiative.** The user takes them by hand with the tool (`scripts\manual.bat shots [languages]`) or tells you to. A change that leaves the pictures out of date is reported as "pictures not retaken", with the scenes that are affected; it is not a reason to run the shots.

- Even for changes to chapters or `_meta.json` only, run `npx vitest run tests/manual.test.ts` (in frontend/; `npm run manual:check`), because it checks structure and screen words. Run it as soon as ja and en are written, before translating or handing anything to a helper: a screen word that cannot be used (for example one with a `{count}` placeholder) is then found once, not in every language. Line endings are LF.
- The report states the chapters and languages you fixed (and which languages are left pending), the scenes you added or changed, the range you retook (all languages or some), and the range you did not look at.
