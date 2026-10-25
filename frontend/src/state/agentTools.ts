// The assistant's tools, as the frontend runs them. The backend's MCP server checks each call against the tool's schema
// and relays it here (`agent_tool_call`); this module reads or changes the app through the same appliers the editors
// use (they check every operation and field again), keeps an undo snapshot before the first change of each kind, logs
// what changed for the chat's chips, and asks the user before reading pictures or prompts, or looking something up on the web (the permission settings).
import { backend, SCHEDULERS, type AgentScreen, type AgentToolCall, type GenerationMetadata, type ImageDTO } from '@/backend';
import { agentExtensions, extensionId, folderOfExtensionId, questionWords } from './agentExtensions';
import { agentGuide } from './agentGuide';
import { mangaGuide } from './comic/mangaGuide';
import { agentEditor, agentWorkflow, extensionNodes, selectAgentModel } from './agentRegistry';
import type { AgentToolLog, EditScreen } from './agentSessions';
import { buildItems } from './comfy/extensionList';
import { useNodePacks } from './comfy/nodePacks';
import { agentPacks } from './comfy/packCatalog';
import { useRegistry } from './comfy/registry';
import { useGallery } from './gallery';
import { enqueueActive } from './invoke';
import { isDrawable, useModels } from './models';
import { useParams, type ParamsFields } from './params';
import { useQueue } from './queue';
import { useSettings } from './settings';
import { useUi, type MediaKind } from './ui';

/** The user's answer when asked. */
export type PermissionChoice = 'once' | 'always' | 'deny';

/** The tool that sends the model's words to a website. It has its own permission setting, apart from reading pictures. */
export const WEB_TOOL = 'lookup_reference';

/** Tools that read the user's pictures or prompts, or send words to the web (the backend tags these too; either tag is enough to ask). */
export function isReadGated(tool: string, args: unknown): boolean {
  if (tool === 'list_gallery_images' || tool === 'get_image_info' || tool === 'view_comic_page' || tool === WEB_TOOL) return true;
  return tool === 'get_generation_settings' && isRecord(args) && args.includePrompts === true;
}

/** For the question about a web look-up: the words that would be sent (shortened, on one line) and the language. */
export function webQuestion(tool: string, args: unknown): { query?: string; language?: 'ja' | 'en' } {
  if (tool !== WEB_TOOL || !isRecord(args)) return {};
  const query = typeof args.query === 'string' ? args.query.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
  return { query, language: args.language === 'en' ? 'en' : 'ja' };
}

/** What the model is told when it may not read. */
export const DECLINED =
  'The user did not allow the assistant to read their pictures and prompts. Do not ask for this again in this request: go on without it, or tell the user what you would need.';

/** What the model is told when the user does not allow a look-up on the web. */
export const DECLINED_WEB =
  'The user did not allow the assistant to look this up on the web (Wikipedia). Do not ask for this again in this request: go on without it (use what you know and say it is not checked), or tell the user what you would need.';

/** The refusal text for a tool that was declined. */
export const declinedFor = (tool: string): string => (tool === WEB_TOOL ? DECLINED_WEB : DECLINED);

/** The most characters of one answer sent back (the backend refuses more). */
export const MAX_ANSWER_CHARS = 200_000;

/** The state of one request's tool calls: the log for the chips, the undo snapshots, and the permission gate. */
export interface ToolRun {
  log: AgentToolLog[];
  /** The settings before the request first changed them. */
  snapshot?: Partial<ParamsFields>;
  /** Each editor's data before the request first changed it. */
  editSnapshots: Partial<Record<EditScreen, unknown>>;
  /** Whether a read of the user's pictures or prompts, or a look-up on the web, may go ahead (asks the user when its setting says so). */
  permit: (tool: string, args?: unknown) => Promise<boolean>;
}

/**
 * A request's tool state. `ask` shows the question in the chat window; the questions of parallel calls are asked one
 * after the other, and after "always allow" the next ones are not asked.
 */
