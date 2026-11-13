// Imperative image actions shared by the gallery menus, hotkeys and the viewer toolbar.
import { backend, canOpenNewWindow, openInNewWindow, readImageBlob, type ImageDTO } from '@/backend';
import { t, tCount } from '@/i18n';
import { useCanvas, type CanvasImportTarget } from '@/state/canvas';
import { boardLabel } from '@/state/boardTree';
import { useGallery, type BoardId } from '@/state/gallery';
import { recordDeletion, undoDeletion } from '@/state/galleryUndo';
import { describeError, devLog } from '@/state/devLog';
import { keepMarks } from '@/state/pictureMarks';
import { defaultRefModelKey } from '@/state/models';
import { useVideo } from '@/state/media/video';
import { useParams } from '@/state/params';
import { recalledModelNote, type RecalledModel } from '@/state/recallModel';
import { useTextEditor } from '@/state/text/textEditor';
import { useTextSources } from '@/state/text/textSources';
import { toast } from '@/state/toasts';
import { useBatch } from '@/state/dialogs/batch';
import { isScreenShown, useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { canWriteClipboardImage, writeClipboardImage, writeClipboardText } from '@/ui';

export function boardName(id: BoardId): string {
  if (id === 'none') return t('gallery.boards.uncategorized');
  const { boards } = useGallery.getState();
  const board = boards.find((b) => b.id === id);
  return board ? boardLabel(boards, board) : t('gallery.boards.uncategorized');
}

export async function moveImagesToBoard(names: string[], boardId: BoardId) {
  if (!names.length) return;
  // A picture held in the Candidates view (hidden from the boards) is accepted by moving it to one.
  const updated = await backend.updateImages(names, { boardId: boardId === 'none' ? null : boardId, isIntermediate: false });
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
  // Drawn before the files go to the trash, where their addresses no longer serve them.
  const wanted = new Set(names);
  const marks = keepMarks(useGallery.getState().images.filter((i) => wanted.has(i.name)));
  await backend.deleteImages(names);
  useGallery.getState().removeImages(names);
  recordDeletion(names);
  toast({ status: 'success', quiet: true, title: tCount('gallery.toast.deleted', names.length), pictures: await marks, actions: [{ label: t('gallery.undoDelete.action'), run: () => void undoDeletion(names) }] });
}

/**
 * Saves the originals as they are. The desktop app asks for a folder (a link to the picture would open it in place of
 * the app, which has no way back) and then says where they went; a browser downloads them.
 */
export async function downloadImages(images: ImageDTO[]) {
  if (!images.length) return;
  try {
    const result = await backend.saveImages(images.map((i) => i.name));
    if (!result?.folder) return;
    toast({
      status: 'success',
      title: tCount('gallery.toast.saved', result.count),
      description: t('share.doneIn', { folder: result.folder }),
      actions: [{ label: t('share.openFolder'), run: () => void backend.revealExportFolder().catch(() => undefined) }],
    });
  } catch (e) {
    toast({ status: 'error', title: t('gallery.toast.saveFailed'), description: e instanceof Error ? e.message : String(e) });
  }
}

/** Opening a picture in a new tab is a browser feature; the desktop app hides it. */
export const canOpenInNewTab = canOpenNewWindow;

export function openInNewTab(image: ImageDTO) {
  openInNewWindow(image.url);
}

const PNG = 'image/png';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function isPng(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  return PNG_SIGNATURE.every((b, i) => head[i] === b);
}

/** Re-encodes any picture the browser can decode as a PNG, off the page's main thread where the browser allows it. */
async function convertToPng(source: Blob): Promise<Blob> {
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(source);
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
        return await canvas.convertToBlob({ type: PNG });
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall back to a canvas on the page.
    }
  }
  const url = URL.createObjectURL(source);
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')?.drawImage(img, 0, 0);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), PNG);
      };
      img.onerror = () => reject(new Error('image load failed'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The picture as a PNG. Stored pictures already are PNG (the backend converts every import), so their bytes are used as
 * they are; anything else is converted.
 */
async function pngOf(url: string): Promise<Blob> {
  const blob = await readImageBlob(url);
  if (await isPng(blob)) return blob.type === PNG ? blob : new Blob([blob], { type: PNG });
  return convertToPng(blob);
}

export async function copyImage(image: ImageDTO) {
  // Only a still picture goes on the clipboard as a picture; a video or a sound has no PNG to give (Ctrl+C on one does nothing).
  if ((image.mediaType ?? 'image') !== 'image') return;
  if (!canWriteClipboardImage()) {
    toast({ status: 'warning', title: t('gallery.toast.copyUnavailable') });
    return;
  }
  try {
    // Asked for before the picture is read, inside the user's key press or click (see `writeClipboardImage`).
    await writeClipboardImage(pngOf(image.url));
    toast({ status: 'success', title: t('gallery.toast.copied') });
  } catch (e) {
    devLog('error', 'gallery', `copying ${image.name} to the clipboard failed: ${describeError(e)}`);
    toast({ status: 'error', title: t('gallery.toast.copyFailed'), description: e instanceof Error ? e.message : String(e) });
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

/** Opens the layers a picture saved from the Text tab was made from (one undo step), on the Text screen. False when its scene is gone. */
export function editInText(image: ImageDTO): boolean {
  const scene = useTextSources.getState().sceneOf(image.name);
  if (!scene) return false;
  const editor = useTextEditor.getState();
  editor.checkpoint();
  useTextEditor.setState({ scene, selectedId: null });
  openGenerateMedia('text');
  toast({ status: 'success', title: t('gallery.toast.editedInText') });
  return true;
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
  // Without the Upscaling tab (hidden in the app) the picture is enlarged by an upscale model alone, as the batch dialog does.
  if (!isScreenShown('upscaling')) {
    useBatch.getState().open([image.name], 'upscale');
    return;
  }
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
