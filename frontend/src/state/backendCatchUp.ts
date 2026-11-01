// A page over the network (a phone, a browser on the PC) can sleep, and its event socket can drop: the events it missed
// meanwhile (`boards_changed`, `images_changed`, `models_changed`, `workflows_changed`) are lost. When such a page comes
// back on screen, or its socket opens again (it says so with `queue_cleared`), it reads what the backend keeps again and
// takes it as those events would have. The desktop app's window hears every event, so it does not need this.
import { backend, type BoardDTO, type ImageDTO, type ModelConfig, type SavedWorkflow } from '@/backend';
import { useGallery } from './gallery';
import { useModels } from './models';
import { useWorkflows } from './workflows/workflows';

/** Takes the backend's boards, pictures, models and workflows. `known` are the pictures the page had when it asked. */
export function applyCatchUp(data: { boards: BoardDTO[]; images: ImageDTO[]; models: ModelConfig[]; workflows: SavedWorkflow[] }, known: ReadonlySet<string>): void {
  const gallery = useGallery.getState();
  gallery.syncBoards(data.boards);
  // A picture that arrived while the backend was being read is not in its answer, and stays.
  const there = new Set(data.images.map((i) => i.name));
  const removed = [...known].filter((name) => !there.has(name));
  gallery.applyImageChanges(data.images, removed);
  useModels.getState().syncModels(data.models);
  useWorkflows.getState().setLibrary(data.workflows);
}

let reading: Promise<void> | null = null;
let again = false;

/** Reads the backend once at a time; a call while a read runs makes one more read after it. */
export function catchUp(): Promise<void> {
  if (reading) {
    again = true;
    return reading;
  }
  reading = (async () => {
    do {
      again = false;
      const known = new Set(useGallery.getState().images.map((i) => i.name));
      try {
        applyCatchUp(await backend.bootstrap(), known);
      } catch (e) {
        console.error('novira: what the backend keeps could not be read again', e);
      }
    } while (again);
  })().finally(() => {
    reading = null;
  });
  return reading;
}

/** Starts catching up on a page over the network; returns how to stop. */
export function watchForMissedEvents(): () => void {
  if (backend.kind !== 'http') return () => undefined;
  const unsubscribe = backend.subscribe((event) => {
    if (event.type === 'queue_cleared') void catchUp();
  });
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void catchUp();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
