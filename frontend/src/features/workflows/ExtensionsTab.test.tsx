// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { PACK_CATALOG } from '@/state/comfy/packCatalog';
import { useRegistry } from '@/state/comfy/registry';
import { TooltipProvider } from '@/ui';
import { ExtensionsTab } from './ExtensionsTab';

beforeEach(() => backend.setStepDelay(0));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useNodePacks.setState({ packs: null });
  useRegistry.setState({ nodes: null, loading: false, error: null });
});

const show = () =>
  render(
    <TooltipProvider>
      <ExtensionsTab />
    </TooltipProvider>,
  );

/** Opens the detail panel of the card whose name contains `name`. */
async function openCard(name: string) {
  await waitFor(() => expect(useNodePacks.getState().packs).not.toBeNull());
  const card = await waitFor(() => {
    const found = screen.getAllByTestId('extension-item').find((c) => c.textContent?.includes(name));
    expect(found).toBeTruthy();
    return found!;
  });
  fireEvent.click(card);
  return screen.findByTestId('extension-detail');
}

describe('extension manager', () => {
  it('lets the list on the left be made wider or narrower, within limits', () => {
    show();
    const handle = screen.getByTestId('ex-rail-handle');
    const before = Number(handle.getAttribute('aria-valuenow'));
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(Number(handle.getAttribute('aria-valuenow'))).toBe(before + 16);
    for (let i = 0; i < 40; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(Number(handle.getAttribute('aria-valuenow'))).toBe(480);
  });
  it('lists every extension novira can install and the ones found in ComfyUI, each with its author', async () => {
    show();
    await openCard('comfyui-mock-preview');
    const cards = screen.getAllByTestId('extension-item');
    expect(cards.length).toBeGreaterThanOrEqual(PACK_CATALOG.length);
    const impact = cards.find((c) => c.textContent?.includes('ComfyUI-Impact-Pack'))!;
    expect(impact.querySelector('[data-testid="extension-card-author"]')!.textContent).toContain('ltdrdata');
    // A pack put there by hand is listed too, and says it came another way.
    expect(cards.find((c) => c.textContent?.includes('comfyui-mock-preview'))!.textContent).toContain(t('workflows.packs.manage.custom'));
    // Narrow the list by state and by search.
    fireEvent.click(screen.getByTestId('ex-cat-installed'));
    const installed = screen.getAllByTestId('extension-item');
    expect(installed.length).toBeLessThan(cards.length);
    fireEvent.change(screen.getByTestId('ex-search'), { target: { value: 'nothing-like-this' } });
    console.log(JSON.stringify(useNodePacks.getState().packs), screen.queryAllByText(t('workflows.packs.unavailable')).length);
    expect(screen.queryAllByTestId('extension-item')).toHaveLength(0);
    expect(screen.getByText(t('workflows.packs.mgr.empty'))).toBeTruthy();
  });

  it('browses the registry: most downloaded first, with downloads, installs from the card, shows more on request and sorts by name', async () => {
    // Scrolling the end of the list into view adds the next page.
    const watchers: ((e: { isIntersecting: boolean }[]) => void)[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
          watchers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    show();
    await waitFor(() => expect(screen.getAllByTestId('extension-item')[0]!.textContent).toContain('ComfyUI-KJNodes'));
    const first = screen.getAllByTestId('extension-item')[0]!;
    expect(first.textContent).toContain((4_554_755).toLocaleString());
    // Only a page of cards is drawn; the rest comes on request.
    expect(screen.getAllByTestId('extension-item').length).toBe(60);
    expect(screen.queryByText(/さらに表示|Show more/)).toBeNull();
    await waitFor(() => expect(watchers.length).toBeGreaterThan(0));
    act(() => watchers.at(-1)!([{ isIntersecting: true }]));
    expect(screen.getAllByTestId('extension-item').length).toBeGreaterThan(60);
    vi.unstubAllGlobals();
    // A card installs without opening the detail panel.
    const card = screen.getAllByTestId('extension-item').find((c) => c.textContent?.includes('ComfyUI-Mock-1'))!;
    fireEvent.click(card.querySelector('[data-testid="extension-card-install"]')!);
    await waitFor(() => expect(useNodePacks.getState().jobs['https://github.com/mockpub1/ComfyUI-Mock-1']).toBeTruthy());
    expect(screen.queryByTestId('extension-detail')).toBeNull();
    fireEvent.keyDown(screen.getAllByLabelText(t('workflows.packs.mgr.sort.label')).find((el) => el.getAttribute('role') === 'combobox')!, { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: t('workflows.packs.mgr.sort.name') }));
    await waitFor(() => expect(screen.getAllByTestId('extension-item')[0]!.textContent).not.toContain('ComfyUI-KJNodes'));
  });

  it('marks an installed extension whose registry version is newer, filters them and updates from the card', async () => {
    show();
    await waitFor(() => expect(screen.getByTestId('ex-cat-updatable').textContent).toContain('1'));
    fireEvent.click(screen.getByTestId('ex-cat-updatable'));
    const cards = screen.getAllByTestId('extension-item');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.textContent).toContain('ComfyUI_IPAdapter_plus');
    expect(cards[0]!.querySelector('[data-testid="extension-card-update"]')).not.toBeNull();
  });

  it('says so, and still lists the suggested and installed packs, when the registry cannot be read', async () => {
    vi.spyOn(backend, 'registryNodes').mockRejectedValue(new Error('offline'));
    show();
    expect(await screen.findByTestId('registry-failed')).toBeTruthy();
    await openCard('ComfyUI-Impact-Pack');
    expect(screen.getAllByTestId('extension-item').length).toBeLessThan(60);
  });

  it('shows the licence and the author of a suggested extension and of one looked up on GitHub', async () => {
    vi.spyOn(backend, 'nodePacks').mockResolvedValue({
      available: true,
      comfyVersion: '0.3.50',
      restartNeeded: false,
      installed: [{ folder: 'ComfyUI-Fancy', url: 'https://github.com/someone/ComfyUI-Fancy', version: null }],
    });
    show();
    const detail = await openCard('ComfyUI-Impact-Pack');
    expect(detail.querySelector('[data-testid="extension-license"]')!.textContent).toBe('GPL-3.0');
    expect(detail.querySelector('[data-testid="extension-author"]')!.textContent).toBe('ltdrdata');
    // An extension outside the catalog gets its licence from GitHub.
    const other = await openCard('ComfyUI-Fancy');
    await waitFor(() => expect(other.querySelector('[data-testid="extension-license"]')!.textContent).toBe('MIT'));
    expect(other.querySelector('[data-testid="extension-author"]')!.textContent).toBe('someone');
  });

  it('installs an extension from any GitHub address and refuses an address that is not one', async () => {
    show();
    const input = (await screen.findByTestId('wf-pack-url')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://example.com/a/b' } });
    expect(screen.getByText(t('workflows.packs.mgr.addInvalid'))).toBeTruthy();
    expect(screen.getByTestId('wf-pack-url-install').hasAttribute('disabled')).toBe(true);
    fireEvent.change(input, { target: { value: 'https://github.com/someone/ComfyUI-Fancy' } });
    fireEvent.click(screen.getByTestId('wf-pack-url-install'));
    await waitFor(() => expect(useNodePacks.getState().jobs['https://github.com/someone/ComfyUI-Fancy']).toBeTruthy());
  });

  it('shows the version of an extension and of ComfyUI, and no version control for a repository without tags', async () => {
    show();
    const ipa = await openCard('ComfyUI_IPAdapter_plus');
    expect(ipa.querySelector('[data-testid="extension-version"]')!.textContent).toContain('v2.0.0');
    expect(await screen.findByTestId('pack-version-toggle')).toBeTruthy();
    expect(screen.getByTestId('comfy-version').textContent).toContain('0.3.50');
    const spy = vi.spyOn(backend, 'nodePackVersions').mockResolvedValue([]);
    try {
      fireEvent.click(screen.getByLabelText(t('workflows.packs.mgr.close')));
      const again = await openCard('ComfyUI_IPAdapter_plus');
      await waitFor(() => expect(spy).toHaveBeenCalled());
      await waitFor(() => expect(again.querySelector('[data-testid="pack-version-toggle"]')).toBeNull());
      expect(again.textContent).not.toContain(t('workflows.packs.version.none'));
    } finally {
      spy.mockRestore();
    }
  });

  it('lists the versions of an extension, marks the ones another extension does not support, and installs the one chosen', async () => {
    const nkd = PACK_CATALOG.find((c) => c.id === 'nkd')!;
    nkd.requires = [{ on: 'ipadapter', min: 'v2.5.0' }];
    try {
      show();
      const ipa = await openCard('ComfyUI_IPAdapter_plus');
      fireEvent.click(await screen.findByTestId('pack-version-toggle'));
      const rows = await waitFor(() => {
        const found = ipa.querySelectorAll('[data-testid="pack-version-row"]');
        expect(found.length).toBe(4);
        return [...found];
      });
      // The pack is at v2.0.0 now; every version offered is below what the Basic Tools pack needs.
      const v200 = rows.find((r) => r.textContent?.includes('v2.0.0'))!;
      expect(v200.textContent).toContain(t('workflows.packs.installed'));
      const warn = rows[0]!.querySelector('[data-testid="pack-version-deprecated"]')!;
      expect(warn.textContent).toContain(t('workflows.packs.version.deprecated'));
      expect(warn.textContent).toContain('ComfyUI-NKD-Basic-Tools');
      // The version that is installed now shows only the installed mark, no button to switch to it.
      expect(v200.querySelector('[data-testid="pack-version-apply"]')).toBeNull();

      fireEvent.click(rows[0]!.querySelector('[data-testid="pack-version-apply"]')!);
      // The install runs in the background and ends with an event the app turns into a reload; here the list is read again.
      await waitFor(
        async () => {
          await useNodePacks.getState().load();
          expect(useNodePacks.getState().packs?.installed.find((p) => p.folder === 'ComfyUI_IPAdapter_plus')?.version).toBe('v2.1.0');
        },
        { timeout: 8000 },
      );
    } finally {
      delete nkd.requires;
    }
  }, 20_000);

  it('lists the ComfyUI releases, marks the ones an installed extension does not support, and switches only after asking twice', async () => {
    const ipa = PACK_CATALOG.find((c) => c.id === 'ipadapter')!;
    ipa.requires = [{ on: 'comfyui', max: '0.3.50' }];
    try {
      show();
      fireEvent.click(await screen.findByTestId('comfy-version'));
      const box = await screen.findByTestId('comfy-versions');
      fireEvent.click(box.querySelector('[data-testid="comfy-version-toggle"]')!);
      const rows = await waitFor(() => {
        const found = box.querySelectorAll('[data-testid="comfy-version-row"]');
        expect(found.length).toBe(4);
        return [...found];
      });
      // 0.3.50 is installed; only v0.3.60 is above what the IP-Adapter pack supports.
      expect(rows[0]!.querySelector('[data-testid="comfy-version-deprecated"]')!.textContent).toContain('ComfyUI_IPAdapter_plus');
      expect(rows[1]!.querySelector('[data-testid="comfy-version-deprecated"]')).toBeNull();
      expect(rows[1]!.textContent).toContain(t('workflows.packs.installed'));
      expect(rows[1]!.querySelector('[data-testid="comfy-version-apply"]')).toBeNull();

      // The first press only asks; nothing is switched.
      const apply = rows[2]!.querySelector('[data-testid="comfy-version-apply"]')!;
      fireEvent.click(apply);
      expect(apply.textContent).toBe(t('workflows.packs.version.confirm'));
      expect(useNodePacks.getState().comfySwitching).toBeNull();
      fireEvent.click(apply);
      expect(useNodePacks.getState().comfySwitching).toBe('v0.3.40');
      await waitFor(() => expect(useNodePacks.getState().comfySwitching).toBeNull(), { timeout: 8000 });
      await waitFor(() => expect(useNodePacks.getState().packs?.comfyVersion).toBe('0.3.40'));
      expect(useNodePacks.getState().comfyFailed).toEqual([]);
    } finally {
      delete ipa.requires;
    }
  }, 20_000);

  it('removes an installed extension from its detail panel and asks for the restart that applies it', async () => {
    show();
    const detail = await openCard('ComfyUI_UltimateSDUpscale');
    const remove = detail.querySelector('[data-testid="wf-pack-remove"]')!;
    fireEvent.click(remove);
    fireEvent.click(remove);
    await waitFor(() => expect(useNodePacks.getState().packs?.installed.some((p) => p.folder === 'ComfyUI_UltimateSDUpscale')).toBe(false));
    expect(await screen.findByTestId('extensions-restart')).toBeTruthy();
  });
});

describe('asking the assistant about extensions', () => {
  afterEach(() => useAgent.setState({ open: false, pendingAsk: null, focus: [] }));

  it('asks about the extension whose panel is open', async () => {
    show();
    const detail = await openCard('ComfyUI-Impact-Pack');
    fireEvent.click(within(detail).getByTestId('extension-ask'));
    expect(useAgent.getState()).toMatchObject({ open: true, pendingAsk: t('agent.ask.pack', { name: 'ComfyUI-Impact-Pack' }), focus: ['ComfyUI-Impact-Pack'] });
  });

  it('offers to ask about the results of a search, and about no more than the first few', async () => {
    show();
    await waitFor(() => expect(useNodePacks.getState().packs).not.toBeNull());
    expect(screen.queryByTestId('ex-ask-results')).toBeNull();
    fireEvent.change(screen.getByTestId('ex-search'), { target: { value: 'comfy' } });
    fireEvent.click(await screen.findByTestId('ex-ask-results'));
    const { pendingAsk, focus } = useAgent.getState();
    expect(pendingAsk).toBe(t('agent.ask.results', { query: 'comfy' }));
    expect(focus.length).toBeGreaterThan(0);
    expect(focus.length).toBeLessThanOrEqual(8);
  });

  it('does not offer it when the search finds nothing', async () => {
    show();
    fireEvent.change(screen.getByTestId('ex-search'), { target: { value: 'nothing-like-this' } });
    expect(screen.queryByTestId('ex-ask-results')).toBeNull();
  });
});

describe('the source link of an extension', () => {
  it('asks the backend to open the repository page instead of being a plain link', async () => {
    show();
    const detail = await openCard('ComfyUI-Impact-Pack');
    const open = vi.spyOn(backend, 'openSourcePage').mockResolvedValue();
    vi.spyOn(backend, 'kind', 'get').mockReturnValue('tauri' as typeof backend.kind);
    const link = within(detail).getByTestId('extension-source');
    expect(link.tagName).toBe('BUTTON');
    fireEvent.click(link);
    expect(open).toHaveBeenCalledWith('https://github.com/ltdrdata/ComfyUI-Impact-Pack');
  });
});

describe('the rail width', () => {
  const handle = () => screen.getByTestId('ex-rail-handle');
  const tab = () => screen.getByTestId('extensions-tab');
  beforeEach(() => localStorage.removeItem('novira.extensions.railWidth'));
  afterEach(() => localStorage.removeItem('novira.extensions.railWidth'));

  it('starts at 200, or at the saved width kept within the limits', () => {
    show();
    expect(tab().style.gridTemplateColumns).toContain('200px');
    cleanup();
    localStorage.setItem('novira.extensions.railWidth', '9000');
    show();
    expect(tab().style.gridTemplateColumns).toContain('480px');
    cleanup();
    localStorage.setItem('novira.extensions.railWidth', '12');
    show();
    expect(tab().style.gridTemplateColumns).toContain('160px');
  });

  it('starts at 200 when the browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    show();
    expect(tab().style.gridTemplateColumns).toContain('200px');
  });

  it('saves the width after the arrow keys, narrowing with the left one and ignoring other keys', () => {
    show();
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    expect(handle().getAttribute('aria-valuenow')).toBe('184');
    expect(localStorage.getItem('novira.extensions.railWidth')).toBe('184');
    fireEvent.keyDown(handle(), { key: 'Home' });
    expect(handle().getAttribute('aria-valuenow')).toBe('184');
  });

  it('follows a drag, within the limits, and saves it when the pointer is released', () => {
    show();
    fireEvent.pointerDown(handle(), { clientX: 100 });
    act(() => void window.dispatchEvent(new MouseEvent('pointermove', { clientX: 160 })));
    expect(handle().getAttribute('aria-valuenow')).toBe('260');
    act(() => void window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5000 })));
    expect(handle().getAttribute('aria-valuenow')).toBe('480');
    expect(localStorage.getItem('novira.extensions.railWidth')).toBeNull();
    act(() => void window.dispatchEvent(new MouseEvent('pointerup')));
    expect(localStorage.getItem('novira.extensions.railWidth')).toBe('480');
    // After the release the drag no longer follows the pointer.
    act(() => void window.dispatchEvent(new MouseEvent('pointermove', { clientX: 0 })));
    expect(handle().getAttribute('aria-valuenow')).toBe('480');
  });

  it('still works when the width cannot be saved', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    show();
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(handle().getAttribute('aria-valuenow')).toBe('216');
  });
});

