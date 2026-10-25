---
covers:
  - frontend/src/state/comic/scene.ts
---
# Comic scenes (the scene operation)

How the assistant writes a panel as one `scene` operation, and what the app makes of it. How a panel is drawn is in [comic-drawing.md](comic-drawing.md); page layouts in [comic-pages.md](comic-pages.md).

## Behaviour

- The assistant is told to write each panel as one `scene` operation of `edit_comic` (`frontend/src/state/comic/scene.ts`, expanded in `applyComicOps`): the shot, the angle, the place, up to four people (a cast name, a single-person ready-made pose, a spot, a facing, what they do, their expression), cast names without a pose, the things the reader must see, the lines by speaker and the note.
- The app turns it into the operations a panel is made of, each kept to the user's parts: `panel` (the prompt, the cast, the place, the note), `pose` (each person placed for the shot, spread and turned towards the others unless told, with who and their own words, `poseWords`; a face shot gets none) and, when lines are given, one balloon per line aimed at its speaker in place of the panel's word balloons.
- The prompt holds the counts of several characters (by count tags, else their words), solo or no humans, male focus when its people are all men, the framing, the angle, the facing, each person's action and the things, asked for at `SCENE_THINGS_WEIGHT`.
