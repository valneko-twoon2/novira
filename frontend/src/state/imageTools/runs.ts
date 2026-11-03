// The runs of the picture tools. A run is a queue job that belongs to no screen: closing the tool band, switching
// screens or picking another picture leaves it running (the model a first run downloads inside the job included), and
// only `cancelToolRun` cancels it. A picture result is saved to the gallery by the job; when the band still shows the
// tool on that picture, the viewer compares the result with the original.
import { create } from 'zustand';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { appendToPrompt, tidyCaption } from '../comfy/caption';
import { useComfyNodes } from '../comfy/comfyNodes';
import { parsePoseExtract, type ExtractedPoses } from '../comfy/poseExtract';
import { runJob, runTextJob } from '../comfy/runGraph';
import { devLog } from '../devLog';
import { findImage } from '../gallery';
import { useModels } from '../models';
import { useParams } from '../params';
import { useQueue } from '../queue';
import { toast } from '../toasts';
import { toolViewer, useToolBand } from './band';
import { buildToolJob } from './request';
import { useImageToolSettings } from './settings';
import { TOOL_TEXT } from './text';
import type { ImageToolId, UsedSettings } from './tools';

export type ToolResult = { kind: 'picture'; image: ImageDTO } | { kind: 'text'; text: string } | { kind: 'poses'; poses: ExtractedPoses };

export interface ToolRun {
  id: number;
  tool: ImageToolId;
  imageName: string;
  used: UsedSettings;
  status: 'running' | 'done' | 'failed' | 'canceled';
  /** The queue item, once the job is queued (its progress is the queue's). */
  queueItemId: number | null;
  result: ToolResult | null;
  error: string | null;
}

interface ToolRunsState {
  /** The last run of each tool. An earlier run still finishes (and saves its picture) but is no longer shown. */
  runs: Partial<Record<ImageToolId, ToolRun>>;
}

export const useToolRuns = create<ToolRunsState>()(() => ({ runs: {} }));

let nextId = 1;
const controllers = new Map<number, AbortController>();

/** Changes a run, unless a newer run of its tool has taken its place. */
function patchRun(tool: ImageToolId, id: number, patch: Partial<ToolRun>) {
  useToolRuns.setState((s) => {
    const run = s.runs[tool];
    return run?.id === id ? { runs: { ...s.runs, [tool]: { ...run, ...patch } } } : s;
  });
}

/** Whether the band shows this tool on this picture now. */
function bandShows(tool: ImageToolId, imageName: string): boolean {
  const band = useToolBand.getState();
  return band.open && band.tool === tool && band.imageName === imageName;
}

const SAVED = { facefix: 'facefix.saved', cutout: 'cutout.saved' } as const;

/** Tells the user what came of a run: a picture shows beside its original, and what the band does not show becomes a notice. */
function announce(run: ToolRun) {
  const shown = bandShows(run.tool, run.imageName);
  if (run.status === 'failed') {
    if (!shown) toast({ status: 'error', title: t(TOOL_TEXT[run.tool].failed), description: run.error ?? undefined });
    return;
  }
  if (run.status !== 'done' || !run.result) return;
  if (run.result.kind === 'picture') {
    if (shown) toolViewer().showResult(run.result.image.name, run.imageName);
    if (run.tool === 'facefix' || run.tool === 'cutout') toast({ status: 'success', title: t(SAVED[run.tool]) });
  } else if (!shown) {
    toast({ status: 'success', title: t('gallery.tools.finished', { tool: t(TOOL_TEXT[run.tool].name) }) });
  }
}

/**
 * Runs `tool` on a gallery picture with its stored settings (and, for the face fix, what the band changed of the
 * picture's model and prompt). Resolves when the run has ended, whichever way.
 */
export async function startToolRun(tool: ImageToolId, imageName: string): Promise<void> {
  const image = findImage(imageName);
  if (!image) return;
  const nodes = useComfyNodes.getState();
  const band = useToolBand.getState();
  const face = band.imageName === imageName ? band.face : { modelKey: null, prompt: null };
  const id = nextId++;
  let job;
  try {
    job = buildToolJob(tool, image, useImageToolSettings.getState().values, { defs: nodes.defs, status: nodes.status, models: useModels.getState().models }, face, useParams.getState().modelKey);
  } catch (e) {
    // The band and the menu check readiness first, so this is a slip of the app: logged, not shown.
    devLog('error', 'image tools', `${tool} could not start: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  const controller = new AbortController();
  controllers.set(id, controller);
  const start: ToolRun = { id, tool, imageName, used: job.used, status: 'running', queueItemId: null, result: null, error: null };
  useToolRuns.setState((s) => ({ runs: { ...s.runs, [tool]: start } }));
  const queued = (queueItemId: number) => patchRun(tool, id, { queueItemId });
  let ended: Partial<ToolRun>;
  try {
    if (job.makes === 'picture') {
      ended = { status: 'done', result: { kind: 'picture', image: await runJob(job.request, controller.signal, queued) } };
    } else {
      const text = await runTextJob(job.request, controller.signal, queued);
      if (tool === 'pose') {
        const poses = parsePoseExtract(text);
        if (!poses) throw new Error(text.slice(0, 200) || 'empty answer');
        ended = { status: 'done', result: { kind: 'poses', poses } };
      } else {
        ended = { status: 'done', result: { kind: 'text', text: tidyCaption(text, job.used.tool === 'caption' ? job.used.style : 'tags') } };
      }
    }
  } catch (e) {
    ended = controller.signal.aborted || (e instanceof DOMException && e.name === 'AbortError') ? { status: 'canceled' } : { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  } finally {
    controllers.delete(id);
  }
  patchRun(tool, id, ended);
  const run = useToolRuns.getState().runs[tool];
  if (run?.id === id) announce(run);
}

/**
 * Whether a picture is the result of a tool's last run. It is known from the queue item as soon as the job completes,
 * before the run itself has its result: the gallery may show the new picture in between.
 */
export function madeByToolRun(name: string): boolean {
  const items = useQueue.getState().items;
  return Object.values(useToolRuns.getState().runs).some(
    (run) => !!run && ((run.result?.kind === 'picture' && run.result.image.name === name) || (run.queueItemId !== null && items.find((i) => i.id === run.queueItemId)?.imageName === name)),
  );
}

/** Cancels the running job of a tool (the queue item is cancelled; nothing else is). */
export function cancelToolRun(tool: ImageToolId): void {
  const run = useToolRuns.getState().runs[tool];
  if (run?.status === 'running') controllers.get(run.id)?.abort();
}

/** Puts a description into the positive prompt, in place of it or after it. */
export function applyDescription(text: string, how: 'replace' | 'append'): void {
  const params = useParams.getState();
  params.set({ positivePrompt: how === 'replace' ? text.trim() : appendToPrompt(params.positivePrompt, text) });
  toast({ status: 'success', title: how === 'replace' ? t('caption.replaced') : t('caption.appended') });
}
