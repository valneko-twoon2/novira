// The side bar's QR item: on the page novira-server serves to its own computer, the home network of this
// computer: open or closed, the pairing code a phone scans, the phones asking to pair and the paired ones (`LanPanel`).
// Absent everywhere else (the desktop app, a phone, a page that cannot read the state).
import { QrCode } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { t } from '@/i18n';
import { useLan } from '@/state/lan';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/ui';
import { LanPanel } from './LanPanel';

export function HomeLinkButton() {
  const api = useLan((s) => s.api);
  const state = useLan((s) => s.state);
  const waiting = state?.pending.length ?? 0;
  useEffect(() => {
    void useLan.getState().init();
  }, []);
  if (!api || !state) return null;
  return (
    <Popover onOpenChange={(open) => useLan.getState().setPopoverOpen(open)}>
      <Tooltip content={t('app.nav.homeLink')} side="right">
        <PopoverTrigger asChild>
          <button type="button" className="sidenav__tab" aria-label={t('app.nav.homeLink')} data-testid="home-link-open">
            <QrCode size={22} weight="regular" />
            <span className="sidenav__label">{t('app.tabs.short.homeLink')}</span>
            {waiting > 0 && <span className="sidenav__count">{waiting}</span>}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="right" align="end" className="lan-popover">
        <LanPanel api={api} state={state} />
      </PopoverContent>
    </Popover>
  );
}
