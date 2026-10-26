// Settings → Engine: where the data folder and novira's own ComfyUI are, and the buttons that change them. The folder
// shows under the label; a change applies at the next start, and the row says so.
import { FolderOpen } from '@phosphor-icons/react';
import { useState } from 'react';
import { backend, hasNativeDialogs, type EngineSettings } from '@/backend';
import { t } from '@/i18n';
import { Button, Modal } from '@/ui';
import { Row } from './settingsLayout';

type Run = (change: () => Promise<EngineSettings | null>) => Promise<void>;

export function DataDirRow({
  engine,
  busy,
  run,
}: {
  engine: EngineSettings;
  busy: boolean;
  run: Run;
}) {
  const [asking, setAsking] = useState(false);
  const canChange = engine.dataDirChangeable && hasNativeDialogs();
  const choose = (moveData: boolean) => {
    setAsking(false);
    void run(() => backend.chooseDataDir(moveData));
  };
  return (
    <Row
      label={t('settings.engine.dataDir.label')}
      help={canChange ? undefined : t('settings.engine.dataDir.fixedHelp')}
      detail={
        <>
          <code className="st-path" data-testid="settings-engine-data-dir">
            {engine.dataDir}
          </code>
          {engine.dataDirNext && (
            <span className="st-row__help" data-testid="settings-engine-data-dir-next">
              {t(
                engine.dataDirMoves
                  ? 'settings.engine.dataDir.nextMove'
                  : 'settings.engine.dataDir.nextUse',
                { path: engine.dataDirNext },
              )}
            </span>
          )}
          {engine.dataDirNote && (
            <span
              className="st-row__help st-row__warn"
              role="alert"
              data-testid="settings-engine-data-dir-note"
            >
              {t('settings.engine.dataDir.note', { reason: engine.dataDirNote })}
            </span>
          )}
        </>
      }
    >
      {canChange && (
        <div className="st-inline">
          {engine.dataDirNext && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void run(() => backend.cancelDataDirChange())}
              data-testid="settings-engine-data-dir-cancel"
            >
              {t('settings.engine.dataDir.cancel')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            leftIcon={<FolderOpen />}
            disabled={busy}
            onClick={() => setAsking(true)}
            data-testid="settings-engine-data-dir-change"
          >
            {t('settings.engine.dataDir.change')}
          </Button>
        </div>
      )}
      <Modal
        open={asking}
        onOpenChange={setAsking}
        title={t('settings.engine.dataDir.dialog.title')}
        size="md"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={() => choose(false)}
              data-testid="settings-engine-data-dir-use"
            >
              {t('settings.engine.dataDir.dialog.use')}
            </Button>
            <Button
              scheme="accent"
              onClick={() => choose(true)}
              data-testid="settings-engine-data-dir-move"
            >
              {t('settings.engine.dataDir.dialog.move')}
            </Button>
          </>
        }
      >
        <dl className="st-choices">
          <dt>{t('settings.engine.dataDir.dialog.move')}</dt>
          <dd>{t('settings.engine.dataDir.dialog.moveHelp')}</dd>
          <dt>{t('settings.engine.dataDir.dialog.use')}</dt>
          <dd>{t('settings.engine.dataDir.dialog.useHelp')}</dd>
        </dl>
      </Modal>
    </Row>
  );
}

export function ComfyuiRow({
  engine,
  busy,
  run,
}: {
  engine: EngineSettings;
  busy: boolean;
  run: Run;
}) {
  const owned = engine.comfyuiMode === 'owned';
  const canChange = owned && hasNativeDialogs();
  const next =
    engine.comfyuiInstallDir && engine.comfyuiInstallDir !== engine.comfyuiRoot
      ? engine.comfyuiInstallDir
      : null;
  return (
    <Row
      label={t('settings.engine.comfyui.label')}
      help={owned ? t('settings.engine.comfyui.ownedHelp') : t('settings.engine.comfyui.otherHelp')}
      detail={
        <>
          <code className="st-path" data-testid="settings-engine-mode">
            {engine.comfyuiMode === 'url'
              ? engine.comfyuiUrl
              : engine.comfyuiMode === 'folder'
                ? engine.comfyuiDir
                : engine.comfyuiRoot}
          </code>
          {owned && next && (
            <span className="st-row__help" data-testid="settings-engine-comfyui-next">
              {t('settings.engine.comfyui.next', { path: next })}
            </span>
          )}
        </>
      }
    >
      {canChange && (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<FolderOpen />}
          disabled={busy}
          onClick={() => void run(() => backend.chooseComfyuiInstallDir())}
          data-testid="settings-engine-comfyui-change"
        >
          {t('settings.engine.comfyui.change')}
        </Button>
      )}
    </Row>
  );
}
