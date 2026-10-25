// A picture dropped on the page, anywhere that is not a panel (the paper between and around the panels), becomes the page's
// backdrop. A drop on a panel is the panel's own (Alt sends it to the backdrop instead; see ComicPanelView).
import { useState, type DragEvent, type ReactNode } from 'react';
import { t } from '@/i18n';
import { putBackdropFile, putBackdropGalleryImage } from '@/state/comic/backdropImage';
import { reportImageFailure } from '@/state/comic/panelImage';
import { isImageDrag, resolveDropImages } from '@/state/dnd';
import { toast } from '@/state/toasts';

const onPanel = (e: DragEvent) => !!(e.target as HTMLElement).closest('.comic-panel-drop');

export function PageDropLayer({ pageId, children }: { pageId: string; children: ReactNode }) {
  const [over, setOver] = useState(false);
  const track = (e: DragEvent) => {
    if (!isImageDrag(e)) return;
    // Over a panel the panel takes the drop, so the page shows nothing there.
    if (onPanel(e)) {
      setOver(false);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setOver(true);
  };
  const drop = (e: DragEvent) => {
    setOver(false);
    if (onPanel(e)) return;
    e.preventDefault();
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    void resolveDropImages(e).then((names) => {
      if (names.length) {
        if (!putBackdropGalleryImage(pageId, names)) toast({ status: 'error', title: t('comic.panel.imageFailed') });
      } else if (files[0]) void putBackdropFile(pageId, files[0]).catch(reportImageFailure);
    });
  };
  return (
    <div className="comic-page__drop" onDragOver={track} onDragEnter={track} onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOver(false)} onDrop={drop}>
      {children}
      {over && (
        <div className="ui-dropzone__overlay" data-testid="comic-backdrop-drop">
          {t('comic.backdrop.dropHere')}
        </div>
      )}
    </div>
  );
}
