// Next to the reason "this model needs files that are not installed": installs exactly those files, without leaving the
// screen. A large download opens the confirmation (`ModelPartsDialog`) first.
import type { ModelPartsReport } from '@/backend';
import { t } from '@/i18n';
import { formatPartsSize, installMissingParts, partsBytes, partsToInstall } from '@/state/modelParts';
import { useModels } from '@/state/models';

export function MissingPartsButton({ report }: { report: ModelPartsReport }) {
  // Re-render when a download starts or finishes.
  const models = useModels((s) => s.models);
  useModels((s) => s.installJobs);
  const todo = partsToInstall(report, models);
  const busy = todo.length === 0;
  return (
    <button type="button" className="pp-reason__link" data-testid="install-model-parts" disabled={busy} onClick={() => void installMissingParts(report)}>
      {busy ? t('params.readiness.installingParts') : t('params.readiness.installParts', { size: formatPartsSize(partsBytes(todo)) })}
    </button>
  );
}
