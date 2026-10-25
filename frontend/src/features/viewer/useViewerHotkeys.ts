// Single-key shortcuts of the image viewer (registered only while the viewer is mounted).
import type { ImageDTO } from '@/backend';
import { loadImageWorkflow, recall, sendToUpscale } from '@/features/gallery/actions';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { toast } from '@/state/toasts';
import { useHotkey } from '@/ui';

/** Toggle compare: exit if active, otherwise compare with the previously selected image. */
export function toggleCompare() {
  const g = useGallery.getState();
  if (g.compareImageName) {
    g.setCompareImage(null);
    return;
  }
  const other = g.selection.length >= 2 ? g.selection[g.selection.length - 2] : undefined;
  if (other && other !== g.viewerImageName) g.setCompareImage(other);
  else toast({ status: 'info', title: t('gallery.compare.hint') });
}

export function useViewerHotkeys(image: ImageDTO | undefined, compareActive: boolean) {
  const run = (fn: (img: ImageDTO) => void) => () => {
    if (image) fn(image);
  };
  useHotkey('i', () => useGallery.getState().toggleMetadata());
  useHotkey('r', run((img) => recall(img, 'remix')));
  useHotkey('p', run((img) => recall(img, 'prompt')));
  useHotkey('s', run((img) => recall(img, 'seed')));
  useHotkey('a', run((img) => recall(img, 'all')));
  useHotkey('w', run((img) => loadImageWorkflow(img)));
  useHotkey('shift+u', run((img) => sendToUpscale(img)));
  useHotkey('c', toggleCompare);
  useHotkey('escape', () => useGallery.getState().setCompareImage(null), { enabled: compareActive });
}
