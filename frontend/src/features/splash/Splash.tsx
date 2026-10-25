// The start-up screen: the logo, and while the image engine (ComfyUI with its Python) is being set up, which step it is on.
import { WarningCircle } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useEngine } from '@/state/engine';
import { Button } from '@/ui';
import { EnginePanel, StartupCard, WaitCard } from './EnginePanel';
import { SkyBackdrop } from './SkyBackdrop';
import './splash.css';

/** `preparing`: the engine is about to start or the node list is being read, which the gate waits for. `onOpen` is offered on an engine error and while the engine downloads. */
export function Splash({ onOpen, preparing = false }: { onOpen: () => void; preparing?: boolean }) {
  const status = useEngine((s) => s.status);
  return (
    <div className="sp" data-testid="splash">
      <SkyBackdrop />
      <div className="sp__center">
        <div className="sp__logo">novira</div>
        {status.state === 'error' ? (
          <StartupCard icon={<WarningCircle size={22} weight="fill" />} heading={t('engine.title.error')} tone="error" testId="splash-error">
            <p className="ep__message">{status.message}</p>
            <Button variant="solid" scheme="invoke" onClick={onOpen} data-testid="splash-open">
              {t('splash.open')}
            </Button>
          </StartupCard>
        ) : status.state === 'downloading' || status.state === 'extracting' || status.state === 'starting' ? (
          <>
            <EnginePanel status={status} />
            {/* The download goes on in the background: the app opens with its banner showing the progress. */}
            {status.state === 'downloading' && (
              <Button variant="outline" onClick={onOpen} data-testid="splash-open-later">
                {t('splash.open')}
              </Button>
            )}
          </>
        ) : (
          <WaitCard heading={t(preparing ? 'splash.wait.heading.preparing' : 'splash.wait.heading.loading')} sub={t(preparing ? 'splash.preparing' : 'splash.wait.sub.loading')} />
        )}
      </div>
    </div>
  );
}
