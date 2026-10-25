// Imperative image actions shared by the gallery menus, hotkeys and the viewer toolbar.
import { backend, canOpenNewWindow, openInNewWindow, type ImageDTO } from '@/backend';
import { t, tCount } from '@/i18n';
import { useCanvas, type CanvasImportTarget } from '@/state/canvas';
import { useGallery, type BoardId } from '@/state/gallery';
import { defaultRefModelKey } from '@/state/models';
import { useVideo } from '@/state/media/video';
import { useParams } from '@/state/params';
import { recalledModelNote, type RecalledModel } from '@/state/recallModel';
import { useTextEditor } from '@/state/text/textEditor';
import { toast } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { writeClipboardText } from '@/ui';

export function boardName(id: BoardId): string {
  if (id === 'none') return t('gallery.boards.uncategorized');
  return useGallery.getState().boards.find((b) => b.id === id)?.name ?? t('gallery.boards.uncategorized');
}

export async function moveImagesToBoard(names: string[], boardId: BoardId) {
  if (!names.length) return;
  const updated = await backend.updateImages(names, { boardId: boardId === 'none' ? null : boardId });
  useGallery.getState().upsertImages(updated);
  toast({ status: 'success', title: tCount('gallery.toast.moved', updated.length, { board: boardName(boardId) }) });
}

export async function setStarred(names: string[], starred: boolean) {
  if (!names.length) return;
  const updated = await backend.updateImages(names, { starred });
  useGallery.getState().upsertImages(updated);
}

export async function deleteImagesNow(names: string[]) {
  if (!names.length) return;
  await backend.deleteImages(names);
  useGallery.getState().removeImages(names);
  toast({ status: 'success', title: tCount('gallery.toast.deleted', names.length) });
}

export function downloadImages(images: ImageDTO[]) {
  for (const image of images) {
    const a = document.createElement('a');
    a.href = image.url;
    a.download = image.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

/** Opening a picture in a new tab is a browser feature; the desktop app hides it. */
export const canOpenInNewTab = canOpenNewWindow;

export function openInNewTab(image: ImageDTO) {
  openInNewWindow(image.url);
}

function toPngBlob(url: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')?.drawImage(img, 0, 0);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    };
    if (/^https?:/.test(url)) img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

export async function copyImage(image: ImageDTO) {
  const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clip || typeof ClipboardItem === 'undefined') {
    toast({ status: 'warning', title: t('gallery.toast.copyUnavailable') });
    return;
  }
  try {
    const blob = await toPngBlob(image.url);
    await clip.write([new ClipboardItem({ 'image/png': blob })]);
    toast({ status: 'success', title: t('gallery.toast.copied') });
  } catch {
    toast({ status: 'error', title: t('gallery.toast.copyFailed') });
  }
}

export async function copyText(text: string) {
  try {
    await writeClipboardText(text);
    toast({ status: 'success', title: t('gallery.toast.copiedText') });
  } catch {
    toast({ status: 'error', title: t('gallery.toast.copyFailed') });
  }
}

export function sendToCanvas(image: ImageDTO, target: CanvasImportTarget) {
  useCanvas.getState().importImage(image, target);
  const ui = useUi.getState();
  ui.setTab('canvas');
  ui.setMainView('canvas', 'canvas');
  toast({ status: 'success', title: t('gallery.toast.sentToCanvas') });
}

export function addAsReference(image: ImageDTO) {
  const p = useParams.getState();
  p.addRefImage({ imageName: image.name, imageUrl: image.url, modelKey: defaultRefModelKey(p.modelKey) });
  toast({ status: 'success', title: t('gallery.toast.refAdded') });
}

/** Makes the picture the first frame of an image-to-video clip and opens the video form. */
export function sendToVideo(image: ImageDTO) {
  useVideo.getState().setForm({ mode: 'image', sourceImageName: image.name });
  openGenerateMedia('video');
  toast({ status: 'success', title: t('gallery.toast.sentToVideo') });
}

/** Puts the picture behind the logo / speech-bubble editor's text, at the picture's size. */
export function sendToText(image: ImageDTO) {
  useTextEditor.getState().setBackground({ kind: 'image', imageName: image.name }, { width: image.width, height: image.height });
  openGenerateMedia('text');
  toast({ status: 'success', title: t('gallery.toast.sentToText') });
}

/** Adds the picture as an image input node of the workflow being edited. */
export function sendToWorkflow(image: ImageDTO) {
  useWorkflows.getState().addImageInput(image);
}

function openGenerateMedia(media: 'video' | 'text') {
  const ui = useUi.getState();
  if (ui.activeTab !== 'generate') ui.setTab('generate');
  ui.setMedia(media);
}

export function sendToUpscale(image: ImageDTO) {
  useParams.getState().setUpscale({ initialImage: image });
  useUi.getState().setTab('upscaling');
  toast({ status: 'success', title: t('gallery.toast.sentToUpscale') });
}

/** Whether the image can be opened as a workflow: it was made by one, or it is a plain generation whose settings fit a graph. */
export function canLoadImageWorkflow(image: ImageDTO): boolean {
  return Boolean(image.workflow) || useWorkflows.getState().canLoadImage(image);
}

export function loadImageWorkflow(image: ImageDTO) {
  if (!image.workflow) {
    // A plain generation: build the graph from its settings (it reports what it opened).
    if (useWorkflows.getState().canLoadImage(image)) useWorkflows.getState().loadImage(image);
    return;
  }
  useWorkflows.getState().loadWorkflow(image.workflow, image.metadata?.workflowName ?? image.name);
  useUi.getState().setTab('workflows');
  toast({ status: 'success', title: t('gallery.toast.workflowLoaded') });
}

export type RecallKind = 'remix' | 'prompt' | 'seed' | 'all' | 'size';

/** Recall parameters from an image's metadata into the generation settings. */
export function recall(image: ImageDTO, kind: RecallKind) {
  const m = image.metadata;
  const p = useParams.getState();
  if (kind === 'size') {
    p.recallSize(image.width, image.height);
    toast({ status: 'info', title: t('gallery.toast.recalledSize') });
    return;
  }
  if (!m) {
    toast({ status: 'warning', title: t('gallery.toast.noMetadata') });
    return;
  }
  let model: RecalledModel | undefined;
  if (kind === 'remix') model = p.remix(m);
  else if (kind === 'prompt') p.recallPrompts(m);
  else if (kind === 'seed') p.recallSeed(m.seed);
  else model = p.recallAll(m);
  const key = {
    remix: 'gallery.toast.recalledRemix',
    prompt: 'gallery.toast.recalledPrompt',
    seed: 'gallery.toast.recalledSeed',
    all: 'gallery.toast.recalledAll',
  } as const;
  // A picture made elsewhere may name a model this app has under another name, or not at all: say what became of it.
  const note = recalledModelNote(model);
  toast({ status: note?.status ?? 'info', title: t(key[kind]), ...(note ? { description: note.description } : {}) });
}

export async function uploadFiles(files: File[]) {
  const g = useGallery.getState();
  const boardId = g.autoAddBoardId === 'none' ? null : g.autoAddBoardId;
  const uploaded: ImageDTO[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    uploaded.push(await backend.uploadImage(file, { boardId }));
  }
  if (!uploaded.length) return;
  uploaded.forEach((i) => useGallery.getState().addImage(i));
  useGallery.setState({ selectedBoardId: boardId ?? 'none', view: 'assets', page: 0 });
  useGallery.getState().setSelection([uploaded[uploaded.length - 1]!.name]);
  toast({ status: 'success', title: tCount('gallery.toast.uploaded', uploaded.length) });
}
