---
covers:
  - backend/crates/novira-core/src/media/arrangement.rs
---
# Gallery files on disk

The originals of the gallery are kept under `outputs/` in folders a person can read in Explorer. The gallery, the image addresses and backups still know a picture by its name (`<uuid>.png`); only the place of the file changes. Thumbnails stay flat in `thumbnails/`.

## Behaviour

**Folders.** A picture on a board is in a folder named after the board; one on no board is in `未分類`; a picture the gallery does not show (a draft, the canvas's work, a mask: `is_intermediate`) is in `_下書き`. A board name becomes a folder name Windows accepts (`safe_folder`: `<>:"/\|?*` and control characters become `_`, no dot or space at the end, no device name, at most 60 characters). Two boards that make the same folder name, compared without case, or a board named like one of the two fixed folders, are told apart by " (2)", " (3)", the older board keeping the plain name.

**File names.** `<YYYYMMDD_HHMMSS>_<name>`, the time the picture was made in local time. The whole name stays in the file name, so `ImageFiles::index` finds every file again by its name at start, wherever it is one folder down (or flat, as an older version kept it).

**When files move.** At start (after the index), after a picture is stored, after its board or `isIntermediate` changes, after a board is renamed or deleted, and after a picture comes back from the trash, `arrangement::arrange` moves each file that is not where it belongs and removes folders left empty. A file already at the place is never replaced; a file that cannot be moved stays and still opens.

## Known limits

- Renaming a board moves its files one by one; a board of many thousands of pictures takes a moment.
- Moving files by hand into another folder works (they are found again), but the next arrangement moves them back where their board says.
- A backup stores the originals flat as before; a restored library is arranged at its next start.
