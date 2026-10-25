// What a balloon looks like, drawn small: the balloon list shows one for each kind it adds, and the editor's shape list
// one beside each shape. The drawing is the very outline the page draws (see BalloonArt), with a tail down to the left;
// lettering with no balloon shows a word in its lettering instead.
import { useMemo } from 'react';
import { t } from '@/i18n';
import { balloonShape } from '@/state/comic/balloon';
import { LETTERING_KINDS, newBubble, parseBubble, type BubbleKind, type ComicBubble } from '@/state/comic/document';
import { DEFAULT_STAMP_ID, stampUrl } from '@/state/comic/stamps';
import { cx } from '@/ui';
import { BalloonArt } from './BalloonArt';

/** A balloon of the list: its shape and anything else it starts with. Its id names it (a shape's own name when it is a shape). */
export interface BalloonPreset {
  id: string;
  kind: BubbleKind;
  look?: Partial<Omit<ComicBubble, 'id' | 'kind'>>;
}

/** The balloons the list adds: every shape, and a few looks of the plain balloon (a whisper, a black one, a doubled line). */
export const BALLOON_PRESETS: BalloonPreset[] = [
  { id: 'speech', kind: 'speech' },
  { id: 'rounded', kind: 'rounded' },
  { id: 'box', kind: 'box' },
  { id: 'thought', kind: 'thought' },
  { id: 'whisper', kind: 'speech', look: { line: 'dashed' } },
  { id: 'shout', kind: 'shout' },
  { id: 'explosion', kind: 'explosion' },
  { id: 'wavy', kind: 'wavy' },
  { id: 'fuzzy', kind: 'fuzzy' },
  { id: 'electric', kind: 'electric' },
  { id: 'icicle', kind: 'icicle' },
  { id: 'heart', kind: 'heart' },
  { id: 'flash', kind: 'flash' },
  { id: 'dark', kind: 'speech', look: { dark: true } },
  { id: 'double', kind: 'speech', look: { line: 'double' } },
  { id: 'caption', kind: 'caption' },
  { id: 'sfx', kind: 'sfx' },
  { id: 'plain', kind: 'plain' },
  { id: 'stamp', kind: 'stamp' },
];

/** The name of a balloon of the list: its shape's name, or the name of its look. */
export function presetLabel(preset: BalloonPreset): string {
  switch (preset.id) {
    case 'whisper':
      return t('comic.bubble.preset.whisper');
    case 'dark':
      return t('comic.bubble.preset.dark');
    case 'double':
      return t('comic.bubble.preset.double');
    default:
      return t(`comic.bubble.kind.${preset.kind}`);
  }
}

/** The tail of a drawn balloon: down and to the left, out of the balloon. */
const PREVIEW_TAIL = { x: 0.12, y: 1.32 };

export function BalloonPreview({ kind, look, small }: { kind: BubbleKind; look?: BalloonPreset['look']; small?: boolean }) {
  const bubble = useMemo(() => {
    const made = newBubble(kind, 0, 0);
    return parseBubble({ ...made, ...look, id: 'preview', kind, tail: made.tail ? PREVIEW_TAIL : null }) ?? made;
  }, [kind, look]);
  const shape = useMemo(() => balloonShape(bubble, 7), [bubble]);
  if (kind === 'stamp') {
    return (
      <span className={cx('comic-balloon-preview', 'is-lettering', 'is-stamp', small && 'is-small')} aria-hidden="true">
        <img src={stampUrl(DEFAULT_STAMP_ID)} alt="" draggable={false} />
      </span>
    );
  }
  if (LETTERING_KINDS.includes(kind)) {
    return (
      <span className={cx('comic-balloon-preview', 'is-lettering', `is-${kind}`, small && 'is-small')} aria-hidden="true">
        {t(kind === 'sfx' ? 'comic.bubble.previewSfx' : 'comic.bubble.previewPlain')}
      </span>
    );
  }
  return (
    <span className={cx('comic-balloon-preview', small && 'is-small')} aria-hidden="true">
      <BalloonArt shape={shape} look={bubble} unit={small ? '0.5px' : '0.75px'} viewBox="-0.45 -0.45 1.9 2" />
    </span>
  );
}
