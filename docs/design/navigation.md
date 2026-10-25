---
covers:
  - frontend/src/state/ui.ts
  - frontend/src/app/SideNav.tsx
  - frontend/src/features/media/MediaTabs.tsx
  - frontend/src/app/GlobalHotkeys.tsx
  - frontend/src/app/Workspace.tsx
  - frontend/src/app/ComicWorkspace.tsx
---
# Navigation

How the user moves between the screens: the side bar, the number keys, and the media row that holds Generate and Comic in one entry.

## Behaviour

- Every screen is a `TabName` (`generate`, `canvas`, `comic`, `upscaling`, `workflows`, `models`, `browse`, `queue`, `extensions`) in `frontend/src/state/ui.ts`. The names are a contract: the queue origins, the assistant's screen names, the saved start tab and the per-screen centre view use them.
- The side bar (`SideNav.tsx`) lists `NAV`, eight entries. The comic has none: `navOf` maps it to Generate, so the Generate entry stays lit on it. Extensions sits at the foot of the bar as a toggle button. Above it, on the page `novira-server` serves to its own computer only, a QR item opens the home network: open and close it, trust the network, the pairing code, and the phones asking to pair (`HomeLinkButton.tsx`, [browser-server-pairing.md](browser-server-pairing.md)).
- Generate and Comic are two screens under one entry. The comic is the seventh icon (book) of the media row `MediaTabs.tsx` at the top of the left panel of both (mounted in `Workspace.tsx` and `ComicWorkspace.tsx`; test id `media-comic`). The other six icons pick a media kind on Generate; pressing one while the comic is shown also brings Generate back, and none of them is lit while the comic is. The entry and the key `1` open the mode shown last (`generateMode`, which `setTab` updates whenever one of the two is shown).
- Code that opens the comic (the assistant's navigate tool) sets the tab `comic`; nothing else changes for it. Upscaling is its own entry with the frame icon.
- The number keys follow `NAV_HOTKEYS` (`GlobalHotkeys.tsx`): 1 Generate, 2 Canvas, 3 Upscaling, 4 Workflows, 5 Models, 6 Browse, 7 Queue, 8 Extensions. The comic has no key of its own.
- The start-tab setting lists every `TabName`, the comic included (`restoreSettings` in `frontend/src/state/settings.ts`); opening it as the start tab also makes it the mode the Generate entry reopens.

## Boundaries

None: navigation is screen state in the WebView and crosses no boundary.

## Known limits

- The media row exists only on the Generate and Comic screens; from another screen, the comic is reached through the Generate entry.
- For now the app's build (Vite mode `production`) leaves out every screen but the image one (`HIDDEN_TABS` and `isScreenShown` in `frontend/src/state/ui.ts`); the dev server, the tests and every harness build (`HARNESS_MODE` in `tools/harness-paths.mjs`: the e2e build, the verification app, the browser server) show them all. A hidden screen has no way in: the store's `setTab` and `setMedia` refuse it (so a saved start tab of `comic` opens Generate), the gallery's menu and the logo screen leave out the items that send a picture there, and the assistant is neither told about it (`agentGuide`) nor given its editor, so its tools answer that it is not available.

## Not implemented

- Canvas is still its own side bar entry.
