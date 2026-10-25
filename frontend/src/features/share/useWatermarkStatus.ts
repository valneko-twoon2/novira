// The state of the watermark's files while the export dialog wants it: asked once, then every second until they are
// ready (they download in the background at app start).
import { useCallback, useEffect, useState } from 'react';
import { backend, type WatermarkStatus } from '@/backend';
import { devLog } from '@/state/devLog';

export const WATERMARK_POLL_MS = 1000;

/** Percent of a download, 0 to 100 (0 while the size is unknown). */
export function downloadPercent(status: WatermarkStatus): number {
  if (status.state !== 'downloading' || status.total <= 0) return 0;
  return Math.min(100, Math.floor((status.done / status.total) * 100));
}

/** The status while `active`; `retry` starts the download again. */
export function useWatermarkStatus(active: boolean): { status: WatermarkStatus | null; retry: () => void } {
  const [status, setStatus] = useState<WatermarkStatus | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      try {
        const next = await backend.watermarkStatus();
        if (stopped) return;
        setStatus(next);
        if (next.state === 'ready') return;
      } catch (e) {
        devLog('warn', 'watermark', `status: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!stopped) timer = setTimeout(() => void ask(), WATERMARK_POLL_MS);
    };
    void ask();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, tick]);

  const retry = useCallback(() => {
    backend
      .prepareWatermark()
      .catch((e: unknown) => devLog('warn', 'watermark', `retry: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => setTick((n) => n + 1));
  }, []);

  return { status, retry };
}
