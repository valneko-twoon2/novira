// The "away" tab of the side bar's QR item: the remote listener of this computer's own server, for its phones away from
// home over Tailscale. A switch turns it on or off (kept for the next start); on and not open, it says why (Tailscale
// missing or off, HTTPS certificates off). Open, a phone is added with a code it scans at home: it asks, this computer
// allows it after comparing the number, and the phone makes a passkey it signs in with from then on. The phones signed in
// now, the passkeys (each can be removed, which also ends its sessions) and the latest lines of the log are listed.
import { Check, Trash, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { LanApi, LanResult, PairingCode, RemoteState } from '@/backend';
import { getLocale, t } from '@/i18n';
import { toast } from '@/state/toasts';
import { useLan } from '@/state/lan';
import { Button, IconButton, PressAgainIconButton, Switch } from '@/ui';
import { clock, groupedNumber, qrPath } from './LanPanel';

/** The light border a reader needs around the code, in modules. */
const QUIET_ZONE = 4;
/** How many lines of the log are shown. */
const LOG_LINES = 5;

/** A time of the log or of a passkey's last use, short, in the screen's language. */
export function shortTime(iso: string, locale: string = getLocale()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function RemotePanel({ api, remote }: { api: LanApi; remote: RemoteState }) {
  const refresh = useLan((s) => s.refresh);
  const [code, setCode] = useState<{ code: PairingCode; madeAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [code]);
  // A code is no use once the listener closed.
  useEffect(() => {
    if (!remote.open) setCode(null);
  }, [remote.open]);

  const act = async (call: () => Promise<LanResult>) => {
    setBusy(true);
    try {
      const result = await call();
      if (!result.ok) toast({ status: 'error', title: t('app.remote.failed', { message: result.message }) });
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const newCode = async () => {
    const made = await api.remoteCode();
    setCode(made ? { code: made, madeAt: Date.now() } : null);
    await refresh();
  };

  const left = code ? code.code.expiresIn - (now - code.madeAt) / 1000 : 0;
  const side = code ? code.code.size + QUIET_ZONE * 2 : 0;

  return (
    <div className="lan" data-testid="remote-panel">
      <label className="lan__row lan__switch">
        <span className="lan__name">{t('app.remote.switch')}</span>
        <Switch
          checked={remote.enabled}
          disabled={busy}
          aria-label={t('app.remote.switch')}
          onChange={(on) => void act(() => (on ? api.remoteEnable() : api.remoteDisable()))}
        />
      </label>
      {remote.enabled && !remote.open && remote.problem && (
        <p className="lan__warn" role="alert" data-testid="remote-problem">
          {t(`app.remote.problem.${remote.problem}`, { message: remote.detail ?? '' })}
        </p>
      )}
      {remote.open && (
        <>
          <span className="lan__peer" data-testid="remote-name">
            {remote.name}
          </span>
          {code ? (
            <div className="lan__codebox">
              <svg
                className={`lan__code${left <= 0 ? ' is-expired' : ''}`}
                viewBox={`0 0 ${side} ${side}`}
                shapeRendering="crispEdges"
                role="img"
                aria-label={t('app.remote.enrol')}
                data-testid="remote-code"
              >
                <rect className="home-link__light" width={side} height={side} />
                <path className="home-link__dark" d={qrPath(code.code)} />
              </svg>
              {left > 0 ? (
                <span className="lan__left">{t('app.lan.timeLeft', { time: clock(left) })}</span>
              ) : (
                <Button size="xs" variant="outline" onClick={() => void newCode()}>
                  {t('app.lan.newCode')}
                </Button>
              )}
            </div>
          ) : (
            <Button scheme="invoke" disabled={busy} data-testid="remote-enrol" onClick={() => void newCode()}>
              {t('app.remote.enrol')}
            </Button>
          )}
          {remote.pending.map((p) => (
            <div className="lan__item lan__item--ask" key={p.id} data-testid={`remote-pending-${p.id}`}>
              <div className="lan__who">
                <span className="lan__name">{p.label}</span>
                <span className="lan__peer">{p.peer}</span>
                <span className="lan__confirm">{t('app.lan.confirm', { number: groupedNumber(p.confirm) })}</span>
              </div>
              <Button scheme="invoke" size="xs" disabled={busy} data-testid={`remote-allow-${p.id}`} onClick={() => {
                  setCode(null);
                  void act(() => api.remoteApprove(p.id));
                }}
              >
                {t('app.lan.allow')}
              </Button>
              <Button size="xs" variant="outline" disabled={busy} onClick={() => void act(() => api.remoteDeny(p.id))}>
                {t('app.lan.deny')}
              </Button>
            </div>
          ))}
          {remote.devices.map((d) => (
            <div className="lan__item" key={d.id} data-testid={`remote-device-${d.id}`}>
              <Check size={14} weight="bold" className="lan__ok" />
              <div className="lan__who">
                <span className="lan__name">{d.label}</span>
                <span className="lan__peer">{d.peer}</span>
              </div>
              <IconButton
                label={t('app.lan.revoke', { name: d.label })}
                icon={<X size={14} />}
                size="xs"
                tooltip={false}
                disabled={busy}
                onClick={() => void act(() => api.remoteRevoke(d.id))}
              />
            </div>
          ))}
        </>
      )}
      {remote.enabled && remote.passkeys.length > 0 && (
        <div className="lan__group">
          <span className="lan__heading">{t('app.remote.passkeys')}</span>
          {remote.passkeys.map((k) => (
            <div className="lan__item" key={k.id} data-testid={`remote-passkey-${k.id}`}>
              <div className="lan__who">
                <span className="lan__name">{k.label}</span>
                <span className="lan__peer">{k.lastUsedAt ? t('app.remote.used', { time: shortTime(k.lastUsedAt) }) : t('app.remote.unused')}</span>
              </div>
              <PressAgainIconButton
                label={t('app.remote.forget', { name: k.label })}
                againLabel={t('app.remote.forgetAgain', { name: k.label })}
                icon={<Trash size={14} />}
                size="xs"
                disabled={busy}
                data-testid={`remote-forget-${k.id}`}
                onConfirm={() => void act(() => api.remoteForget(k.id))}
              />
            </div>
          ))}
        </div>
      )}
      {remote.enabled && remote.log.length > 0 && (
        <div className="lan__group" data-testid="remote-log">
          <span className="lan__heading">{t('app.remote.log')}</span>
          {remote.log.slice(0, LOG_LINES).map((line, i) => (
            <span className={`lan__line${line.what === 'refused' ? ' is-refused' : ''}`} key={`${line.at}-${i}`}>
              {shortTime(line.at)} {line.label} {t(`app.remote.what.${line.what}`)} {line.peer}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
