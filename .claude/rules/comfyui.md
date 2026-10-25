---
description: Constraints of the ComfyUI integration - packs installed into a running engine
paths:
  - "backend/crates/novira-core/src/comfy/**"
---

# ComfyUI integration

novira installs ComfyUI, starts it, and builds the graphs it runs. The constraints below were found by measuring on a real machine. The measurements themselves are in git history.

## 1. Packs are installed into a running engine

- A pack is installed while ComfyUI runs, so `pip` writes into files the engine has loaded. On Windows a loaded DLL cannot be overwritten; the install then fails with `WinError 5`.
- `skipped_requirements(repo)` in `comfy/node_packs.rs` lists, per pack, the libraries left out of its `requirements.txt` because installing them would break the running engine: pip would replace a loaded file, or change a library that an installed one is pinned to. The installer writes that list without those lines to its work folder and gives the file to `pip`. The pack's own `requirements.txt` is not changed.
- Entries for `Fannovel16/comfyui_controlnet_aux` (owner and name compared without case):
  - `mediapipe`: its `opencv-contrib-python` replaces the `cv2.pyd` that ComfyUI has loaded (`WinError 5`). Measured on 2026-10-08 with ComfyUI 0.38.0 and Python 3.13: without that line the pose pack installs through the app in about 59 seconds, and its DWPose preprocessor reads pictures. Its face-mesh and mesh-graphormer preprocessors need `mediapipe` (not tried with it installed).
  - `albumentationsx`: it needs `albucore==0.2.21`, and the portable build's `albumentations` 2.0.8 is pinned to `albucore==0.0.24`, so pip reported the conflict and changed `albucore`. The pack imports `albumentations` only in its DiffusionEdge node, inside the node's run function. That node then uses the installed `albumentations` 2.0.8, which is not tried.
- Add an entry only after the failure has been seen. Write beside it the locked file or the conflicting pin, the requirement that causes it, and what the pack still does without that requirement.
- A portable build lists PyTorch and its companions as `name @ file:///…/name-version-….whl#sha256=…`. `constraints()` takes the version from the wheel's file name (`torch==2.14.0+cu130`), so the install is held to ComfyUI's PyTorch. The constraint is checked by a unit test, not on a real install.
