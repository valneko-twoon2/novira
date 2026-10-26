// Settings → Engine: where the app keeps its data and where its image engine is installed (both can be changed), the ComfyUI package to
// download, how long to wait for ComfyUI to start, whether models are looked up on Civitai, and the extra folders scanned for models. The backend checks and saves
// each change; they apply at the next start, which a notice says.
import { FolderPlus, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { backend, hasNativeDialogs, type ComfyuiPackage, type EngineSettings, type EngineSettingsPatch } from '@/backend';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { Button, IconButton, Select, SliderNumber, Spinner, Switch } from '@/ui';
import { ComfyuiRow, DataDirRow } from './LocationRows';
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
        <DataDirRow engine={engine} busy={busy} run={run} />
        <ComfyuiRow engine={engine} busy={busy} run={run} />
      </SectionBlock>
      <SectionBlock title={t('settings.section.engineStart')}>
        <Row label={t('settings.engine.package.label')} help={t('settings.engine.package.help')} note={pendingPackage === null ? undefined : t('settings.engine.package.reinstall')}>
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
        <Row label={t('settings.engine.timeout.label')}>
          <div className="st-slider" data-testid="settings-engine-timeout">
            <SliderNumber value={timeout ?? engine.comfyuiStartTimeoutSecs} onChange={changeTimeout} {...TIMEOUT_RANGE} aria-label={t('settings.engine.timeout.label')} />
          </div>
        </Row>
      </SectionBlock>
      <SectionBlock title={t('settings.section.models')}>
        <Row label={t('settings.engine.civitai.label')} help={t('settings.engine.civitai.help')}>
          <Switch
            checked={engine.civitaiLookup}
            disabled={busy}
            onChange={(v) => patch({ civitaiLookup: v })}
            aria-label={t('settings.engine.civitai.label')}
            data-testid="settings-engine-civitai"
          />
        </Row>
        <Row
          label={t('settings.engine.modelRoots.label')}
          note={engine.modelRoots.length === 0 ? t('settings.engine.modelRoots.none') : undefined}
          detail={
            engine.modelRoots.length > 0 && (
              <ul className="st-roots" data-testid="settings-engine-roots">
                {engine.modelRoots.map((root, i) => (
                  <li key={root} className="st-roots__item">
                    <code className="st-path">{root}</code>
                    <IconButton size="xs" label={t('settings.engine.modelRoots.remove')} icon={<X />} disabled={busy} onClick={() => void run(() => backend.removeModelRoot(i))} data-testid="settings-engine-root-remove" />
                  </li>
                ))}
              </ul>
            )
          }
        >
          {hasNativeDialogs() ? (
            <Button size="sm" variant="outline" leftIcon={<FolderPlus />} isLoading={busy} onClick={() => void run(() => backend.addModelRoot())} data-testid="settings-engine-root-add">
              {t('settings.engine.modelRoots.add')}
            </Button>
          ) : (
            <span className="st-row__help" data-testid="settings-engine-root-desktop-only">
              {t('common.desktopOnly')}
            </span>
          )}
        </Row>
      </SectionBlock>
    </>
  );
}
