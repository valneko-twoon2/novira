// Where the selected panel is set, in the panel tools: one of the comic's places, whose words go after the panel's prompt.
// The chosen place's words can be changed here (for every panel set there), and a place added here becomes the panel's.
import { MapPinPlus } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { PLACES_MAX, type ComicPlace } from '@/state/comic/document';
import { addPlace, changePlace, removePlace } from '@/state/comic/places';
import { useComic } from '@/state/comic/store';
import { Button, Select } from '@/ui';
import { PlaceFields } from './PlaceFields';

/** No place (the value of the list). */
const NO_PLACE = 'none';

export function PanelPlace({ panelId, placeId, places }: { panelId: string; placeId: string | null; places: ComicPlace[] }) {
  const chosen = places.find((p) => p.id === placeId) ?? null;
  const setPlace = (id: string | null) => useComic.getState().setPanelPlace(panelId, id);
  const options = [{ value: NO_PLACE, label: t('comic.place.none') }, ...places.map((p) => ({ value: p.id, label: p.name.trim() || t('comic.place.name') }))];
  return (
    <div className="comic-places" data-testid="comic-panel-place">
      <div className="comic-place__head">
        <span className="comic-place__label">{t('comic.place.inPanel')}</span>
        <Select<string>
          value={chosen?.id ?? NO_PLACE}
          onChange={(v) => setPlace(v === NO_PLACE ? null : v)}
          options={options}
          aria-label={t('comic.place.inPanel')}
          data-testid="comic-panel-place-select"
        />
        <Button variant="outline" size="xs" leftIcon={<MapPinPlus />} disabled={places.length >= PLACES_MAX} onClick={() => setPlace(addPlace())} data-testid="comic-panel-place-add">
          {t('comic.place.add')}
        </Button>
      </div>
      {chosen && <PlaceFields key={chosen.id} place={chosen} change={(patch) => changePlace(chosen.id, patch)} remove={() => removePlace(chosen.id)} />}
      <p className="comic-hint">{t('comic.place.inPanelHelp')}</p>
    </div>
  );
}
