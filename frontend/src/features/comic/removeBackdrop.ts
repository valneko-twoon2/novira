// Taking the backdrop off a page, with a notice that puts it back.
import { t } from '@/i18n';
import { useComic } from '@/state/comic/store';
import { toast } from '@/state/toasts';

/** Takes the backdrop off the page. The picture stays in the gallery, and the notice can put it back as it was. */
export function removeBackdrop(pageId: string) {
  const store = useComic.getState();
  const page = store.projects.flatMap((p) => p.pages).find((pg) => pg.id === pageId);
  if (!page?.backdrop) return;
  const { imageName, view } = page.backdrop;
  store.setBackdrop(pageId, null);
  toast({
    status: 'info',
    title: t('comic.backdrop.removed'),
    actions: [
      {
        label: t('comic.history.undo'),
        run: () => {
          useComic.getState().setBackdrop(pageId, imageName);
          useComic.getState().setBackdropView(pageId, view);
        },
      },
    ],
  });
}
