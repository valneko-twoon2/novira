// The low-memory mode switch: a backend setting (settings.json) that restarts ComfyUI when changed.
import { useEffect } from 'react';
import { t } from '@/i18n';
import { useLowMemory } from '@/state/lowMemory';
import { Switch } from '@/ui';

export function LowMemorySwitch() {
  const mode = useLowMemory((s) => s.mode);
  const busy = useLowMemory((s) => s.busy);
  useEffect(() => {
    void useLowMemory.getState().load();
  }, []);
  return (
    <Switch
      checked={mode?.enabled ?? false}
      disabled={!mode || busy}
      onChange={(v) => void useLowMemory.getState().setEnabled(v)}
      aria-label={t('settings.lowMemory.label')}
    />
  );
}

/** Why the switch does not act right away: a job runs, or the ComfyUI is not novira's own. */
export function LowMemoryNote() {
  const mode = useLowMemory((s) => s.mode);
  if (!mode) return null;
  if (!mode.ownedEngine) return <div className="st-notice">{t('settings.lowMemory.external')}</div>;
  if (mode.pendingRestart) return <div className="st-notice">{t('settings.lowMemory.pending')}</div>;
  return null;
}
