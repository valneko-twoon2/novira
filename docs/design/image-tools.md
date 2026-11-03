---
covers:
  - frontend/src/state/imageTools/**
  - frontend/src/features/viewer/tools/**
  - frontend/src/features/gallery/menus/SingleImageMenu.tsx
---
# Picture tools: the "Fix" group and the tool band

Four steps on a finished picture, each a ComfyUI graph job of the app: fix the faces (Impact Pack's FaceDetailer), remove the background (RMBG), describe the picture as a prompt (Florence-2) and read the poses of its people (DWPose). They run from the picture menu at once, or from a band over the viewer's picture where their settings are; the picture stays in the viewer, so it can be zoomed and compared.

## Behaviour

- **Menu.** `SingleImageMenu.tsx` groups the four under the heading `gallery.tools.heading` (reading poses not on a phone). An item calls `quickRunTool` (`frontend/src/state/imageTools/actions.ts`): the picture is shown (`toolViewer().showPicture`: the desktop viewer, the phone's full-screen view), the band opens on the tool in its status mode, the node definitions are read when unknown (`loadToolNodes`), and the run starts with the stored settings. A tool that is not ready opens the band on its settings instead, which say why. The gear item at the right (`ContextMenuSplitItem` in `frontend/src/ui/overlays.tsx`) calls `openToolSettings`: the band on the settings, no run.
- **Other entry points.** The viewer toolbar's cut-out, face and caption buttons toggle the band on the shown picture (`toggleToolBand`). The prompt box's describe button and the canvas pose tool's "pose from a picture" button run the tool on the one still picture selected in the gallery, else on a file picked and uploaded first (`frontend/src/state/imageTools/pickPicture.ts`); the describe button also takes a dropped picture or file.
- **Band.** `frontend/src/features/viewer/tools/ToolBand.tsx`, mounted by `ImageViewer.tsx` under the toolbar and by the phone's `PhoneView` over the picture. Its state (open, tool, picture, mode `settings` or `status`, the face fix's model and prompt for this picture) is `useToolBand` in `band.ts`. A switch changes tool; the settings mode shows the tool's fields (`ToolFields.tsx`) and Run, or what is missing (`readiness.ts`: loading, a pack to install with its install or restart button, no face detector, no model); the status mode shows the last run of the tool on that picture (`ToolRunView.tsx`): waiting or running with the queue's progress and the cancel button, or its end with the settings it used and "change the settings and run again". The band follows the viewer to another still picture, but not to a picture a tool run made (`madeByToolRun`, which knows it from the queue item before the run has its result).
- **Settings.** `useImageToolSettings` (`settings.ts`, key `novira.imageTools`, followed live by other pages) keeps each tool's last settings; a change in the band is kept at once. Stored values are read back through `restoreToolSettings` (ranges in `TOOL_RANGES`). The face fix's model and prompt start from the picture's own (`faceFixModel`, `faceFixPrompt` in `request.ts`) and are kept only while the band stays on that picture.
- **Runs.** `startToolRun` (`runs.ts`) builds the job (`buildToolJob`: the graph builders of `frontend/src/state/comfy/`, a picture job on the picture's board or a text job kept out of the gallery) and waits for it through `runJob` / `runTextJob`, holding the abort controller itself: no screen owns a run, so closing the band, switching screens or pictures leaves it running, the model a first run downloads inside the job included, and only `cancelToolRun` (the band's cancel button) cancels the queue item. Pack installs the band starts go through `useNodePacks` and the download dock, and do not depend on the band either. `useToolRuns` keeps the last run of each tool; an older run of the same tool still ends and saves its picture but is no longer shown.
- **Results.** A picture is saved to the gallery by the job. When the band still shows that tool on that picture, the viewer compares the result with the original (`toolViewer().showResult`; the phone shows the result full screen). A description is shown as editable text with replace, append and copy (`applyDescription`); poses with how many people were found and the buttons that put them on the canvas through the placer the canvas registers (`registerPosePlacer` in `posePlacer.ts`, which also shows the canvas). What the band does not show becomes a notice: the picture saved, a failure with its reason, or that a text result is ready.

## Boundaries

None of its own: the jobs are ordinary queue items with an app-written graph (`origin` `workflows`), checked by the backend like any other ([generation.md](generation.md)); a file picked for a tool is uploaded like any gallery upload.

## Known limits

- One run per tool is shown: starting the same tool on another picture replaces what the band shows of the first run (its picture is still saved).
- While the band shows the result of a run, the band does not follow the viewer to that result; after leaving compare mode the band stays on the original until another picture is chosen.
- The face fix redraws without the picture's LoRAs.
