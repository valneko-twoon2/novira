// Center area of the music and voice screens: running jobs, and the finished clips with a player each.
import { MicrophoneStage, MusicNotes, Trash } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { backend, type ImageDTO } from '@/backend';
import { t, tCount } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { IconButton } from '@/ui';
import { MediaJobs, useMediaJobs } from './MediaJobs';
import './media.css';

type AudioKind = 'music' | 'voice';

export function AudioResults({ kind }: { kind: AudioKind }) {
  const images = useGallery((s) => s.images);
  const { active } = useMediaJobs(kind);
  const clips = useMemo(
    () => images.filter((i) => i.mediaType === 'audio' && i.metadata?.generationMode === kind).sort((a, b) => b.createdAt - a.createdAt),
    [images, kind],
  );
  return (
    <div className="mf-results" data-testid={`${kind}-results`}>
      <MediaJobs kind={kind} />
      {clips.length === 0 && active.length === 0 ? (
        <div className="mf-empty">
          {kind === 'music' ? <MusicNotes size={32} /> : <MicrophoneStage size={32} />}
          <strong>{t(`audio.empty.${kind}.title`)}</strong>
        </div>
      ) : (
        <div className="au-list">
          {clips.map((c) => (
            <ClipCard key={c.name} clip={c} kind={kind} />
          ))}
        </div>
      )}
    </div>
  );
}

function clipInfo(clip: ImageDTO, kind: AudioKind): string {
  const m = clip.metadata;
  if (!m) return '';
  if (kind === 'music' && m.music) {
    return [tCount('audio.seconds', m.music.seconds), `${m.music.bpm} bpm`, m.music.key, `seed ${m.seed}`].join(' · ');
  }
  if (kind === 'voice' && m.voice) {
    const who = m.voice.mode === 'design' ? t('audio.voice.designed') : m.voice.speaker;
    return [who, m.voice.language].join(' · ');
  }
  return '';
}

function ClipCard({ clip, kind }: { clip: ImageDTO; kind: AudioKind }) {
  const meta = clip.metadata;
  const title = kind === 'voice' ? meta?.voice?.text : meta?.positivePrompt;
  return (
    <article className="au-clip" data-testid={`${kind}-clip`}>
      <img className="au-clip__wave" src={clip.thumbnailUrl} alt="" draggable={false} />
      <audio src={clip.url} controls preload="metadata" />
      <div className="au-clip__meta">
        <span className="au-clip__title" title={title}>
          {title}
        </span>
        <IconButton
          size="xs"
          label={t('audio.delete')}
          icon={<Trash />}
          onClick={() => {
            void backend.deleteImages([clip.name]).then(() => useGallery.getState().removeImages([clip.name]));
          }}
        />
      </div>
      <span className="au-clip__info">{clipInfo(clip, kind)}</span>
      {kind === 'music' && meta?.music && !meta.music.instrumental && meta.music.lyrics && (
        <details className="au-clip__lyrics">
          <summary>{t('audio.lyrics')}</summary>
          <pre>{meta.music.lyrics}</pre>
        </details>
      )}
    </article>
  );
}
