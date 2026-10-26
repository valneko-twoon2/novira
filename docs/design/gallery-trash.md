---
covers:
  - backend/crates/novira-core/src/service/gallery.rs
  - backend/crates/novira-core/src/service/boards.rs
  - backend/crates/novira-core/src/media/images.rs
  - frontend/src/state/galleryUndo.ts
  - frontend/src/features/gallery/actions.ts
  - frontend/src/features/gallery/grid/useGridHotkeys.ts
  - frontend/src/features/gallery/header/GalleryHeader.tsx
---
# Deleting pictures and taking it back

A deleted picture is kept for a while, so a deletion made by mistake can be undone, and what was undone can be deleted again. The files and boards themselves are in [gallery-share.md](gallery-share.md).

## Behaviour

**The trash.** `delete_images`, and deleting a board together with its pictures, do not remove a picture: its record moves to the `trash` table (the picture's gallery record and the time) and its two files move to the data folder's `trash/` (`ImageFiles::trash`). `restore_images` moves them back and answers the pictures that came back. A picture returns with its board and star; when its board was deleted meanwhile it returns uncategorized. A name the gallery does not know (a stray file) is deleted outright.

**Keeping.** A picture stays 14 days, and at most 500 pictures stay; each deletion drops the older ones beyond that for good (`stale_in_trash`). Backups do not include the trash.

**On the screen.** `state/galleryUndo.ts` keeps the last 30 deletions, each as the names of one deletion. The toast shown after a deletion has an "Undo" button for that deletion; the two buttons at the top of the gallery and Ctrl+Z / Ctrl+Shift+Z (also Ctrl+Y) take back the latest deletion and delete it again. The keys work while the viewer is open or the pointer is over the gallery, so the canvas keeps its own. A new deletion ends what could be deleted again. When the backend no longer holds the pictures, a warning says so.

## Known limits

- The history of what can be undone is not kept over a restart; the trash is, so a picture is still in `trash/` within its 14 days.
- A deleted picture frees its disk space only when it is purged.
- The phone page deletes into the same trash but cannot take a deletion back.
