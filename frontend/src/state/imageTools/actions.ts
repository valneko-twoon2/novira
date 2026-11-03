// What the picture menu, the viewer toolbar and the other entry points do with a picture tool: run it at once with
// its last settings, or open the tool band on its settings.
import { useComfyNodes } from '../comfy/comfyNodes';
import { useNodePacks } from '../comfy/nodePacks';
import { useModels } from '../models';
import { toolViewer, useToolBand } from './band';
import { toolReadiness } from './readiness';
import { startToolRun } from './runs';
import type { ImageToolId } from './tools';

/** Reads ComfyUI's nodes (and the installed packs) unless they are known, and waits until they are. */
export async function loadToolNodes(): Promise<void> {
  void useNodePacks.getState().load();
  await useComfyNodes.getState().load();
  if (useComfyNodes.getState().status !== 'loading') return;
  await new Promise<void>((resolve) => {
    const off = useComfyNodes.subscribe((s) => {
      if (s.status === 'loading') return;
      off();
      resolve();
    });
  });
}

/**
 * Runs the tool on the picture with its last settings and shows the band on the run. When the tool is not ready (a
 * pack is missing), the band shows why and what to install instead.
 */
export async function quickRunTool(tool: ImageToolId, imageName: string): Promise<void> {
  toolViewer().showPicture(imageName);
  useToolBand.getState().show(tool, imageName, 'status');
  await loadToolNodes();
  const nodes = useComfyNodes.getState();
  if (toolReadiness(tool, { defs: nodes.defs, status: nodes.status, models: useModels.getState().models }).state !== 'ready') {
    useToolBand.getState().setMode('settings');
    return;
  }
  await startToolRun(tool, imageName);
}

/** Opens the band on the tool's settings for the picture; `show` also brings the picture into the viewer. */
export function openToolSettings(tool: ImageToolId, imageName: string, { show = true }: { show?: boolean } = {}): void {
  if (show) toolViewer().showPicture(imageName);
  useToolBand.getState().show(tool, imageName, 'settings');
  void loadToolNodes();
}

/** The viewer toolbar's button: opens the band on the tool, or closes it when it already shows that tool. */
export function toggleToolBand(tool: ImageToolId, imageName: string): void {
  const band = useToolBand.getState();
  if (band.open && band.tool === tool) band.close();
  else openToolSettings(tool, imageName, { show: false });
}
