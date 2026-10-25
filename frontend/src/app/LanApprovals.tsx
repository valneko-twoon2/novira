// The prompt for a phone that asks to pair while the QR item's popover is closed: a toast with the phone's name and the
// number it shows, which this computer allows or refuses. It stays until answered (or until the request goes away);
// opening the popover takes it over, since the same request is listed there. Only on the page of the server's own
// computer: a page with no home network of its own gets no state, so nothing is asked.
import { useEffect, useRef } from 'react';
import { t } from '@/i18n';
import { useLan } from '@/state/lan';
import { toast, useToasts } from '@/state/toasts';
import { groupedNumber } from './LanPanel';

export function LanApprovals() {
  const pending = useLan((s) => s.state?.pending);
  const popoverOpen = useLan((s) => s.popoverOpen);
  const shown = useRef(new Map<string, number>());

  useEffect(() => {
    void useLan.getState().init();
  }, []);

  useEffect(() => {
    const live = new Set(popoverOpen ? [] : (pending ?? []).map((p) => p.id));
    for (const [id, toastId] of shown.current) {
      if (live.has(id)) continue;
      useToasts.getState().dismiss(toastId);
      shown.current.delete(id);
    }
    if (popoverOpen) return;
    for (const p of pending ?? []) {
      if (shown.current.has(p.id)) continue;
      const answer = (decide: 'approve' | 'deny') => () => {
        const { api, refresh } = useLan.getState();
        void api?.[decide](p.id).then(refresh);
      };
      const toastId = toast(
        {
          status: 'info',
          title: t('app.lan.wants', { name: p.label }),
          description: `${p.peer} · ${t('app.lan.confirm', { number: groupedNumber(p.confirm) })}`,
          actions: [
            { label: t('app.lan.allow'), run: answer('approve') },
            { label: t('app.lan.deny'), run: answer('deny') },
          ],
        },
        0,
      );
      shown.current.set(p.id, toastId);
    }
  }, [pending, popoverOpen]);

  return null;
}
