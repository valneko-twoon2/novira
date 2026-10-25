---
covers:
  - frontend/src/state/comic/rough.ts
  - frontend/src/state/comic/roughView.ts
  - frontend/src/state/comic/roughMesh.ts
  - frontend/src/state/comic/roughBake.ts
  - frontend/src/state/comic/roughEdit.ts
  - frontend/src/state/comic/roughPanel.ts
  - frontend/src/features/comic/rough/**
---
# Comic 3D rough

A panel's layout in 3D: people as mannequins, props and a floor seen through a camera with perspective. Applying it bakes the panel's OpenPose picture and a depth map, which two ControlNet layers read, so the people and the set stand where the rough has them.

## Behaviour

### What a rough holds

- A panel may keep `rough` (`ComicRough` in `frontend/src/state/comic/rough.ts`) and `depthImageName`, beside its `poses` and `poseImageName` ([comic-canvas.md](comic-canvas.md)). Units are metres, y is up, the floor is y = 0.
- The camera orbits a target: yaw, pitch (held to `ROUGH_PITCH_MAX`), distance and a vertical angle of view (`ROUGH_FOV`). A person is the 18 OpenPose joints in its own space (y up from the soles, facing +z, its right side at -x) with where it stands (x, y, z) and its yaw. A prop is a box, an upright plane or an upright cylinder, with the middle of its bottom, its yaw and its sizes (`ROUGH_SIZE`). The floor can be off.
- At most `ROUGH_PEOPLE_MAX` people and `ROUGH_PROPS_MAX` props. `parseRough` reads a saved rough as outside data (see Boundaries). A new rough has one standing person, a floor and the default camera.

### The editor

- The pose tool of a panel (`frontend/src/features/comic/PanelTools.tsx`) opens it with "3D rough" and says whether the panel uses its rough, or whether its depth map was dropped.
- It opens on the panel's own rough while its depth map is current. Otherwise (`roughFor` in `roughPanel.ts`) it takes the rough's camera and props, or a new rough, and stands the panel's current people up in front of the camera (`liftPoses` in `roughView.ts`): each a flat figure facing the camera (turned away when its right shoulder is on the picture's right), square to the camera's view and so tilted with a camera that looks up or down, at the distance where an adult's torso is as tall as the figure's, so the camera sees the pose as it was. Such a person may stand below the floor; only a lift given moves it up to the floor, a turn does not. A panel without a rough and without a pose starts with one standing person.
- The view (`features/comic/rough/scene.ts`, three.js loaded when the editor opens) is the panel: its shape and the rough's camera. Dragging a person or a prop moves it on its level; dragging a coloured joint of the chosen person swings that limb round the joint it hangs from (`aimBone`, `swingJoint` in `state/pose/math3d.ts`; the neck moves the person); dragging the background turns the camera, Shift or the right button slides it, the wheel moves it nearer. The view is drawn from the same triangles as the bake and follows the theme.
- The side panel (`RoughDialog.tsx`, edits in `roughEdit.ts`) adds a person, a box, a board or a cylinder (a new board stands behind the target, other things beside it), lists what is on the set, and for the chosen one sets its turn, its height above the floor and its sizes (a person's size in percent of an adult, kept by its torso length, between `PERSON_SIZE` limits; a change scales from the exact size, not the whole percent shown), removes it, sets the angle of view, the floor and the camera back. Small pictures show what the ControlNet will get, baked a moment after each change.
- Without WebGL the view says so; the side panel and "Use" still work.

### Baking

- "Use" (`applyRough`) bakes at the panel's picture size. The set's triangles (`roughMesh.ts`: a box torso, a ball head, cylinders for the neck and limbs, balls for the hands, boxes for the feet, each person's parts as thick as its torso is long; props; a floor to the horizon) are drawn into a depth buffer through the camera (`roughBake.ts`): each triangle is cut at `NEAR` in front of the camera and filled with one over its distance, the nearest kept.
- The depth map is one over the distance stretched from the farthest surface (black) to the nearest (white); where nothing is, black.
- A joint is hidden when a surface lies more than a margin in front of it (0.15 m for an adult, growing with the person): the face of a person seen from behind, the far arm of one seen from the side, legs behind a desk. A joint behind the camera is hidden and takes the point of the nearest joint the camera sees (a person wholly behind the camera stands outside the picture), so the panel's person box stays on the person; one outside the picture is kept. The OpenPose picture draws the joints as `drawPose` does, without the hidden ones.
- Both pictures are uploaded as gallery control pictures; the panel then takes the rough, the people as fractions of the panel (its `poses`, so balloons and regions keep working), `poseImageName` and `depthImageName` in one undo step (`setPanelRough`), unless the panel's pose changed while the pictures were stored (then that pose stays, and a notice says so). Drawing waits for a bake under way (`trackPose`, `posesReady`).

### Drawing and other pose changes

- A panel with a depth map sends it after its pose as a control layer with `controlType` depth, on a ControlNet named for depth, else a union one (`pickDepthModel` in `state/poseSkeleton.ts`), at `DEPTH_CONTROL`. Without such a model the layer is left out and the panel warns (`comicWarnings`); so it is when the depth map's proportion is more than 2 % off the panel's (the cut or the page size changed since the bake, `roughOutOfShape` in `request.ts`), and the warning says to use the rough again.
- A pose put in any other way (`setPanelPose`: the pose editor, a ready-made pose, the assistant's `pose` operation; a panel template) drops `depthImageName` and keeps the rough.
- The assistant sees `rough: true` on a panel whose depth map is current, and its instructions say to leave that pose alone unless asked. It cannot edit a rough.

## Boundaries

| Boundary | Guard |
|---|---|
| A rough saved in a comic document (read back from the database or a file) | `parseRough` takes only an object; every number is finite, held to its range (places within `ROUGH_EXTENT`, joints within 4 m of the person, sizes, angle of view, distance, pitch) and rounded; a person needs exactly 54 joint numbers; unknown shapes are dropped; ids are strings of at most 80 characters, the first of each kept; counts are cut to their limits. The bake's work is bounded by these counts and the panel's picture size. |
| The baked pictures | Drawn in the page on canvases and uploaded through `uploadImage` like the pose editor's picture; the panel stores only their gallery names. |
| three.js | Loaded with a dynamic `import()` when an editor opens, from the app's own files; no network, no eval, no CSP change. |

## Known limits

- The mannequins are crude; a stronger depth layer copies their shape. `DEPTH_CONTROL` was tuned on WAI-illustrious-SDXL with xinsir's union ControlNet only.
- A person seen exactly side-on or from above may hide or show a joint at the margin; the margin is one number for the whole body.
- Lifted people are flat figures facing the camera; their depth and turn are for the user to give.
- The panel's `poses` keep no hidden joints: a joint something hides keeps its place on the person (its box and head stay right), and the pose editor shows it as a shown joint, as for a ready-made pose seen from behind.
- The rough's view and drags were checked in headless Chromium with software WebGL only, not in the app's web view.
