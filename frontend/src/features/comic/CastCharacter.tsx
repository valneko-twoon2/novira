// One character of the comic's cast, edited: its name, its words (the general tags, then hair, eyes, face, clothes, body
// and what it carries, of which a panel gets the parts its framing shows), the words kept out of its panels, and its
// picture: the sheet in the design tab, the reference picture in the panel tools. In the design tab the words also open in
// a larger window.
import { ArrowsOut, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { CHARACTER_NAME_MAX, type ComicCharacter } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { findImage } from '@/state/gallery';
import { CastWords, CastWordsDialog } from './CastWords';
import { CharacterSheet } from './CharacterSheet';
import { Button, Checkbox, IconButton, Select, TextInput } from '@/ui';

/** No person of the pose (the value of the "who is this" list). */
const NO_PERSON = 'none';

export function CastCharacter({
  character: c,
  cast,
  panelId,
  panelCast,
  panelImage,
  posePeople,
  poseCast,
}: {
  character: ComicCharacter;
  cast: ComicCharacter[];
  panelId?: string;
  panelCast: string[];
  panelImage: string | null;
  posePeople: number;
  poseCast: (string | null)[];
}) {
  const store = useComic.getState;
  const projectId = useComic((s) => s.activeProjectId);
  const [wordsOpen, setWordsOpen] = useState(false);
  const change = (patch: Partial<ComicCharacter>) => store().setCast(cast.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
  const person = poseCast.findIndex((who) => who === c.id);
  // A character is one person of the pose at most: choosing a person takes the character off any other.
  const placeOn = (value: string) => {
    const next = Array.from({ length: posePeople }, (_, i) => (poseCast[i] === c.id ? null : (poseCast[i] ?? null)));
    if (value !== NO_PERSON) next[Number(value) - 1] = c.id;
    if (panelId) store().setPanelPoseCast(panelId, next.some(Boolean) ? next : []);
  };
  const personOptions = [{ value: NO_PERSON, label: t('comic.cast.posePersonNone') }, ...Array.from({ length: posePeople }, (_, i) => ({ value: String(i + 1), label: t('comic.cast.posePersonN', { n: i + 1 }) }))];
  return (
    <div className="comic-cast__row" data-testid="comic-cast-row">
      <div className="comic-cast__head">
        <TextInput
          value={c.name}
          maxLength={CHARACTER_NAME_MAX}
          onChange={(e) => change({ name: e.target.value })}
          placeholder={t('comic.cast.name')}
          aria-label={t('comic.cast.name')}
          data-testid="comic-cast-name"
        />
        {/* The panel tools give the words the popover's whole width, and a window opened from a popover would sit under it. */}
        {!panelId && (
          <Button variant="outline" size="xs" leftIcon={<ArrowsOut />} onClick={() => setWordsOpen(true)} data-testid="comic-cast-words-open">
            {t('comic.cast.wordsOpen')}
          </Button>
        )}
        <IconButton size="sm" label={t('comic.cast.remove')} icon={<Trash />} onClick={() => store().setCast(cast.filter((x) => x.id !== c.id))} data-testid="comic-cast-remove" />
      </div>
      <CastWords character={c} change={change} />
      {panelId && posePeople > 0 && panelCast.includes(c.id) && (
        <div className="comic-detail__row">
          <Select<string>
            value={person >= 0 ? String(person + 1) : NO_PERSON}
            onChange={placeOn}
            options={personOptions}
            aria-label={t('comic.cast.posePerson')}
            data-testid="comic-cast-pose-person"
          />
        </div>
      )}
      <Checkbox checked={c.nonHuman === true} onChange={(on) => change({ nonHuman: on })} label={t('comic.cast.nonHuman')} />
      {!panelId && projectId ? (
        <CharacterSheet projectId={projectId} cast={cast} character={c} />
      ) : (
        <div className="comic-cast__ref" data-testid="comic-cast-ref">
          {c.imageName && findImage(c.imageName)?.url ? <img className="comic-cast__thumb" src={findImage(c.imageName)!.url} alt={t('comic.cast.refAlt', { name: c.name })} /> : null}
          <span className="comic-hint">{c.imageName ? t('comic.cast.refSet') : t('comic.cast.refNone')}</span>
          {panelId && (
            <Button variant="outline" size="xs" disabled={!panelImage || panelImage === c.imageName} onClick={() => change({ imageName: panelImage })} data-testid="comic-cast-ref-use">
              {t('comic.cast.refUse')}
            </Button>
          )}
          {c.imageName && (
            <Button variant="outline" size="xs" onClick={() => change({ imageName: null })} data-testid="comic-cast-ref-clear">
              {t('comic.cast.refClear')}
            </Button>
          )}
        </div>
      )}
      {!panelId && <CastWordsDialog open={wordsOpen} onOpenChange={setWordsOpen} character={c} change={change} />}
    </div>
  );
}
