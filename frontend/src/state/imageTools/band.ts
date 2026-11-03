// The tool band of the viewer: whether it is open, on which tool and picture, and whether it shows the tool's
// settings or its last run. Closing it changes nothing else: a running job goes on (see runs.ts).
import { create } from 'zustand';
import { useGallery } from '../gallery';
import { showViewer } from '../ui';
import { NO_FACE_OVERRIDES, type FaceOverrides, type ImageToolId } from './tools';

/** `settings` shows what can be chosen and the Run button; `status` the last run (running, its result, its failure). */
export type BandMode = 'settings' | 'status';

interface ToolBandState {
  open: boolean;
  tool: ImageToolId;
  /** The picture the tool runs on (the original while its result is compared with it). */
  imageName: string | null;
  mode: BandMode;
  /** What the face fix takes from this picture unless changed here; cleared when the picture changes. */
  face: FaceOverrides;
  show: (tool: ImageToolId, imageName: string, mode: BandMode) => void;
  /** Another tool on the same picture: its last run when it has one, else its settings (the band decides). */
  setTool: (tool: ImageToolId) => void;
  setMode: (mode: BandMode) => void;
  /** The viewer moved to another picture: the band follows it. */
  retarget: (imageName: string) => void;
  setFace: (patch: Partial<FaceOverrides>) => void;
  close: () => void;
}

export const useToolBand = create<ToolBandState>()((set, get) => ({
  open: false,
  tool: 'facefix',
  imageName: null,
  mode: 'settings',
  face: NO_FACE_OVERRIDES,
  show: (tool, imageName, mode) => set({ open: true, tool, imageName, mode, ...(get().imageName === imageName ? {} : { face: NO_FACE_OVERRIDES }) }),
  setTool: (tool) => set({ tool, mode: 'status' }),
  setMode: (mode) => set({ mode }),
  retarget: (imageName) => {
    if (get().imageName !== imageName) set({ imageName, mode: 'status', face: NO_FACE_OVERRIDES });
  },
  setFace: (patch) => set({ face: { ...get().face, ...patch } }),
  close: () => set({ open: false }),
}));

/** How the layout shows a picture for a tool and a result beside its original. The desktop viewer unless the phone layout says otherwise. */
export interface ToolViewer {
  showPicture: (name: string) => void;
  showResult: (result: string, source: string) => void;
}

const desktopViewer: ToolViewer = {
  showPicture: (name) => {
    const gallery = useGallery.getState();
    gallery.setSelection([name]);
    gallery.setCompareImage(null);
    showViewer();
  },
  // The viewer's compare view: the result first, the original as the one compared with.
  showResult: (result, source) => {
    const gallery = useGallery.getState();
    gallery.setSelection([result]);
    gallery.setCompareImage(source);
    showViewer();
  },
};

let viewer: ToolViewer = desktopViewer;

/** The phone layout shows pictures its own way while it is mounted; null goes back to the desktop viewer. */
export function setToolViewer(next: ToolViewer | null): void {
  viewer = next ?? desktopViewer;
}

export function toolViewer(): ToolViewer {
  return viewer;
}
