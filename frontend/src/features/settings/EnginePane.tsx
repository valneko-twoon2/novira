// Settings → Engine: where the app keeps its data and which image engine it uses (shown only), the ComfyUI package to
// download, how long to wait for ComfyUI to start, whether models are looked up on Civitai, and the extra folders scanned for models. The backend checks and saves
// each change; they apply at the next start, which a notice says.
import { FolderPlus, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { backend, hasNativeDialogs, type ComfyuiPackage, type EngineSettings, type EngineSettingsPatch } from '@/backend';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { Button, IconButton, Select, SliderNumber, Spinner, Switch } from '@/ui';
import { Row, SectionBlock } from './settingsLayout';

/** How long the timeout slider rests before its value is saved, in milliseconds. */
const SAVE_DELAY_MS = 500;
/** The start timeout the backend takes, in seconds. */
const TIMEOUT_RANGE = { min: 30, max: 1800, step: 10 } as const;
const PACKAGES: ComfyuiPackage[] = ['nvidia', 'amd'];

const failed = (err: unknown) => toast({ status: 'error', title: t('settings.engine.failed'), description: err instanceof Error ? err.message : String(err) });

export function EnginePane() {
  const [engine, setEngine] = useState<EngineSettings | null>(null);
  const [busy, setBusy] = useState(false);
  // A package chosen in the select that waits for the user to confirm the reinstall; null when there is none.
  const [pendingPackage, setPendingPackage] = useState<ComfyuiPackage | null>(null);
  const [timeout, setTimeoutSecs] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);
  useEffect(() => {
    let live = true;
    backend.engineSettings().then((e) => live && setEngine(e), failed);
    return () => {
      live = false;
    };
  }, []);
  const run = async (change: () => Promise<EngineSettings | null>) => {
    setBusy(true);
    try {
      const next = await change();
      if (next) setEngine(next);
    } catch (err) {
      failed(err);
    } finally {
      setBusy(false);
    }
  };
  const patch = (p: EngineSettingsPatch) => void run(() => backend.setEngineSettings(p));
  // The slider moves at once; the value is saved once it rests.
  const changeTimeout = (secs: number) => {
    setTimeoutSecs(secs);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setTimeoutSecs(null);
      patch({ comfyuiStartTimeoutSecs: Math.round(secs) });
    }, SAVE_DELAY_MS);
  };

  if (!engine) {
    return (
      <div className="st-loading">
        <Spinner size={18} />
      </div>
    );
  }
  // An install of unknown origin is taken to be the saved package, as the backend does. Another package reinstalls
  // ComfyUI at the next start (a large download), so while an install exists the change waits for a confirmation.
  const installedFrom = engine.installedComfyuiPackage ?? engine.comfyuiPackage;
  const choosePackage = (next: ComfyuiPackage) => {
    if (engine.comfyuiInstalled && next !== installedFrom) {
      setPendingPackage(next);
      return;
    }
    setPendingPackage(null);
    patch({ comfyuiPackage: next });
  };
  const confirmPackage = () => {
    const next = pendingPackage;
    if (next === null) return;
    // The select keeps the chosen package until the backend has saved it.
    void run(() => backend.setEngineSettings({ comfyuiPackage: next })).finally(() => setPendingPackage(null));
  };
  return (
    <>
      {engine.restartNeeded && (
        <div className="st-notice" data-testid="settings-engine-restart">
          <span>{t('settings.engine.restart')}</span>
        </div>
      )}
      <SectionBlock title={t('settings.section.engineWhere')}>
        <Row label={t('settings.engine.dataDir.label')} help={t('settings.engine.dataDir.help')}>
          <code className="st-path" data-testid="settings-engine-data-dir">
            {engine.dataDir}
          </code>
        </Row>
        <Row label={t('settings.engine.comfyui.label')} help={engine.comfyuiMode === 'owned' ? t('settings.engine.comfyui.ownedHelp') : t('settings.engine.comfyui.otherHelp')}>
          <span className={engine.comfyuiMode === 'owned' ? 'st-row__help' : 'st-path'} data-testid="settings-engine-mode">
            {engine.comfyuiMode === 'url' ? engine.comfyuiUrl : engine.comfyuiMode === 'folder' ? engine.comfyuiDir : t('settings.engine.comfyui.owned')}
          </span>
        </Row>
      </SectionBlock>
      <SectionBlock title={t('settings.section.engineStart')}>
        <Row label={t('settings.engine.package.label')} help={pendingPackage === null ? t('settings.engine.package.help') : t('settings.engine.package.reinstall')}>
          <div className="st-inline">
            <Select
              className="st-select"
              value={pendingPackage ?? engine.comfyuiPackage}
              onChange={choosePackage}
              options={PACKAGES.map((p) => ({ value: p, label: t(`settings.engine.package.${p}`) }))}
              disabled={busy}
              aria-label={t('settings.engine.package.label')}
              data-testid="settings-engine-package"
            />
            {pendingPackage !== null && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setPendingPackage(null)} data-testid="settings-engine-package-cancel">
                  {t('common.cancel')}
                </Button>
                <Button size="sm" scheme="accent" disabled={busy} onClick={confirmPackage} data-testid="settings-engine-package-confirm">
                  {t('settings.engine.package.confirm')}
                </Button>
              </>
            )}
          </div>
        </Row>
        <Row label={t('settings.engine.timeout.label')} help={t('settings.engine.timeout.help')}>
          <div className="st-slider" data-testid="settings-engine-timeout">
            <SliderNumber value={timeout ?? engine.comfyuiStartTimeoutSecs} onChange={changeTimeout} {...TIMEOUT_RANGE} aria-label={t('settings.engine.timeout.label')} />
          </div>
        </Row>
      </SectionBlock>
      <SectionBlock title={t('settings.engine.civitai.label')}>
        <Row label={t('settings.engine.civitai.label')} help={t('settings.engine.civitai.help')}>
          <Switch
            checked={engine.civitaiLookup}
            disabled={busy}
            onChange={(v) => patch({ civitaiLookup: v })}
            aria-label={t('settings.engine.civitai.label')}
            data-testid="settings-engine-civitai"
          />
        </Row>
      </SectionBlock>
      <SectionBlock title={t('settings.engine.modelRoots.label')}>
        <p className="st-row__help st-pane__note">{t('settings.engine.modelRoots.help')}</p>
        {engine.modelRoots.length === 0 && <p className="st-row__help">{t('settings.engine.modelRoots.none')}</p>}
        <ul className="st-roots" data-testid="settings-engine-roots">
          {engine.modelRoots.map((root, i) => (
            <li key={root} className="st-roots__item">
              <code className="st-path">{root}</code>
              <IconButton size="xs" label={t('settings.engine.modelRoots.remove')} icon={<X />} disabled={busy} onClick={() => void run(() => backend.removeModelRoot(i))} data-testid="settings-engine-root-remove" />
            </li>
          ))}
        </ul>
        {hasNativeDialogs() ? (
          <div>
            <Button size="sm" variant="outline" leftIcon={<FolderPlus />} isLoading={busy} onClick={() => void run(() => backend.addModelRoot())} data-testid="settings-engine-root-add">
              {t('settings.engine.modelRoots.add')}
            </Button>
          </div>
        ) : (
          <p className="st-row__help" data-testid="settings-engine-root-desktop-only">
            {t('common.desktopOnly')}
          </p>
        )}
      </SectionBlock>
    </>
  );
}
