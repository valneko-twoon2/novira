// Settings → Engine: where the data folder and novira's own ComfyUI are, and the buttons that change them. A change
// applies at the next start, and the row says so.
import { FolderOpen } from '@phosphor-icons/react';
import { useState } from 'react';
import { backend, hasNativeDialogs, type EngineSettings } from '@/backend';
import { t } from '@/i18n';
import { Button, Modal } from '@/ui';
import { Row } from './settingsLayout';

type Run = (change: () => Promise<EngineSettings | null>) => Promise<void>;

export function DataDirRow({ engine, busy, run }: { engine: EngineSettings; busy: boolean; run: Run }) {
  const [asking, setAsking] = useState(false);
  const canChange = engine.dataDirChangeable && hasNativeDialogs();
  const choose = (moveData: boolean) => {
    setAsking(false);
    void run(() => backend.chooseDataDir(moveData));
  };
  return (
    <Row label={t('settings.engine.dataDir.label')} help={canChange ? t('settings.engine.dataDir.help') : t('settings.engine.dataDir.fixedHelp')}>
      <div className="st-location">
        <code className="st-path" data-testid="settings-engine-data-dir">
          {engine.dataDir}
        </code>
        {engine.dataDirNext && (
          <p className="st-row__help" data-testid="settings-engine-data-dir-next">
            {t(engine.dataDirMoves ? 'settings.engine.dataDir.nextMove' : 'settings.engine.dataDir.nextUse', { path: engine.dataDirNext })}
          </p>
        )}
        {engine.dataDirNote && (
          <p className="st-row__help" role="alert" data-testid="settings-engine-data-dir-note">
            {t('settings.engine.dataDir.note', { reason: engine.dataDirNote })}
          </p>
        )}
        {canChange && (
          <div className="st-inline">
            <Button size="sm" variant="outline" leftIcon={<FolderOpen />} disabled={busy} onClick={() => setAsking(true)} data-testid="settings-engine-data-dir-change">
              {t('settings.engine.dataDir.change')}
            </Button>
            {engine.dataDirNext && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => backend.cancelDataDirChange())} data-testid="settings-engine-data-dir-cancel">
                {t('settings.engine.dataDir.cancel')}
              </Button>
            )}
          </div>
        )}
      </div>
      <Modal
        open={asking}
        onOpenChange={setAsking}
        title={t('settings.engine.dataDir.dialog.title')}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="outline" onClick={() => choose(false)} data-testid="settings-engine-data-dir-use">
              {t('settings.engine.dataDir.dialog.use')}
            </Button>
            <Button scheme="accent" onClick={() => choose(true)} data-testid="settings-engine-data-dir-move">
              {t('settings.engine.dataDir.dialog.move')}
            </Button>
          </>
        }
      >
        <p className="st-row__help">{t('settings.engine.dataDir.dialog.moveHelp')}</p>
        <p className="st-row__help">{t('settings.engine.dataDir.dialog.useHelp')}</p>
      </Modal>
    </Row>
  );
}

export function ComfyuiRow({ engine, busy, run }: { engine: EngineSettings; busy: boolean; run: Run }) {
  const owned = engine.comfyuiMode === 'owned';
  const canChange = owned && hasNativeDialogs();
  const next = engine.comfyuiInstallDir && engine.comfyuiInstallDir !== engine.comfyuiRoot ? engine.comfyuiInstallDir : null;
  return (
    <Row label={t('settings.engine.comfyui.label')} help={owned ? t('settings.engine.comfyui.ownedHelp') : t('settings.engine.comfyui.otherHelp')}>
      <div className="st-location">
        <code className="st-path" data-testid="settings-engine-mode">
          {engine.comfyuiMode === 'url' ? engine.comfyuiUrl : engine.comfyuiMode === 'folder' ? engine.comfyuiDir : engine.comfyuiRoot}
        </code>
        {owned && next && (
          <p className="st-row__help" data-testid="settings-engine-comfyui-next">
            {t('settings.engine.comfyui.next', { path: next })}
          </p>
        )}
        {canChange && (
          <div className="st-inline">
            <Button size="sm" variant="outline" leftIcon={<FolderOpen />} disabled={busy} onClick={() => void run(() => backend.chooseComfyuiInstallDir())} data-testid="settings-engine-comfyui-change">
              {t('settings.engine.comfyui.change')}
            </Button>
            {engine.comfyuiInstallDir && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => backend.resetComfyuiInstallDir())} data-testid="settings-engine-comfyui-reset">
                {t('settings.engine.comfyui.reset')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Row>
  );
}