describe('cards by keyboard and their picture', () => {
  it('opens and closes the detail with Enter or Space on the card itself, not for a key pressed on its button', async () => {
    show();
    await openCard('ComfyUI-Impact-Pack');
    const card = () => screen.getAllByTestId('extension-item').find((c) => c.textContent?.includes('ComfyUI-Impact-Pack'))!;
    fireEvent.click(card());
    expect(screen.queryByTestId('extension-detail')).toBeNull();
    fireEvent.keyDown(card(), { key: 'Enter' });
    expect(screen.getByTestId('extension-detail')).toBeTruthy();
    fireEvent.keyDown(card(), { key: ' ' });
    expect(screen.queryByTestId('extension-detail')).toBeNull();
    fireEvent.keyDown(card(), { key: 'a' });
    expect(screen.queryByTestId('extension-detail')).toBeNull();
    const button = card().querySelector('button');
    if (button) fireEvent.keyDown(button, { key: 'Enter' });
    expect(screen.queryByTestId('extension-detail')).toBeNull();
  });

  it('opens the ComfyUI detail by keyboard too, and closes it again', async () => {
    show();
    const card = await screen.findByTestId('comfy-version');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(await screen.findByTestId('comfy-versions')).toBeTruthy();
    fireEvent.keyDown(card, { key: ' ' });
    expect(screen.queryByTestId('comfy-versions')).toBeNull();
    fireEvent.keyDown(card, { key: 'x' });
    expect(screen.queryByTestId('comfy-versions')).toBeNull();
  });

  it('falls back to the puzzle icon when the picture of a registry pack cannot be loaded', async () => {
    const node = { id: 'pic', name: 'ComfyUI-Pictured', description: 'Has a picture', publisher: 'someone', repository: 'https://github.com/someone/ComfyUI-Pictured', icon: 'https://example.invalid/i.png', downloads: 1, stars: 1, version: '1.0.0', updated: null, license: null };
    vi.spyOn(backend, 'registryNodes').mockResolvedValue([node]);
    show();
    const card = await waitFor(() => {
      const found = screen.getAllByTestId('extension-item').find((c) => c.textContent?.includes('ComfyUI-Pictured'));
      expect(found).toBeTruthy();
      return found!;
    });
    const img = card.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://example.invalid/i.png');
    fireEvent.error(img);
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('.ex-card__media svg')).not.toBeNull();
  });
});

