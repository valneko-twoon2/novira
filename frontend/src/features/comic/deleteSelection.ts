// What the trash button of the page's toolbar and the Delete key take away: the one thing that is selected. That is the
// selected balloon, else the selected picture (out of its panel), else the page's backdrop while it is selected, else the
// selected panel (a page keeps at least one panel). Pictures stay in the gallery, and a notice can put them back.
import { t } from '@/i18n';
import { activePage, findPanel, useComic, type ComicState } from '@/state/comic/store';
import { toast } from '@/state/toasts';
import { removeBackdrop } from './removeBackdrop';

export type DeleteTarget = 'bubble' | 'picture' | 'backdrop' | 'panel';

/** What a delete would take away now, or null when nothing that can go is selected. */
export function deleteTarget(s: ComicState): DeleteTarget | null {
  const page = activePage(s);
  if (!page) return null;
  if (s.backdropSelected) return page.backdrop ? 'backdrop' : null;
  const panel = page.panels.find((p) => p.id === s.selectedPanelId);
  if (!panel) return null;
  if (s.selectedBubbleId && panel.bubbles.some((b) => b.id === s.selectedBubbleId)) return 'bubble';
  if (s.imageSelected && panel.imageName) return 'picture';
  return page.panels.length > 1 ? 'panel' : null;
}

/** The trash button's name for each target: it says what the press takes away. */
export const deleteLabel = (target: DeleteTarget | null) =>
  t(
    target === 'bubble'
      ? 'comic.bubble.remove'
      : target === 'picture'
        ? 'comic.panel.imageClear'
        : target === 'backdrop'
          ? 'comic.backdrop.clear'
          : 'comic.shape.removePanel',
  );

/** Takes the picture out of a panel. The picture stays in the gallery, and the notice can put it back as it was. */
export function removePicture(panelId: string) {
  const store = useComic.getState();
  const panel = findPanel(store.projects, panelId)?.panel;
  if (!panel?.imageName) return;
  const { imageName, imageView } = panel;
  store.setPanelImage(panelId, null);
  store.selectPanel(panelId);
  toast({
    status: 'info',
    title: t('comic.image.removed'),
    actions: [
      {
        label: t('comic.history.undo'),
        run: () => {
          useComic.getState().setPanelImage(panelId, imageName);
          useComic.getState().setPanelImageView(panelId, imageView);
        },
      },
    ],
  });
}

/** Takes away what is selected (see deleteTarget). */
export function deleteSelection() {
  const s = useComic.getState();
  const page = activePage(s);
  const target = deleteTarget(s);
  if (!page || !target) return;
  const index = page.panels.findIndex((p) => p.id === s.selectedPanelId);
  const panel = page.panels[index];
  if (target === 'backdrop') removeBackdrop(page.id);
  else if (target === 'bubble' && panel && s.selectedBubbleId) s.removeBubble(panel.id, s.selectedBubbleId);
  else if (target === 'picture' && panel) removePicture(panel.id);
  else if (target === 'panel') s.removePanel(page.id, index);
}