export function createToolRun(ask: (tool: string, args?: unknown) => Promise<PermissionChoice>): ToolRun {
  let queue: Promise<unknown> = Promise.resolve();
  const permit = (tool: string, args?: unknown): Promise<boolean> => {
    // "Always allow" for pictures never allows the web, and the other way round: each has its own setting.
    const key = tool === WEB_TOOL ? 'assistantWebAccess' : 'assistantReadAccess';
    const next = queue.then(async () => {
      const access = useSettings.getState()[key];
      if (access === 'always') return true;
      if (access === 'never') return false;
      const choice = await ask(tool, args);
      if (choice === 'always') useSettings.getState().set({ [key]: 'always' });
      return choice !== 'deny';
    });
    queue = next.catch(() => undefined);
    return next;
  };
  return { log: [], editSnapshots: {}, permit };
}

/** What a tool answers: data (or a sentence) for the model, or an error it is told. */
export type ToolResult = { ok: true; content: unknown } | { ok: false; content: string };

const done = (content: unknown): ToolResult => ({ ok: true, content });
const fail = (content: string): ToolResult => ({ ok: false, content });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** What the user is looking at: a tab, or on the Generate tab the kind being made. */
export function currentScreen(): AgentScreen {
  const ui = useUi.getState();
  if (ui.activeTab !== 'generate') return ui.activeTab;
  return ui.media === 'image' ? 'generate' : ui.media;
}

const SNAPSHOT_KEYS = ['modelKey', 'positivePrompt', 'negativePrompt', 'loras', 'steps', 'cfgScale', 'width', 'height', 'aspectRatio', 'scheduler', 'seed', 'shouldRandomizeSeed'] as const;

/** Keeps the settings as they were before the request's first change of them. */
function keepSettings(run: ToolRun) {
  if (run.snapshot) return;
  const p = useParams.getState();
  run.snapshot = Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, p[k]])) as Partial<ParamsFields>;
}

/** Keeps an editor's data as it was before the request's first change of it. */
function keepEditor(run: ToolRun, screen: EditScreen) {
  const editor = agentEditor(screen);
  if (editor && !(screen in run.editSnapshots)) run.editSnapshots[screen] = editor.snapshot();
}

/** Opens the screen a change is made on, so the user sees it happen. */
function show(screen: EditScreen) {
  const ui = useUi.getState();
  if (screen === 'comic' || screen === 'workflows' || screen === 'canvas') {
    if (ui.activeTab !== screen) ui.setTab(screen);
    return;
  }
  if (ui.activeTab !== 'generate') ui.setTab('generate');
  if (useUi.getState().media !== screen) useUi.getState().setMedia(screen as MediaKind);
}

/** Runs an editor's operations: undo snapshot first, the screen opened, the operations checked by the editor. */
function edit(run: ToolRun, screen: EditScreen, ops: unknown[], log: AgentToolLog): ToolResult {
  const editor = agentEditor(screen);
  if (!editor) return fail('This editor is not available.');
  keepEditor(run, screen);
  show(screen);
  const took = editor.apply(ops);
  const skipped = editor.skipped?.() ?? [];
  if (!took) return fail(`None of the operations took effect: check them against the data (ids, numbers, names) and try again.${skipped.length ? ` Left out: ${skipped.join('; ')}` : ''}`);
  run.log.push(log);
  return done({ applied: true, ...(skipped.length ? { skipped } : {}), now: (editor.answer ?? editor.context)() });
}

/** The installed extension packs as the catalog and the extension list see them. */
function installedPacks() {
  return useNodePacks.getState().packs?.installed ?? [];
}

