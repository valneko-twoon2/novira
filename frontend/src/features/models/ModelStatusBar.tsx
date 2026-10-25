// Thin status bar: model count and total size, plus the install dock on the left.
import type { ModelConfig } from '@/backend';
import { t, tCount } from '@/i18n';
import { InstallDock } from './InstallDock';
import { formatBytes } from './modelLabels';

export function ModelStatusBar({ models, shown }: { models: ModelConfig[]; shown: number }) {
  const size = models.reduce((sum, m) => sum + m.size, 0);
  return (
    <div className="mm-status" data-testid="mm-status">
      <InstallDock />
      <span className="mm-spacer" />
      {shown !== models.length && <span className="mm-status__part">{t('models.status.filtered', { shown, total: models.length })}</span>}
      <span className="mm-status__part">{tCount('models.status.summary', models.length, { size: formatBytes(size) })}</span>
    </div>
  );
}
