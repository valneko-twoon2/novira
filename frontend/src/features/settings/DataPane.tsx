// Settings → Data: the backup, the unfinished downloads that can be deleted, and putting a chosen part of the saved state
// back to how it was at first. The settings themselves go back at once; the other parts are read again when the screen
// reloads, so a button offers that.
import { useState } from 'react';
import { t, type MessageKey } from '@/i18n';
import { useSettings } from '@/state/settings';
import { toast } from '@/state/toasts';
import { clearSavedState, RESET_SCOPES, type ResetScope } from '@/state/uiState';
import { Button, Select } from '@/ui';
import { BackupSection } from './BackupSection';
import { Row, SectionBlock } from './settingsLayout';
import { UnfinishedDownloads } from './UnfinishedDownloads';

const SCOPES = Object.keys(RESET_SCOPES) as ResetScope[];
const SCOPE_LABEL: Record<ResetScope, MessageKey> = {
  settings: 'settings.reset.scope.settings',
  generation: 'settings.reset.scope.generation',
  gallery: 'settings.reset.scope.gallery',
  assistant: 'settings.reset.scope.assistant',
  all: 'settings.reset.scope.all',
};
const SCOPE_HELP: Record<ResetScope, MessageKey> = {
  settings: 'settings.reset.scope.settingsHelp',
  generation: 'settings.reset.scope.generationHelp',
  gallery: 'settings.reset.scope.galleryHelp',
  assistant: 'settings.reset.scope.assistantHelp',
  all: 'settings.reset.scope.allHelp',
};

export function DataPane() {
  const [scope, setScope] = useState<ResetScope>('settings');
  const [confirming, setConfirming] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  const reset = () => {
    try {
      clearSavedState(scope, localStorage);
    } catch {
      // Storage may be unavailable; the settings are still put back in memory below.
    }
    if (scope === 'settings' || scope === 'all') useSettings.getState().reset();
    setConfirming(false);
    if (scope !== 'settings') setNeedsReload(true);
    toast({ status: 'success', title: t('settings.toast.reset') });
  };

  return (
    <>
      <BackupSection />
      <UnfinishedDownloads />
      <SectionBlock title={t('settings.section.reset')}>
        <Row label={t('settings.reset.scope.label')} help={t('settings.resetWebUiHelp')} note={t(SCOPE_HELP[scope])}>
          <div className="st-inline">
            <Select
              className="st-select"
              value={scope}
              onChange={(v) => {
                setScope(v);
                setConfirming(false);
              }}
              options={SCOPES.map((s) => ({ value: s, label: t(SCOPE_LABEL[s]) }))}
              aria-label={t('settings.reset.scope.label')}
              data-testid="settings-reset-scope"
            />
            {confirming ? (
              <div className="st-inline">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  {t('common.cancel')}
                </Button>
                <Button size="sm" scheme="danger" onClick={reset} data-testid="settings-reset-confirm">
                  {t('settings.resetConfirm')}
                </Button>
              </div>
            ) : (
              <Button size="sm" scheme="danger" onClick={() => setConfirming(true)} data-testid="settings-reset">
                {t('settings.resetWebUi')}
              </Button>
            )}
          </div>
        </Row>
        {needsReload && (
          <div className="st-notice" data-testid="settings-reset-done">
            <span>{t('settings.resetDone')}</span>
            <Button size="xs" scheme="accent" onClick={() => location.reload()}>
              {t('settings.reload')}
            </Button>
          </div>
        )}
      </SectionBlock>
    </>
  );
}