/** A picture's generation info in short, for the model. */
function imageSummary(image: ImageDTO, withMeta: boolean) {
  const m = image.metadata;
  return {
    name: image.name,
    kind: image.mediaType ?? 'image',
    width: image.width,
    height: image.height,
    createdAt: new Date(image.createdAt).toISOString(),
    starred: image.starred,
    ...(m ? { model: m.modelName ?? m.modelKey, prompt: m.positivePrompt?.slice(0, withMeta ? 4000 : 300) } : {}),
  };
}

function metadataOf(m: GenerationMetadata) {
  return {
    mode: m.generationMode,
    positivePrompt: m.positivePrompt,
    negativePrompt: m.negativePrompt,
    model: m.modelName ?? m.modelKey,
    loras: m.loras?.map((l) => ({ key: l.key, weight: l.weight })),
    seed: m.seed,
    steps: m.steps,
    cfgScale: m.cfgScale,
    scheduler: m.scheduler,
    width: m.width,
    height: m.height,
  };
}

/** New queue items that show up within a few seconds (a comic's panels are queued one after the other). */
async function newQueueItems(before: Set<number>): Promise<number[]> {
  let last = -1;
  for (let i = 0; i < 30; i++) {
    const ids = useQueue.getState().items.filter((q) => !before.has(q.id)).map((q) => q.id);
    if (ids.length && ids.length === last) return ids;
    last = ids.length;
    await new Promise((r) => setTimeout(r, 150));
  }
  return useQueue.getState().items.filter((q) => !before.has(q.id)).map((q) => q.id);
}

type Handler = (args: Record<string, unknown>, run: ToolRun) => ToolResult | Promise<ToolResult>;

const FORM_KINDS = ['video', 'music', 'voice'] as const;
type FormKind = (typeof FORM_KINDS)[number];
const formKind = (v: unknown): FormKind | undefined => FORM_KINDS.find((k) => k === v);

