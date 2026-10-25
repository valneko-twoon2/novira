import { useState } from 'react';
import type { CivitaiModel } from '@/backend';
import { t } from '@/i18n';
import { useBrowse } from './browseStore';
import { coverUrl, coverVideoUrl } from './covers';

/** How a video cover plays: on hover (a card) or with its own controls (the detail view). A picture ignores it. */
export type CoverPlay = 'hover' | 'controls';

export function Cover({ model, index, className, play }: { model: CivitaiModel; index: number; className?: string; play?: CoverPlay }) {
  const url = coverUrl(model, index);
  const [failed, setFailed] = useState<string | null>(null);
  // Hugging Face does not flag mature pictures, so its covers stay blurred unless mature content is on.
  const includeNsfw = useBrowse((s) => s.includeNsfw);
  const blurred = model.source === 'huggingface' && !includeNsfw;
  // Civitai leaves out the pictures it rates above plain unless mature content is asked for, so an empty frame may only be hiding them.
  if (!url && model.source !== 'huggingface' && model.imageUrls?.length === 0 && !includeNsfw) {
    return <div className={`browse-cover browse-cover--note ${className ?? ''}`}>{t('browse.cover.maybeMature')}</div>;
  }
  if (!url) return <div className={`browse-cover ${className ?? ''}`} aria-hidden="true" />;
  // A picture that cannot be loaded leaves an empty frame instead of the browser's broken-image icon.
  if (failed === url) return <div className={`browse-cover ${className ?? ''}`} aria-hidden="true" />;
  const cls = `browse-cover ${blurred ? 'is-blurred' : ''} ${className ?? ''}`;
  const video = play ? coverVideoUrl(url) : null;
  if (video) {
    // The first frame stays as the poster until it plays; nothing is fetched before then.
    const run = (el: HTMLVideoElement, on: boolean) => {
      try {
        if (on) void el.play().catch(() => {});
        else el.pause();
      } catch {
        // A browser that cannot play it keeps the poster.
      }
    };
    return (
      <video
        className={cls}
        src={video}
        poster={url}
        muted
        loop
        playsInline
        preload="none"
        controls={play === 'controls'}
        onMouseEnter={play === 'hover' ? (e) => run(e.currentTarget, true) : undefined}
        onMouseLeave={play === 'hover' ? (e) => run(e.currentTarget, false) : undefined}
        onError={() => setFailed(url)}
      />
    );
  }
  return <img className={cls} src={url} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(url)} />;
}
