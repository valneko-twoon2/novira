// @vitest-environment jsdom
// The away tab of the QR item against the mock's remote listener: the switch, why it cannot open, adding a phone with a
// code it scans, the passkeys with their removal (pressed twice), the log, and the tab itself only where there is one.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanApi } from '@/backend';
import { createMockLan } from '@/backend/mock/mockLan';
import { t } from '@/i18n';
import { resetLan, useLan } from '@/state/lan';

const { getLanApi } = vi.hoisted(() => ({ getLanApi: vi.fn<() => Promise<LanApi | null>>() }));
vi.mock('@/backend', async (orig) => ({ ...(await orig<typeof import('@/backend')>()), getLanApi }));

const { NetworkButton } = await import('./NetworkButton');
const { RemotePanel, shortTime } = await import('./RemotePanel');

/** The panel over `lan`, re-rendered from the store as it is read again. */
function Panel({ lan }: { lan: LanApi }) {
  const remote = useLan((s) => s.remote);
  return remote ? <RemotePanel api={lan} remote={remote} /> : null;
}

async function show(lan: LanApi) {
  getLanApi.mockResolvedValue(lan);
  await act(async () => {
    await useLan.getState().init();
    render(<Panel lan={lan} />);
  });
}

async function click(element: Element) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function refresh() {
  await act(async () => {
    await useLan.getState().refresh();
  });
}

describe('RemotePanel', { tags: [] }, () => {
  beforeEach(() => resetLan());
  afterEach(() => {
    cleanup();
    resetLan();
    getLanApi.mockReset();
  });

  it('turns the remote listener on with the switch and off again', { tags: ['state-transition'] }, async () => {
    const lan = createMockLan('open', Date.now, 'off');
    await show(lan);
    expect(screen.queryByTestId('remote-enrol')).toBeNull();
    await click(screen.getByRole('switch'));
    expect((await lan.remoteState())?.enabled).toBe(true);
    expect((await screen.findByTestId('remote-name')).textContent).toBe('pc.tail1234.ts.net');
    await click(screen.getByRole('switch'));
    expect((await lan.remoteState())?.enabled).toBe(false);
    await waitFor(() => expect(screen.queryByTestId('remote-name')).toBeNull());
  });

  it('says why it cannot open while it is on', { tags: ['condition'] }, async () => {
    const lan = createMockLan('open', Date.now, 'missing');
    await show(lan);
    await click(screen.getByRole('switch'));
    expect((await screen.findByTestId('remote-problem')).textContent).toContain('Tailscale');
    expect(screen.queryByTestId('remote-enrol')).toBeNull();
  });

  it(
    'adds a phone: a code, its request with the number, and its passkey once allowed',
    { tags: ['scenario', 'state-transition'] },
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const lan = createMockLan('open', Date.now, 'off');
        await show(lan);
        await click(screen.getByRole('switch'));
        await click(await screen.findByTestId('remote-enrol'));
        const code = await screen.findByTestId('remote-code');
        expect(code.getAttribute('viewBox')).toBe('0 0 29 29');
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2100);
        });
        await refresh();
        const asking = (await lan.remoteState())?.pending[0];
        const row = await screen.findByTestId(`remote-pending-${asking?.id}`);
        expect(row.textContent).toContain('iPhone');
        expect(row.textContent).toMatch(/\d{3} \d{3}/);
        await click(screen.getByTestId(`remote-allow-${asking?.id}`));
        expect((await lan.remoteState())?.passkeys).toHaveLength(1);
        expect(screen.queryByTestId('remote-code')).toBeNull();
        expect((await screen.findByTestId('remote-log')).textContent).toContain('iPhone');
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('removes a passkey only on a second press', { tags: ['state-transition'] }, async () => {
    const lan = createMockLan('open', Date.now, 'on');
    await show(lan);
    const forget = await screen.findByTestId('remote-forget-k0');
    await click(forget);
    expect((await lan.remoteState())?.passkeys).toHaveLength(1);
    await click(screen.getByTestId('remote-forget-k0'));
    expect((await lan.remoteState())?.passkeys).toEqual([]);
    await waitFor(() => expect(screen.queryByTestId('remote-passkey-k0')).toBeNull());
  });

  it('writes a time short, in the screen language, and leaves a bad one as it is', { tags: ['error-guessing', 'equivalence'] }, () => {
    expect(shortTime('2026-11-03T18:20:00+00:00', 'en-US')).toMatch(/11\/\d/);
    expect(shortTime('nope', 'ja')).toBe('nope');
  });
});

describe('the network item with a remote listener', { tags: [] }, () => {
  beforeEach(() => resetLan());
  afterEach(() => {
    cleanup();
    resetLan();
    getLanApi.mockReset();
  });

  const mount = async (remote: 'none' | 'off') => {
    getLanApi.mockResolvedValue(createMockLan('open', Date.now, remote));
    await act(async () => {
      render(<NetworkButton />);
    });
    return await screen.findByTestId('home-link-open');
  };
  const choose = async (name: string) => {
    fireEvent.keyDown(await screen.findByTestId('home-link-open'), { key: 'Enter' });
    await click(await screen.findByRole('menuitem', { name }));
  };

  it('opens the home dialog at once when the server has no remote listener', { tags: ['condition'] }, async () => {
    await click(await mount('none'));
    expect(await screen.findByTestId('home-link-code')).not.toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog').textContent).toContain(t('app.lan.menuHome'));
  });

  it('asks home or away first when it has one, and each choice is a dialog of its own', { tags: ['condition'] }, async () => {
    await mount('off');
    await choose(t('app.lan.menuHome'));
    expect(await screen.findByTestId('home-link-code')).not.toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByRole('dialog').textContent).toContain(t('app.lan.menuHome'));
    await click(screen.getByRole('button', { name: t('common.close') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await choose(t('app.lan.menuAway'));
    expect(await screen.findByRole('switch', { name: t('app.remote.switch') })).not.toBeNull();
    expect(screen.queryByTestId('home-link-code')).toBeNull();
    expect(screen.getByRole('dialog').textContent).toContain(t('app.lan.menuAway'));
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
