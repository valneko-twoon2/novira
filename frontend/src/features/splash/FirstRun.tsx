// The first-start screen: shown before the app has a backend, to choose the data folder and the folder novira's own
// ComfyUI is installed in. Each folder starts as the default and is changed in the shell's own folder dialog; "start"
// saves both and the app restarts to open them.
import { FolderOpen, Gear } from '@phosphor-icons/react';
import { useState } from 'react';
import { firstRun, type FirstRunInfo, type FolderKind } from '@/backend';
import { t } from '@/i18n';
import { LocaleRoot } from '@/i18n/LocaleRoot';
import { Button, ErrorBoundary, TooltipProvider } from '@/ui';
import { StartupCard } from './EnginePanel';
import { SkyBackdrop } from './SkyBackdrop';
import './splash.css';

const reason = (e: unknown) => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));

/** Shown while a data folder change from the Settings screen is carried out at start-up (the window is the only sign of it). */
function Moving() {
  return (
    <LocaleRoot>
      <TooltipProvider>
        <ErrorBoundary area="data move" variant="screen">
          <div className="sp" data-testid="data-moving">
            <SkyBackdrop />
            <div className="sp__center sp__center--wide">
              <div className="sp__logo">novira</div>
              <StartupCard icon={<Gear size={22} weight="duotone" />} heading={t('firstrun.moving.title')} testId="data-moving-card">
                <p>{t('firstrun.moving.body')}</p>
              </StartupCard>
            </div>
          </div>
        </ErrorBoundary>
      </TooltipProvider>
    </LocaleRoot>
  );
}

export function FirstRun({ initial }: { initial: FirstRunInfo }) {
  const [info, setInfo] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (call: () => Promise<FirstRunInfo | null | void>) => {
    setBusy(true);
    setFailure(null);
    try {
      const next = await call();
      if (next) setInfo(next);
    } catch (e) {
      setFailure(reason(e));
    } finally {
      setBusy(false);
    }
  };
  if (info.moving) return <Moving />;
  const rows: { kind: FolderKind; path: string; isDefault: boolean }[] = [
    { kind: 'data', path: info.dataDir, isDefault: info.dataIsDefault },
    { kind: 'comfyui', path: info.comfyuiDir, isDefault: info.comfyuiIsDefault },
  ];
  return (
    <LocaleRoot>
      <TooltipProvider>
        <ErrorBoundary area="first start" variant="screen">
          <div className="sp" data-testid="first-run">
            <SkyBackdrop />
            <div className="sp__center sp__center--wide">
              <div className="sp__logo">novira</div>
              <StartupCard icon={<Gear size={22} weight="duotone" />} heading={t('firstrun.title')} testId="first-run-card">
                {rows.map((row) => (
                  <div className="fr__row" key={row.kind}>
                    <div className="fr__label">{t(`firstrun.${row.kind}.label`)}</div>
                    <div className="fr__help">{t(`firstrun.${row.kind}.help`)}</div>
                    <code className="fr__path" data-testid={`first-run-${row.kind}-path`}>
                      {row.path}
                    </code>
                    <div className="fr__buttons">
                      <Button size="sm" variant="outline" leftIcon={<FolderOpen />} disabled={busy} onClick={() => void run(() => firstRun.choose(row.kind))} data-testid={`first-run-${row.kind}-choose`}>
                        {t('firstrun.choose')}
                      </Button>
                      {!row.isDefault && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => firstRun.reset(row.kind))} data-testid={`first-run-${row.kind}-reset`}>
                          {t('firstrun.useDefault')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {failure && (
                  <p className="fr__failure" role="alert" data-testid="first-run-failure">
                    {t('firstrun.failed', { reason: failure })}
                  </p>
                )}
                <Button variant="solid" scheme="invoke" disabled={busy} onClick={() => void run(() => firstRun.finish())} data-testid="first-run-start">
                  {t('firstrun.start')}
                </Button>
              </StartupCard>
            </div>
          </div>
        </ErrorBoundary>
      </TooltipProvider>
    </LocaleRoot>
  );
}
