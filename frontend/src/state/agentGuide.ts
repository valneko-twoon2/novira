// What the AI assistant is told about the app itself: its screens and features, so that "how do I ...?" is answered from
// facts and not from guesses. `about` is English for the model; `name` is what the screen calls it in the user's language.
// The two Records below must list every tab and every kind of media, so a new tab or media kind fails the type check
// until the assistant has been told about it (see `.claude/rules/assistant.md`).
import type { AgentGuideEntry } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import { isScreenShown, MEDIA_KINDS, TABS, type MediaKind, type TabName } from './ui';

const TAB_NAME: Record<TabName, MessageKey> = {
  generate: 'app.tabs.generate',
  canvas: 'app.tabs.canvas',
  comic: 'app.tabs.comic',
  upscaling: 'app.tabs.upscaling',
  workflows: 'app.tabs.workflows',
  models: 'app.tabs.models',
  browse: 'app.tabs.browse',
  queue: 'app.tabs.queue',
  extensions: 'app.nav.extensions',
};

const TAB_ABOUT: Record<TabName, string> = {
  generate:
    'Side bar tab (key 1). Makes pictures from a prompt: prompt, model, LoRAs and size are in the left panel, the Invoke button starts it, results fill the gallery on the right. Left panel top: a row of icons for image, video, music, voice, logo, text on a picture and, last, the Comic (book icon). Centre views: Start, Viewer, Drafts.',
  canvas:
    'Side bar tab (key 2). A work table: put pictures on layers, paint, and redraw only a part (inpaint) or extend the picture (outpaint) inside the generation box; accept or discard the result before it is kept. Has control layers and a pose maker. Saves to the gallery or as PSD.',
  comic:
    'Not a side bar tab: the book icon at the end of the icon row on the Generate tab (key 1 reopens the last used of the two). Makes comic pages; comics are picked or made at the top left. Toolbar: page settings (panels, columns, paper, direction, frame width and colour, inset, effect), templates, cut tool, panel tools (balloons, pose or 3D rough, place, stage direction, panel templates), picture tools, trash, save page (picture, PSD), export all (PDF, CBZ, PSD). Under the page: undo/redo, page thumbnails, zoom. A press drags a panel anywhere (the page turns free); add-panel puts one mid-page; the cut tool splits one along a line; corners and edge bars reshape it. A press outside the panels selects the page picture. The right column panel tab holds the panel prompts; the draw bar at the top draws the panel, the page or the comic. Uses the Generate model and settings; its reference images apply to every panel (IP-Adapter); a pose needs an OpenPose (or union) ControlNet, the depth map of a 3D rough a depth (or union) one. A picture on a panel moves with Alt held or after a double click, scales with Alt and the wheel; the toolbar fits, turns and mirrors it, the brush repaints a painted part (inpaint), the clock puts back an earlier picture. The balloon tool offers speech, thought, shout, sound effect and more; a double click edits shape, words, size, vertical text, tail, line, fill and outline (Fit the words shrinks overflow). Layers (under the tabs): panels, balloons, rasters; hide, lock, fade, blend, reorder. Page/Paint switch paints on a raster (own undo). The cast list of the panel tools gives each character a sheet (back, side, three-quarter, face views for references by framing).',
  upscaling:
    'Side bar tab with a frame icon (key 3). Enlarges a picture and redraws fine detail. Needs an upscale model; a tile ControlNet that fits the main model is used when installed (Anima, Qwen-Image and other families without one redraw without it, and Structure then has no effect).',
  workflows:
    'Side bar tab (key 4). A node editor to connect parts into your own generation steps (library, templates, form view, import and export). Nodes: the editor\'s own, Read Aloud (speech), ComfyUI\'s own (hundreds) and extensions\'. A graph ends in a picture, sound or video.',
  models:
    'Side bar tab (key 5). The model manager: installed models, adding models from files or addresses, details, default settings, trigger phrases, and deleting.',
  browse: 'Side bar tab (key 6). Searches Civitai for models, or takes a pasted Hugging Face model address, and downloads them into the app.',
  queue: 'Side bar tab (key 7). Shows the jobs that are waiting or running; each can be cancelled. Jobs run one at a time.',
  extensions:
    'Side bar tab (key 8, puzzle icon). The extension manager. Lists extensions (custom node packs) of the public ComfyUI Registry plus the ones novira suggests and the ones already in ComfyUI. The rail on the left filters by installed, not installed, updatable, or purpose; the search box looks in names, makers and descriptions; a card opens a detail panel with maker, licence, versions and the install or remove button. After installing or removing, press the restart button that appears so ComfyUI loads the change. A GitHub address can be installed from the box at the top. ComfyUI itself is the first card and its version can be switched. Each detail panel has a button to ask this assistant about the extension.',
};

const MEDIA_NAME: Record<MediaKind, MessageKey> = {
  image: 'media.tab.image',
  video: 'media.tab.video',
  music: 'media.tab.music',
  voice: 'media.tab.voice',
  logo: 'media.tab.logo',
  text: 'media.tab.text',
};

