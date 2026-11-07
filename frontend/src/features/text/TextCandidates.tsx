// The AI candidates of the selected text layer, in a strip under the canvas: a press makes that picture the layer's fill at once.
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useRichForm } from '@/state/text/richForm';
import { useTextEditor } from '@/state/text/textEditor';
import { richIsCurrent } from '@/state/text/textModel';
import { Button } from '@/ui';
import { richPlan } from './richRequest';
import { clearRich, pickRichCandidate, runRich, useRichRun } from './richRun';
import './text.css';

export function TextCandidates() {
  const layer = useTextEditor((s) => {
    const l = s.scene.layers.find((x) => x.id === s.selectedId);
    return l?.type === 'text' ? l : null;
  });
  const images = useGallery((s) => s.images);
  const models = useModels((s) => s.models);
  const modelKey = useRichForm((s) => s.form.modelKey);
  const generateKey = useParams((s) => s.modelKey);
  const run = useRichRun((s) => (layer ? s.running[layer.id] : undefined));
  const plan = useMemo(() => richPlan(models, modelKey, generateKey), [models, modelKey, generateKey]);
  if (!layer?.rich) return null;
  const stale = !richIsCurrent(layer);
  const urlOf = (name: string) => images.find((i) => i.name === name)?.url;
  return (
    <div className="tx-cands" data-testid="text-candidates">
      <div className="tx-cands__list" role="group" aria-label={t('text.rich.candidates')}>
        {layer.rich.candidates.map((name) => {
          const url = urlOf(name);
          return (
            <button
              key={name}
              type="button"
              className="tx-rich__cand"
              aria-pressed={layer.rich?.imageName === name}
              onClick={() => pickRichCandidate(layer.id, name)}
              data-testid="text-rich-candidate"
            >
              {url && <img src={url} alt="" draggable={false} />}
            </button>
          );
        })}
      </div>
      {stale && (
        <div className="tx-cands__stale" data-testid="text-rich-stale">
          <span className="tx-note">{t('text.rich.stale')}</span>
          <Button size="sm" leftIcon={<ArrowCounterClockwise />} disabled={!plan.model || layer.text.trim() === '' || run !== undefined} onClick={() => void runRich(layer.id)} data-testid="text-rich-redo">
            {t('text.rich.redo')}
          </Button>
        </div>
      )}
      <Button size="sm" onClick={() => clearRich(layer.id)} data-testid="text-rich-clear">
        {t('text.rich.clear')}
      </Button>
    </div>
  );
}
