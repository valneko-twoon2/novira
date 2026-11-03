// The screen words of each picture tool, by key (`t()` is called where they are shown, never at load time).
import type { MessageKey } from '@/i18n';
import type { ImageToolId } from './tools';

export interface ToolText {
  /** The short name on the band's switch and in notices. */
  name: MessageKey;
  /** The item of the picture menu and the viewer toolbar. */
  menu: MessageKey;
  running: MessageKey;
  /** Said while it runs: the first run fetches the model it needs. */
  firstRun: MessageKey;
  failed: MessageKey;
}

export const TOOL_TEXT: Record<ImageToolId, ToolText> = {
  facefix: { name: 'gallery.tools.name.facefix', menu: 'facefix.menu', running: 'facefix.running', firstRun: 'facefix.firstRun', failed: 'facefix.failed' },
  cutout: { name: 'gallery.tools.name.cutout', menu: 'cutout.menu', running: 'cutout.running', firstRun: 'cutout.firstRun', failed: 'cutout.failed' },
  caption: { name: 'gallery.tools.name.caption', menu: 'caption.menu', running: 'caption.running', firstRun: 'caption.firstRun', failed: 'caption.failed' },
  pose: { name: 'gallery.tools.name.pose', menu: 'canvas.poseFromImage.menu', running: 'canvas.poseFromImage.running', firstRun: 'canvas.poseFromImage.firstRun', failed: 'canvas.poseFromImage.failed' },
};
