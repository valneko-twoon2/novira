// Model card under the Generate row: cover, model select, manager / online search shortcuts and recommended values.
import { t } from '@/i18n';
import { BASE_ORDER, drawableModels, useModels } from '@/state/models';
import { CoverImage, ModelPicker } from '@/ui';
import { ModelProfilePopover } from './ModelProfileChips';
import { selectMainModel } from './selectMainModel';
import { useMainModel } from './useMainModel';

export function ModelCard() {
  const models = useModels((s) => s.models);
  const current = useMainModel();
  const mains = drawableModels(models).sort(
    (a, b) => BASE_ORDER.indexOf(a.base) - BASE_ORDER.indexOf(b.base) || a.name.localeCompare(b.name),
  );
  return (
    <section className="pp-model" data-testid="model-card">
      <div className="pp-model__row">
        <CoverImage model={current} zoomable />
        <div className="pp-model__main">
          <ModelPicker
            models={mains}
            value={current?.key ?? null}
            onPick={selectMainModel}
            placeholder={mains.length ? t('params.model.select') : t('params.model.noModels')}
            disabled={!mains.length}
            aria-label={t('params.model.label')}
            testId="model-picker"
          />
          <div className="pp-model__links">
            {current && <ModelProfilePopover model={current} />}
          </div>
        </div>
      </div>
    </section>
  );
}
