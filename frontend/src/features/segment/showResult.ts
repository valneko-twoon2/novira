// Shows a picture the dialog made next to the one it came from, so the change can be checked with the viewer's
// compare slider (leave compare mode from the viewer toolbar).
import { useGallery } from '@/state/gallery';
import { showViewer } from '@/state/ui';

export function showResult(result: string, source: string) {
  const gallery = useGallery.getState();
  gallery.setSelection([result]);
  gallery.setCompareImage(source);
  showViewer();
}