describe('notices', () => {
  const initialPacks = useNodePacks.getState();
  const initialRegistry = useRegistry.getState();
  afterEach(() => {
    useNodePacks.setState(initialPacks, true);
    useRegistry.setState(initialRegistry, true);
  });

  it('retries reading the registry from the notice, forcing a fresh read', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    useRegistry.setState({ load, error: 'offline', nodes: null });
    show();
    const notice = await screen.findByTestId('registry-failed');
    expect(notice.textContent).toContain('offline');
    load.mockClear();
    fireEvent.click(within(notice).getByRole('button', { name: t('workflows.packs.mgr.retry') }));
    expect(load).toHaveBeenCalledWith(true);
  });

  it('says that the registry is loading while nothing is there yet', () => {
    useRegistry.setState({ load: vi.fn().mockResolvedValue(undefined), loading: true, nodes: null, error: null });
    show();
    expect(screen.getByText(t('workflows.packs.mgr.registryLoading'))).toBeTruthy();
  });

  it('shows the engine restart bar and restarts on a press', async () => {
    const restart = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(backend, 'nodePacks').mockResolvedValue({ available: true, comfyVersion: null, restartNeeded: true, installed: [] });
    useNodePacks.setState({ restart });
    show();
    const bar = await screen.findByTestId('extensions-restart');
    fireEvent.click(within(bar).getByRole('button', { name: t('workflows.packs.restart') }));
    expect(restart).toHaveBeenCalledTimes(1);
  });

  it('shows no list but says so when extensions cannot be managed, and shows an install error', () => {
    useNodePacks.setState({ load: vi.fn().mockResolvedValue(undefined) });
    show();
    // Set after the first render, in one step with the checks: a late answer of the mock cannot overwrite it.
    act(() => useNodePacks.setState({ packs: { available: false, comfyVersion: null, restartNeeded: false, installed: [] }, error: 'git is missing' }));
    expect(screen.getByText(t('workflows.packs.unavailable'))).toBeTruthy();
    expect(screen.queryAllByTestId('extension-item')).toHaveLength(0);
    expect(screen.queryByText(t('workflows.packs.mgr.empty'))).toBeNull();
    expect(screen.getByText('git is missing')).toBeTruthy();
  });
});
