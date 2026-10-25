// The selected panel's earlier pictures, in a popover of the page's toolbar: the picture it has now and the ones a redraw or
// another picture replaced, newest first. Pressing one puts it back as it sat in the panel (the picture there now goes to
// the list); removing one from the list leaves it in the gallery. A picture deleted from the gallery is not offered.
import { ClockCounterClockwise, X } from '@phosphor-icons/react';
import { t } from '@/i18n';
import type { ComicPanel } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { IconButton, Popover, PopoverContent, PopoverTrigger, TOOLBAR_BUTTON_SIZE } from '@/ui';

export function PanelTakes({ panel }: { panel: ComicPanel }) {
  const images = useGallery((s) => s.images);
  const find = (name: string) => images.find((i) => i.name === name);
  const now = panel.imageName ? find(panel.imageName) : undefined;
  const earlier = panel.takes.flatMap((take) => {
    const image = find(take.imageName);
    return image ? [image] : [];
  });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.takes.title')} icon={<ClockCounterClockwise />} tooltip={false} title={t('comic.takes.title')} data-testid="comic-takes" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="comic-tool-pop" onEscapeKeyDown={(e) => e.stopPropagation()}>
        <div className="comic-settings__body">
          <h3 className="comic-settings__title">{t('comic.takes.title')}</h3>
          <div className="comic-takes" data-testid="comic-takes-list">
            {now && (
              <figure className="comic-take is-now" data-testid="comic-take-now">
                <img className="comic-take__img" src={now.thumbnailUrl} alt="" />
                <figcaption className="comic-take__label">{t('comic.takes.now')}</figcaption>
              </figure>
            )}
            {earlier.map((image) => (
              <figure key={image.name} className="comic-take">
                <button type="button" className="comic-take__pick" title={t('comic.takes.use')} aria-label={t('comic.takes.use')} onClick={() => useComic.getState().setPanelImage(panel.id, image.name)} data-testid="comic-take">
                  <img className="comic-take__img" src={image.thumbnailUrl} alt="" />
                </button>
                <IconButton className="comic-take__remove" size="xs" label={t('comic.takes.remove')} icon={<X />} onClick={() => useComic.getState().removeTake(panel.id, image.name)} data-testid="comic-take-remove" />
              </figure>
            ))}
          </div>
          <p className="comic-hint">{earlier.length ? t('comic.takes.help') : t('comic.takes.empty')}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