const HANDLERS: Record<string, Handler> = {
  get_screen: () => {
    const screen = currentScreen();
    const guide = agentGuide();
    const entry = guide.find((g) => g.id === `tab.${screen}` || g.id === `media.${screen}`);
    return done({ screen, name: entry?.name ?? screen, about: entry?.about ?? '' });
  },

  get_app_guide: () => done(agentGuide()),

  get_manga_guide: (args) => mangaGuide(str(args.topic) || undefined),

  list_models: (args) => {
    const type = str(args.type);
    const p = useParams.getState();
    const models = useModels
      .getState()
      .models.filter((m) => !type || m.type === type)
      .map((m) => ({ key: m.key, name: m.name, base: m.base, type: m.type }));
    return done({ models, selected: { modelKey: p.modelKey, loras: p.loras.map((l) => ({ key: l.key, weight: l.weight })) } });
  },

  select_model: (args, run) => {
    const model = useModels.getState().models.find((m) => m.key === args.key && isDrawable(m));
    if (!model) return fail(`No checkpoint has the key ${String(args.key)}: use a key of type main (or a diffusion_model of Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow or HunyuanImage) from list_models.`);
    keepSettings(run);
    selectAgentModel(model);
    run.log.push({ kind: 'model', key: model.key });
    return done({ selected: model.key, name: model.name, base: model.base });
  },

  add_lora: (args, run) => {
    const lora = useModels.getState().models.find((m) => m.key === args.key && m.type === 'lora');
    if (!lora) return fail(`No LoRA has the key ${String(args.key)}: use a key of type lora from list_models.`);
    const weight = Math.min(2, Math.max(-1, num(args.weight) ?? 0.8));
    keepSettings(run);
    useParams.getState().addLora(lora.key);
    useParams.getState().updateLora(lora.key, { weight });
    run.log.push({ kind: 'lora', key: lora.key, weight });
    return done({ added: lora.key, weight });
  },

  get_generation_settings: (args) => {
    const p = useParams.getState();
    return done({
      modelKey: p.modelKey,
      loras: p.loras.map((l) => ({ key: l.key, weight: l.weight })),
      steps: p.steps,
      cfgScale: p.cfgScale,
      width: p.width,
      height: p.height,
      scheduler: p.scheduler,
      seed: p.seed,
      randomSeed: p.shouldRandomizeSeed,
      schedulers: SCHEDULERS,
      ...(args.includePrompts === true ? { positivePrompt: p.positivePrompt, negativePrompt: p.negativePrompt } : {}),
    });
  },

  set_generation_settings: (args, run) => {
    const scheduler = str(args.scheduler);
    if (scheduler !== undefined && !SCHEDULERS.includes(scheduler as (typeof SCHEDULERS)[number])) return fail(`Unknown scheduler ${scheduler}: one of ${SCHEDULERS.join(', ')}.`);
    const size = (v: unknown) => (num(v) === undefined ? undefined : Math.round(Math.min(4096, Math.max(64, num(v)!)) / 8) * 8);
    const width = size(args.width);
    const height = size(args.height);
    const patch: Partial<ParamsFields> = {
      ...(str(args.positivePrompt) !== undefined ? { positivePrompt: str(args.positivePrompt)! } : {}),
      ...(str(args.negativePrompt) !== undefined ? { negativePrompt: str(args.negativePrompt)! } : {}),
      ...(num(args.steps) !== undefined ? { steps: Math.round(num(args.steps)!) } : {}),
      ...(num(args.cfgScale) !== undefined ? { cfgScale: num(args.cfgScale)! } : {}),
      ...(scheduler !== undefined ? { scheduler: scheduler as ParamsFields['scheduler'] } : {}),
      ...(num(args.seed) !== undefined ? { seed: Math.round(num(args.seed)!), shouldRandomizeSeed: false } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(width !== undefined || height !== undefined ? { aspectRatio: 'free' as const } : {}),
    };
    if (!Object.keys(patch).length) return fail('Nothing to set.');
    keepSettings(run);
    useParams.getState().set(patch);
    if ('positivePrompt' in patch || 'negativePrompt' in patch) run.log.push({ kind: 'prompt' });
    const parts = [
      width !== undefined || height !== undefined ? `${useParams.getState().width}×${useParams.getState().height}` : '',
      patch.steps !== undefined ? `${patch.steps} steps` : '',
      patch.cfgScale !== undefined ? `CFG ${patch.cfgScale}` : '',
      patch.scheduler ?? '',
      patch.seed !== undefined ? `seed ${patch.seed}` : '',
    ].filter(Boolean);
    if (parts.length) run.log.push({ kind: 'params', summary: parts.join(' / ') });
    return done({ set: Object.keys(patch) });
  },

  generate: async (args, run) => {
    if (args.target === 'comic') {
      const editor = agentEditor('comic');
      if (!editor) return fail('The comic is not available.');
      const scope = str(args.scope) ?? 'page';
      if (scope === 'panel' && num(args.panel) === undefined) return fail('scope panel needs panel.');
      const before = new Set(useQueue.getState().items.map((q) => q.id));
      show('comic');
      if (!editor.apply([{ op: 'draw', scope, ...(num(args.panel) !== undefined ? { panel: num(args.panel) } : {}) }])) {
        return fail('Nothing was queued: no comic is open, no panel in that scope has a prompt, or no model is chosen on the Generate tab.');
      }
      const ids = await newQueueItems(before);
      run.log.push({ kind: 'queued', count: ids.length });
      return done({ queued: ids, note: 'The panels with a prompt were queued; get_queue_status tells their progress.' });
    }
    const outcome = await enqueueActive();
    if ('problems' in outcome) return fail(`Nothing was queued: ${outcome.problems.join(' ')}`);
    if ('error' in outcome) return fail(`Queuing failed: ${outcome.error}`);
    run.log.push({ kind: 'queued', count: outcome.items.length });
    return done({ queued: outcome.items.map((i) => i.id) });
  },

  get_queue_status: (args) => {
    const ids = Array.isArray(args.ids) ? new Set(args.ids.filter((x): x is number => typeof x === 'number')) : null;
    const items = useQueue.getState().items;
    const picked = ids ? items.filter((i) => ids.has(i.id)) : items.slice(-20);
    return done(picked.map((i) => ({ id: i.id, status: i.status, ...(i.error ? { error: i.error.slice(0, 300) } : {}), ...(i.imageName ? { picture: i.imageName } : {}) })));
  },

  get_comic_page: () => {
    const editor = agentEditor('comic');
    if (!editor) return fail('The comic is not available.');
    return done(editor.context());
  },

  // A drawn page as a picture: only on the comic screen; the backend reads the picture by its name.
  view_comic_page: async (args) => {
    const ui = useUi.getState();
    if (ui.activeTab !== 'comic') {
      return fail('Pages can be looked at only while the comic screen is open. Ask the user to open it (the book in the side bar), then try again.');
    }
    const editor = agentEditor('comic');
    const page = num(args.page);
    if (!editor?.view || page === undefined) return fail('The comic is not available.');
    try {
      return done({ page, picture: await editor.view(page) });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },

  edit_comic: (args, run) => edit(run, 'comic', args.ops as unknown[], { kind: 'editComic', count: (args.ops as unknown[]).length }),

  get_text_scene: () => {
    const editor = agentEditor('text');
    return editor ? done(editor.context()) : fail('The text editor is not available.');
  },

  edit_text: (args, run) => edit(run, 'text', args.ops as unknown[], { kind: 'editText', count: (args.ops as unknown[]).length }),

  get_workflow: () => {
    const editor = agentEditor('workflows');
    const installed = agentPacks(installedPacks())
      .filter((p) => p.installed)
      .map((p) => p.id);
    return done({ graph: editor?.context() ?? null, nodeTypes: agentWorkflow.nodeTypes(), recipes: agentWorkflow.recipes(installed) });
  },

  search_comfy_nodes: (args) => done(agentWorkflow.searchNodes(str(args.query) ?? '', num(args.limit) ?? 8)),

  edit_workflow: (args, run) => edit(run, 'workflows', args.ops as unknown[], { kind: 'editWorkflow', count: (args.ops as unknown[]).length }),

  create_workflow: (args, run) => {
    const name = str(args.name) ?? '';
    keepEditor(run, 'workflows');
    const opened = agentWorkflow.open(name, args.graph);
    if (opened.error) return fail(opened.error);
    show('workflows');
    run.log.push({ kind: 'workflow', key: name });
    return done({ opened: name, ...(opened.dropped.length ? { dropped: opened.dropped } : {}), now: agentEditor('workflows')?.context() ?? null });
  },

  get_form: (args) => {
    const kind = formKind(args.kind);
    const editor = kind && agentEditor(kind);
    return editor ? done(editor.context()) : fail('This form is not available.');
  },

  set_form: (args, run) => {
    const kind = formKind(args.kind);
    if (!kind || !isRecord(args.fields)) return fail('set_form needs kind and fields.');
    return edit(run, kind, [args.fields], { kind, count: Object.keys(args.fields).length });
  },

  get_pose: () => {
    const editor = agentEditor('canvas');
    return editor ? done(editor.context()) : fail('The canvas is not available.');
  },

  set_pose: (args, run) => {
    const people = Array.isArray(args.people) ? args.people : [];
    return edit(run, 'canvas', [{ people, add: args.add === true }], { kind: 'pose', count: people.length });
  },

  list_gallery_images: (args) => {
    const limit = Math.min(50, Math.max(1, num(args.limit) ?? 20));
    const offset = Math.max(0, num(args.offset) ?? 0);
    const search = (str(args.search) ?? '').toLowerCase();
    const images = useGallery
      .getState()
      .images.filter((i) => !i.isIntermediate && (args.starredOnly !== true || i.starred) && (!search || (i.metadata?.positivePrompt ?? '').toLowerCase().includes(search)))
      .sort((a, b) => b.createdAt - a.createdAt);
    return done({ total: images.length, images: images.slice(offset, offset + limit).map((i) => imageSummary(i, false)) });
  },

  get_image_info: (args) => {
    const image = useGallery.getState().images.find((i) => i.name === args.name && !i.isIntermediate);
    if (!image) return fail(`No picture is named ${String(args.name)}: use a name from list_gallery_images.`);
    return done({ ...imageSummary(image, true), ...(image.metadata ? { generation: metadataOf(image.metadata) } : {}) });
  },

  search_extensions: async (args) => {
    const query = str(args.query) ?? '';
    const ids = Array.isArray(args.ids) ? args.ids.filter((x): x is string => typeof x === 'string') : [];
    // A query that names something is searched in the whole registry: read it now if the manager has not (it is kept for the manager too).
    if (!useRegistry.getState().nodes && questionWords(query).length) await useRegistry.getState().load();
    const installed = installedPacks();
    const items = buildItems(installed, useRegistry.getState().nodes ?? []);
    const focus = ids.map((id) => folderOfExtensionId(id) ?? id);
    const { extensions } = agentExtensions(query, focus, items, extensionNodes);
    const words = questionWords(query);
    const packs = agentPacks(installed).filter((p) => !words.length || words.some((w) => `${p.id} ${p.name} ${p.about} ${p.goals.join(' ')}`.toLowerCase().includes(w)));
    return done({ packs: packs.length ? packs : agentPacks(installed), extensions });
  },

  lookup_reference: async (args) => {
    const query = str(args.query)?.trim();
    if (!query) return fail('lookup_reference needs a query.');
    const language = args.language === 'en' ? 'en' : 'ja';
    const results = await backend.lookupReference(language, query);
    return done(
      results.length
        ? { language, results, license: 'Wikipedia text, CC BY-SA 4.0. When you use a fact from it, say in your answer which article it is from (title and url).' }
        : { language, results, note: 'No article matched. Try one other short word, or go on without it.' },
    );
  },

  recommend_packs: (args, run) => {
    const installed = installedPacks();
    const catalog = new Set(agentPacks(installed).map((p) => p.id));
    const known = new Set(buildItems(installed, useRegistry.getState().nodes ?? []).map((i) => extensionId(i.folder)));
    const asked = Array.isArray(args.ids) ? args.ids.filter((x): x is string => typeof x === 'string') : [];
    const ids = [...new Set(asked.filter((id) => catalog.has(id) || known.has(id)))].slice(0, 4);
    if (!ids.length) return fail('None of these ids is a known extension: use ids from search_extensions.');
    run.log.push({ kind: 'packs', ids });
    return done({ shown: ids, ...(ids.length < asked.length ? { unknown: asked.filter((id) => !ids.includes(id)) } : {}) });
  },
};

/** The tools this dispatcher runs (the backend's list must match; see agentTools.test.ts). */
export const TOOL_NAMES = Object.keys(HANDLERS);

/** Runs one tool call: the permission check for reads, the tool, and an answer bounded in size. */
export async function runAgentTool(call: AgentToolCall, run: ToolRun): Promise<ToolResult> {
  const handler = HANDLERS[call.tool];
  if (!handler) return fail(`The app does not know the tool ${call.tool}.`);
  if ((call.readGated || isReadGated(call.tool, call.args)) && !(await run.permit(call.tool, call.args))) return fail(declinedFor(call.tool));
  try {
    const result = await handler(isRecord(call.args) ? call.args : {}, run);
    const size = typeof result.content === 'string' ? result.content.length : (JSON.stringify(result.content) ?? '').length;
    return size > MAX_ANSWER_CHARS ? fail('The result was too large to pass on. Ask for less (a smaller page, fewer items).') : result;
  } catch (err) {
    return fail(`The tool failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
