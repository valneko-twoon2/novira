---
covers:
  - frontend/src/state/comic/stamps.ts
  - frontend/src/state/comic/typeset.ts
  - frontend/src/state/comic/stamps.json
  - frontend/src/state/comic/templates.ts
  - frontend/src/state/comic/moreTemplates.ts
  - frontend/src/features/comic/PageTemplates.tsx
  - frontend/src/features/comic/StampPicker.tsx
---
# Comic page layouts, lettering checks and sound-effect pictures

What a comic page can be cut into, how the lettering of a comic is checked, and the pictures of sound effects a panel can carry. The saved document, layers and the picture jobs of the comic are in [comic-canvas.md](comic-canvas.md).

## Behaviour

- Page layouts: the grids (`BUILTIN_PAGE_LAYOUTS` in `templates.ts`) and the shape layouts (`templates.ts` and `moreTemplates.ts`), each panel's corners in unit points and stored for a page read from the left; the app mirrors them for a page read from the right. The names are `comic.template.builtin.<id>`. The page's own layout can be saved as a template, and the comic keeps its saved ones.
- Lettering checks (`state/comic/typeset.ts`): `checkTypesetting` goes over every balloon of the comic and reports, with page, panel and balloon numbers from 1, a balloon that covers a head (the box around the nose and ears or eyes of a pose, 20% covered), two balloons that cover each other (15% of the smaller), a balloon that leaves its panel by more than 2%, a balloon with over 60 characters or 5 lines (captions and boxes excepted), an empty one, and balloons whose panel order is against the reading direction of the page (next one above, or on the same row on the wrong side). Balloon boxes are estimated from the words (`estimateBox`), so a result is a lead. The assistant reads it as `typesetIssues` of `get_comic_page`; nothing blocks an edit.
- Sound-effect pictures (balloon kind `stamp`): 114 black-and-white pictures with a transparent ground (3 hands of 38 words, repeated words such as the 4 to 7 times repeated gogogo in their own pictures) in `frontend/src/assets/onomatopoeia` (built into the app; `public/` is left out of the desktop build), listed in `state/comic/stamps.json` (id, hand, lettered word, reading, intensity, picture size, uses) and read through `stamps.ts`. The balloon keeps the picture id as its `text` (a text that names no picture draws nothing and is left off the saved page). It has no balloon and no tail; its height is `STAMP_HEIGHT_EM` times the text size of a balloon of its `scale`, its width follows the picture, and `rotation` turns it about its middle. The screen draws an `img` (`ComicBalloon.tsx`); the saved page and the PSD draw the loaded picture (`drawStamp` in `pageRender.ts`, pictures loaded by `preparePage`). The balloon editor swaps its text box for a picker (`StampPicker.tsx`) that searches by word, reading or use and narrows by hand. The assistant adds one with `addBubble` kind `stamp` and a picture id or the lettered or read word (`findStamp`: the exact id or word first, then the word without its marks and with long and small vowels alike, then for one sound repeated the picture with the nearest count; an unknown word makes the operation fail with a note that lists the 38 words). The pictures are CC0 (`frontend/scripts/oss-included.json`).

## Boundaries

| Boundary | Guard |
|---|---|
| A saved stamp balloon names a picture | The text is looked up in the stamp list; a text that names none draws nothing and is left off the saved page, so a damaged document cannot load another file |
| The pictures are fixed files | They ship with the app (`frontend/src/assets/onomatopoeia`, built into the app: `public/` is left out of the desktop build); no path or address comes from the document or the assistant, only an id looked up in the list |

## Known limits

- The layout names describe the page as read from the right; a page read from the left shows them mirrored.
- The stamp pictures are black and white only; there is no recoloring and no stretch of one side.
- A balloon's words are reported as too small when their size (`TEXT_SHARE` × scale × the panel's width as a share of the page's width) is under 1.7% of the page's width, about 2.5 mm on an A5 page; pictures (`stamp`) are not checked.
- The lettering checks only report; nothing blocks an edit. Only people with a pose have a head to check; a face drawn without a pose is not seen.
