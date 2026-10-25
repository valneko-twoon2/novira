// A note above the model grid: with the Civitai lookup off, a model put in the folder by hand gets no picture by design (the
// lookup sends the file's hash out). Shown once per screen, only when a model of a kind that has covers lacks one.
import { Info } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { backend, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { Button } from '@/ui';
import { coverKind } from './modelCategories';

/** Whether the lookup is known to be off (false while unknown or when the backend cannot say). */
function useLookupOff(): boolean {
  const [off, setOff] = useState(false);
  useEffect(() => {
    let live = true;
    backend.engineSettings().then(
      (e) => live && setOff(!e.civitaiLookup),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return off;
}

export function CoverHint({ models }: { models: ModelConfig[] }) {
  const lookupOff = useLookupOff();
  const missing = models.some((m) => coverKind(m.type) !== 'icon' && !m.coverImageUrl);
  if (!lookupOff || !missing) return null;
  return (
    <div className="mm-hint" role="note" data-testid="mm-cover-hint">
      <Info size={16} weight="light" className="mm-hint__icon" />
      <span className="mm-hint__text">{t('models.coverHint.text')}</span>
      <Button size="sm" variant="outline" onClick={() => useUi.getState().openSettings('engine')} data-testid="mm-cover-hint-open">
        {t('models.coverHint.open')}
      </Button>
    </div>
  );
}
