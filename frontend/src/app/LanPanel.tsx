// What the side bar's QR item shows: the home network of this computer's own server. Pressing the item opens it (and
// trusts the network it is on, since pressing is the owner's choice); open, it shows the pairing code with the time left,
// the phones that ask to pair (with the number the phone shows too), and the paired ones. It has no close button: the
// popover only hides, and the home network closes by itself when unused. A button opens it again only after a failure.
import { Check, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { LanApi, LanResult, LanState, PairingCode } from '@/backend';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { useLan } from '@/state/lan';
import { Button, IconButton } from '@/ui';

/** The light border a reader needs around the code, in modules. */
const QUIET_ZONE = 4;

/** One path of every dark module, each a 1×1 square in module units. */
export function qrPath(link: Pick<PairingCode, 'size' | 'modules'>): string {
  let d = '';
  for (let i = 0; i < link.modules.length; i++) {
    if (link.modules[i] !== '1') continue;
    const x = (i % link.size) + QUIET_ZONE;
    const y = Math.floor(i / link.size) + QUIET_ZONE;
    d += `M${x} ${y}h1v1h-1z`;
  }
  return d;
}

/** `m:ss`. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The number a phone shows, in two groups of three. */
export function groupedNumber(n: string): string {
  return n.length === 6 ? `${n.slice(0, 3)} ${n.slice(3)}` : n;
}

export function LanPanel({ api, state }: { api: LanApi; state: LanState }) {
  const refresh = useLan((s) => s.refresh);
  const [code, setCode] = useState<{ code: PairingCode; madeAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const asked = useRef(false);

  const newCode = async () => {
    const made = await api.pairingCode();
    setCode(made ? { code: made, madeAt: Date.now() } : null);
  };
  // A code is made when the popover opens on an open home network, and a second counts down while one is shown.
  useEffect(() => {
    if (state.open && !code) void newCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `newCode` only reads `api`, which does not change here.
    }, [state.open]);
  useEffect(() => {
    if (!state.open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.open]);

  const fail = (result: LanResult) => {
    if (!result.ok) toast({ status: 'error', title: t('app.lan.failed', { message: result.message }) });
  };
  const act = async (call: () => Promise<LanResult>) => {
    setBusy(true);
    try {
      const result = await call();
      fail(result);
      await refresh();
      return result;
    } finally {
      setBusy(false);
    }
  };
  // Opens the home network; a network not trusted yet is trusted first, under the default name.
  const openLan = async () => {
    const result = await act(async () => {
      const first = await api.open();
      if (first.ok || first.code !== 'untrusted_network' || !first.gatewayMac) return first;
      const trusted = await api.trust(first.gatewayMac, t('app.lan.networkDefault'));
      return trusted.ok ? api.open() : trusted;
    });
    setFailed(!result.ok);
    if (result.ok) await newCode();
  };
  // Pressing the side bar item is the request to open: do it once when the panel appears on a closed network.
  const reachable = !!state.address && !!state.network.gatewayMac;
  useEffect(() => {
    // Open already, or closed from here later: not asked for again.
    if (state.open) asked.current = true;
    if (state.open || !reachable || asked.current) return;
    asked.current = true;
    void openLan();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per appearance; `openLan` only reads `api`.
  }, [state.open, reachable]);

  const left = code ? code.code.expiresIn - (now - code.madeAt) / 1000 : 0;
  const mac = state.network.gatewayMac;
  const closedReason = !state.address ? 'app.lan.noNetwork' : !mac ? 'app.lan.unknownNetwork' : null;

  return (
    <div className="lan" data-testid="lan-panel">
      {state.windowsPublic && (
        <p className="lan__warn" role="alert" data-testid="lan-public">
          {t('app.lan.public')}
        </p>
      )}
      {!state.open && (
        <>
          {closedReason ? (
            <p className="lan__note" data-testid="lan-reason">
              {t(closedReason)}
            </p>
          ) : (
            failed && (
              <Button scheme="invoke" disabled={busy} data-testid="lan-open" onClick={() => void openLan()}>
                {t('app.lan.open')}
              </Button>
            )
          )}
        </>
      )}
      {state.open && (
        <>
          {code && (
            <div className="lan__codebox">
              <svg
                className={`lan__code${left <= 0 ? ' is-expired' : ''}`}
                viewBox={`0 0 ${code.code.size + QUIET_ZONE * 2} ${code.code.size + QUIET_ZONE * 2}`}
                shapeRendering="crispEdges"
                role="img"
                aria-label={t('app.nav.homeLink')}
                data-testid="home-link-code"
              >
                <rect className="home-link__light" width={code.code.size + QUIET_ZONE * 2} height={code.code.size + QUIET_ZONE * 2} />
                <path className="home-link__dark" d={qrPath(code.code)} />
              </svg>
              {left > 0 ? (
                <span className="lan__left" data-testid="lan-expires">
                  {t('app.lan.timeLeft', { time: clock(left) })}
                </span>
              ) : (
                <Button size="xs" variant="outline" data-testid="lan-new-code" onClick={() => void newCode()}>
                  {t('app.lan.newCode')}
                </Button>
              )}
            </div>
          )}
          {state.pending.map((p) => (
            <div className="lan__item lan__item--ask" key={p.id} data-testid={`lan-pending-${p.id}`}>
              <div className="lan__who">
                <span className="lan__name">{p.label}</span>
                <span className="lan__peer">{p.peer}</span>
                <span className="lan__confirm">{t('app.lan.confirm', { number: groupedNumber(p.confirm) })}</span>
              </div>
              <Button scheme="invoke" size="xs" disabled={busy} data-testid={`lan-allow-${p.id}`} onClick={() => void act(() => api.approve(p.id))}>
                {t('app.lan.allow')}
              </Button>
              <Button size="xs" variant="outline" disabled={busy} data-testid={`lan-deny-${p.id}`} onClick={() => void act(() => api.deny(p.id))}>
                {t('app.lan.deny')}
              </Button>
            </div>
          ))}
          {state.devices.map((d) => (
            <div className="lan__item" key={d.id} data-testid={`lan-device-${d.id}`}>
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
                data-testid={`lan-revoke-${d.id}`}
                onClick={() => void act(() => api.revoke(d.id))}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
