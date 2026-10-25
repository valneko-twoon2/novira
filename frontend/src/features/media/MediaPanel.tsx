// The frame of a media screen's left panel (video, music, voice, logo): the preset card, the seed row and the Generate bar
// (the same pieces, in the same order and spacing, as the Generate tab's header), then the form.
import type { ReactNode } from 'react';
import type { PackKind } from '@/backend';
import { InvokeControls } from '@/features/invoke/InvokeControls';
import { useReadiness } from '@/state/invoke';
import type { GeneratedMedia } from '@/state/ui';
import { PackCard } from './PackCard';
import './media.css';

export type GeneratedKind = GeneratedMedia;

/**
 * `pack` names the download to offer when it is not the screen's own (the video screen's fast model); `packCard` replaces
 * that card (the video screen offers both models to choose from). `presets` is the screen's preset card and `seed` its
 * seed row (the voice screen has none), shown first as on the image screen. The header's look is the Generate tab's
 * (`pp-head` in features/params/header/header.css).
 */
export function MediaPanel({ kind, pack, packCard, presets, seed, children }: { kind: GeneratedKind; pack?: PackKind; packCard?: ReactNode; presets?: ReactNode; seed?: ReactNode; children: ReactNode }) {
  return (
    <div className="mf-panel" data-testid={`${kind}-panel`}>
      <PanelHeader kind={kind} presets={presets} seed={seed} />
      <div className="mf-panel__body">
        {packCard ?? <PackCard kind={pack ?? kind} />}
        {children}
      </div>
    </div>
  );
}

function PanelHeader({ kind, presets, seed }: { kind: GeneratedKind; presets?: ReactNode; seed?: ReactNode }) {
  const reasons = useReadiness(kind);
  return (
    <header className="pp-head mf-head">
      {presets}
      <div className="pp-head__generate">
        {seed}
        <InvokeControls tab={kind} />
        {reasons.length > 0 && (
          <p className="pp-reason" data-testid={`${kind}-problems`}>
            {reasons[0]}
          </p>
        )}
      </div>
    </header>
  );
}