const MEDIA_ABOUT: Record<MediaKind, string> = {
  image: 'Icon at the top of the Generate tab left panel. Makes pictures. Settings such as steps, CFG, size, seed, high-resolution fix, reference images and presets are in the left panel.',
  video: 'Icon at the top of the Generate tab left panel. Makes a short clip from a prompt (or from a picture). Needs the video model, downloaded once from a card in the left panel. Choices: size, length, frame rate, standard or fast model.',
  music: 'Icon at the top of the Generate tab left panel. Makes a song from style tags and lyrics (or an instrumental). Needs the music model, downloaded once from a card.',
  voice: 'Icon at the top of the Generate tab left panel. Reads text aloud with a preset speaker or a voice described in words. Needs the voice model, downloaded once from a card.',
  logo: 'Icon at the top of the Generate tab left panel. Makes candidates of a logo with the given letters in a chosen style. Needs the logo model, downloaded once from a card.',
  text: 'Icon at the top of the Generate tab left panel. An editor for letters and speech bubbles on a picture: layers, fonts, outlines, shadows, bubble shapes and tails, ready-made styles.',
};

/** Features that are not a tab: where they are and what they need. */
const FEATURES: { id: string; name: MessageKey; about: string }[] = [
  {
    id: 'gallery',
    name: 'app.tabs.generate',
    about:
      'The right panel on most tabs: boards (folders) and thumbnails of everything made. Click to open in the viewer, right-click for a menu, select several for batch actions, search, filter by date, star, delete, upload, download, export clean or AI-watermarked copies.',
  },
  {
    id: 'afterEffects',
    name: 'gallery.derive.menu',
    about:
      'Actions on a finished picture, from the viewer toolbar or the right-click menu in the gallery: make it again with the same settings (derive), remove the background, trim transparent margins, select a part (segment) to cut or redraw, fix a face, manga page, write a prompt from the picture (caption), register a character, compare settings in a grid (XY plot), and process many pictures at once (batch). Remove background needs the RMBG extension, select a part needs segment-anything-2, fix a face needs Impact Pack and Impact Subpack, caption needs Florence2; a dialog offers to install a missing one.',
  },
  {
    id: 'poses',
    name: 'canvas.tool.pose',
    about:
      'Canvas tool (key O) for OpenPose poses on a control layer: click to place a standing figure, drag joints (Shift moves one joint, Alt hides it), and press R or the shuffle button for a new random pose as often as wanted; several figures fit on one layer. On the Canvas screen the user can also ask this assistant for a pose in words ("a girl running", "raise the left hand"); it places the figure, and a follow-up request changes it. The layer gets an OpenPose ControlNet when one is installed. The pose tool bar and the gallery right-click menu can also read the people in a picture as poses (needs the ControlNet preprocessors extension, offered for installing when missing). The pose tool bar also has an editor that shows the figure in 3D (drag joints, turn the body, then apply as a flat pose), and a window of ready-made poses and manga panel compositions (categories on the left, a card with the OpenPose figure for each pose on the right): compositions for close and far shots, two people, groups, everyday scenes and drama place people in the frame, and common poses and manga action poses (fights, weapons, magic, sports, dynamic moves, feelings) reshape the first pose. The Add menu of the layers also has a pose dialog with presets.',
  },
  {
    id: 'drafts',
    name: 'app.views.drafts',
    about: 'A view on the Generate tab: many half-drawn candidates with the same settings and different seeds; finish only the ones you like. Any picture model but edit ones.',
  },
  {
    id: 'assistant',
    name: 'agent.title',
    about:
      'This assistant (AI button in the side bar) runs Claude or Codex on the PC. It sets models, LoRAs, prompts and parameters, edits the comic, text, workflow, forms and poses, queues generation when asked, recommends extensions. Reading pictures and prompts needs permission (Settings > Generation), not attached ones. Undo reverts a whole request.',
  },
  {
    id: 'settings',
    name: 'app.nav.settingsMenu',
    about:
      'Bottom left of the side bar: Settings in tabs (language, theme, start tab; low memory; gallery; undo steps; fonts, new comic page defaults; engine; accounts; backup, reset; developer log), shortcut keys, About.',
  },
];

/** Tabs, kinds of media and the other features, with names in the user's current language. */
export function agentGuide(): AgentGuideEntry[] {
  return [
    ...TABS.filter(isScreenShown).map((tab) => ({ id: `tab.${tab}`, name: t(TAB_NAME[tab]), about: TAB_ABOUT[tab] })),
    ...MEDIA_KINDS.filter(isScreenShown).map((kind) => ({ id: `media.${kind}`, name: t(MEDIA_NAME[kind]), about: MEDIA_ABOUT[kind] })),
    ...FEATURES.map((f) => ({ id: `feature.${f.id}`, name: t(f.name), about: f.about })),
  ];
}
