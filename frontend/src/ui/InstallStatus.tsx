// How far a model install is: "installed", or a progress bar with its percent. Nothing while no install is running or done,
// so a caller shows its own Install button then (see InstallSlot).
import { Check } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { useInstallState, type InstallState } from '@/state/modelInstall';
import { ProgressBar } from './controls';

export function InstallStatus({ state }: { state: InstallState }) {
  if (state.kind === 'installed') {
    return (
      <span className="ui-install-state is-installed" data-testid="install-state-installed">
        <Check size={12} weight="bold" /> {t('browse.card.installed')}
      </span>
    );
  }
  if (state.kind === 'queued') {
    const percent = Math.round(state.progress * 100);
    return (
      <span className="ui-install-state" data-testid="install-state-progress">
        <ProgressBar value={state.progress} indeterminate={percent === 0} />
        {t('browse.card.installing', { percent })}
      </span>
    );
  }
  return null;
}

/** The install state of `source` while it is installed or installing; `children` (the Install button) while it is neither. */
export function InstallSlot({ source, name, children }: { source: string; name?: string; children: ReactNode }) {
  const state = useInstallState(source, name);
  return state.kind === 'idle' ? <>{children}</> : <InstallStatus state={state} />;
}
