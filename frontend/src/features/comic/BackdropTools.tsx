// The page's backdrop in the toolbar: a picture over the whole page, behind the panels (a splash page, or a collage the panels
// are set on). A popover puts a picture in (dropped from the gallery, or from a file), and holds the same tools as a panel's
// picture; "edit" shows the picture's handles over the page, where it is dragged, resized and turned freely.
import { ImageSquare } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { putBackdropFile, putBackdropGalleryImage } from '@/state/comic/backdropImage';
import type { ComicPage } from '@/state/comic/document';
import { reportImageFailure } from '@/state/comic/panelImage';
import { useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { toast } from '@/state/toasts';
import { Button, IconButton, ImageDropZone, Popover, PopoverContent, PopoverTrigger, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { PictureTools } from './PictureTools';
import { pictureResetItems, ResetMenu } from './ResetMenu';
import { removeBackdrop } from './removeBackdrop';

/** The page's whole extent, as the box a backdrop is fitted to. */
export const PAGE_BOX = { x: 0, y: 0, width: 1, height: 1 };

export function BackdropTools({ page, aspect }: { page: ComicPage; aspect: number }) {
  const editing = useComic((s) => s.backdropSelected);
  const url = useGallery((s) => (page.backdrop ? s.images.find((i) => i.name === page.backdrop!.imageName)?.url : undefined));
  const store = useComic.getState;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton
          size={TOOLBAR_BUTTON_SIZE}
          label={t('comic.backdrop.title')}
          icon={<ImageSquare />}
          isActive={editing}
          tooltip={false}
          title={t('comic.backdrop.title')}
          data-testid="comic-backdrop"
        />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="comic-tool-pop">
        <ImageDropZone
          className="comic-backdrop"
          label={t('comic.panel.dropHere')}
          onImages={(names) => {
            if (!putBackdropGalleryImage(page.id, names)) toast({ status: 'error', title: t('comic.panel.imageFailed') });
          }}
          onFiles={(files) => {
            const file = files[0];
            if (file) void putBackdropFile(page.id, file).catch(reportImageFailure);
          }}
        >
          <div className="comic-settings__body" data-testid="comic-backdrop-pop">
            <h3 className="comic-settings__title">{t('comic.backdrop.title')}</h3>
            <p className="comic-hint">{t('comic.backdrop.hint')}</p>
            {page.backdrop && (
              <Button variant="outline" size="sm" aria-pressed={editing} onClick={() => store().selectBackdrop(!editing)} data-testid="comic-backdrop-edit">
                {t('comic.backdrop.edit')}
              </Button>
            )}
            {page.backdrop && (
              <ResetMenu testId="comic-backdrop-reset" items={pictureResetItems((parts) => store().resetBackdrop(page.id, parts))} />
            )}
            <PictureTools
              className="comic-backdrop__tools"
              idPrefix="comic-backdrop"
              url={url}
              view={page.backdrop?.view ?? null}
              box={PAGE_BOX}
              aspect={aspect}
              onView={(next) => {
                store().setBackdropView(page.id, next);
                store().selectBackdrop(true);
              }}
              onFile={(file) => void putBackdropFile(page.id, file).catch(reportImageFailure)}
              onClear={() => removeBackdrop(page.id)}
            />
          </div>
        </ImageDropZone>
      </PopoverContent>
    </Popover>
  );
}
