// Sticky top of the left panel: preset bar, then seed + Generate row (as in the old app), then why Generate is disabled,
// then the model card. A screen may put its own chooser right above the model card (the comic screen's comics).
import type { ReactNode } from 'react';
import { InvokeControls } from '@/features/invoke/InvokeControls';
import { t } from '@/i18n';
import { refImagesEncoderReason } from '@/state/comfy/packNeeds';
import { useModelImport } from '@/state/dialogs/modelImport';
import { useInvokeWarnings, useReadiness } from '@/state/invoke';
import { modelPartsReason, useModelParts } from '@/state/modelParts';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import type { TabName } from '@/state/ui';
import { GenerationPresetBar } from '../presets/GenerationPresetBar';
import { ModelCard } from '../model/ModelCard';
import { MissingPartsButton } from './MissingPartsButton';
import { SeedRow } from './SeedRow';

export function PanelHeader({ tab, beforeModel }: { tab: TabName; beforeModel?: ReactNode }) {
  const reasons = useReadiness(tab);
  const warnings = useInvokeWarnings(tab);
  const refImages = useParams((s) => s.refImages);
  const models = useModels((s) => s.models);
  // The warning about a missing image encoder comes with a way straight to where it is installed.
  const modelKey = useParams((s) => s.modelKey);
  const partsReport = useModelParts((s) => (modelKey ? s.reports[modelKey] : undefined));
  // The reason that the model's text encoders or VAE are missing comes with a button that installs exactly those files.
  const partsMissing = reasons[0] !== undefined && partsReport !== undefined && reasons[0] === modelPartsReason(modelKey);
  const encoderMissing = reasons[0] !== undefined && reasons[0] === refImagesEncoderReason(refImages, models);
  return (
    <header className="pp-head" data-testid="panel-header">
      <GenerationPresetBar />
      <div className="pp-head__generate">
        <SeedRow />
        <InvokeControls tab={tab} />
        {reasons.length > 0 && (
          <p className="pp-reason" data-testid="generation-reason">
            {reasons[0]}
            {partsMissing && partsReport && (
              <>
                {' '}
                <MissingPartsButton report={partsReport} />
              </>
            )}
            {encoderMissing && (
              <>
                {' '}
                <button type="button" className="pp-reason__link" data-testid="open-starter-models" onClick={() => useModelImport.getState().open('starter')}>
                  {t('params.readiness.openStarter')}
                </button>
              </>
            )}
          </p>
        )}
        {reasons.length === 0 && warnings.length > 0 && (
          <p className="pp-reason pp-reason--warning" data-testid="generation-warning">
            {warnings[0]}
          </p>
        )}
      </div>
      {beforeModel}
      <ModelCard />
    </header>
  );
}
