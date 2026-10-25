// @vitest-environment jsdom
// The about modal: the license tab (the full text of LICENSE) and the open-source tab (one list filtered by part and search,
// each row with its license text in place and a homepage link).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { AboutModal } from './AboutModal';
import oss from './ossLicenses.json';

const openOssTab = () => fireEvent.mouseDown(screen.getByRole('tab', { name: t('settings.about.oss.title') }), { button: 0 });
// The list has about 600 rows, each with buttons. A role query over all of them takes seconds in jsdom (the tests timed
// out under a full run), so a chip is looked for inside its own group and rows are counted from the plain <ul> of <li>.
const chip = (label: string) =>
  within(screen.getByRole('group', { name: t('settings.about.oss.groupLabel') })).getByRole('button', { name: new RegExp(`^${label}`) });
const rows = () => Array.from(screen.getByTestId('about-oss-list').querySelectorAll<HTMLLIElement>(':scope > ul > li'));

describe('AboutModal open-source software', () => {
  beforeEach(() => {
    useUi.getState().openModal('about');
    // The modal asks the backend for the list when it opens, so the list is stubbed there.
    vi.spyOn(backend, 'nodePacks').mockResolvedValue({
      available: true,
      restartNeeded: false,
      comfyVersion: null,
      installed: [
        { folder: 'ComfyUI-Impact-Pack', url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack', version: null },
        { folder: 'by-hand', url: null, version: null },
      ],
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useNodePacks.setState({ packs: null });
    cleanup();
    useUi.getState().openModal(null);
  });

  it('lists every part together, and each part on its own when its chip is pressed', async () => {
    render(<AboutModal />);
    openOssTab();
    const total = oss.frontend.length + oss.backend.length + oss.engine.length;
    await waitFor(() => expect(rows()).toHaveLength(total + 2));
    chip(t('settings.about.oss.short.engine')).click();
    await waitFor(() => expect(rows()).toHaveLength(oss.engine.length));
    expect(screen.getByTestId('about-oss-list').textContent).toContain('ComfyUI');
  });

  it('lists each installed extension by name, without a license tag', async () => {
    render(<AboutModal />);
    openOssTab();
    await waitFor(() => expect(chip(t('settings.about.oss.short.packs'))).toBeTruthy());
    chip(t('settings.about.oss.short.packs')).click();
    const list = await screen.findByTestId('about-oss-list');
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(list.textContent).toContain('ComfyUI-Impact-Pack');
    expect(list.textContent).toContain('by-hand');
    expect(list.textContent).not.toContain('GPL-3.0');
  });

  it('searches by name only, and says so when nothing matches', async () => {
    render(<AboutModal />);
    openOssTab();
    const search = screen.getByRole('textbox', { name: t('settings.about.oss.search') });
    fireEvent.change(search, { target: { value: 'pytorch' } });
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.change(search, { target: { value: 'psf-2' } });
    await waitFor(() => expect(rows()).toHaveLength(0));
    fireEvent.change(search, { target: { value: 'no-such-software-xyz' } });
    await waitFor(() => expect(rows()).toHaveLength(0));
    expect(screen.getByTestId('about-oss-list').textContent).toContain(t('settings.about.oss.noMatch'));
  });

  it("shows a package's own license text under its row, and hides it again", async () => {
    render(<AboutModal />);
    openOssTab();
    fireEvent.change(screen.getByRole('textbox', { name: t('settings.about.oss.search') }), { target: { value: 'zustand' } });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const row = rows()[0]!;
    within(row).getByRole('button', { name: t('settings.about.oss.showLicense') }).click();
    const text = await within(row).findByTestId('about-license-text');
    expect(text.textContent).toContain('Paul Henschel');
    within(row).getByRole('button', { name: t('settings.about.oss.hideLicense') }).click();
    await waitFor(() => expect(within(row).queryByTestId('about-license-text')).toBeNull());
  });

  it('points to the homepage for software the app does not ship, and opens the homepage when asked', async () => {
    useToasts.setState({ toasts: [] });
    render(<AboutModal />);
    openOssTab();
    chip(t('settings.about.oss.short.engine')).click();
    await waitFor(() => expect(rows()).toHaveLength(oss.engine.length));
    const comfy = rows().find((r) => r.textContent?.startsWith('ComfyUI'))!;
    within(comfy).getByRole('button', { name: t('settings.about.oss.showLicense') }).click();
    expect(await within(comfy).findByText(t('settings.about.oss.textAtHomepage'))).toBeTruthy();
    within(comfy).getByRole('button', { name: t('settings.about.oss.homepage') }).click();
    // The mock has no browser: it says so, with the address it would open.
    expect(useToasts.getState().toasts.at(-1)?.description).toBe('https://github.com/comfyanonymous/ComfyUI');
  });

  it('says there are no extensions when none is installed', async () => {
    vi.spyOn(backend, 'nodePacks').mockResolvedValue({ available: true, restartNeeded: false, comfyVersion: null, installed: [] });
    render(<AboutModal />);
    openOssTab();
    await waitFor(() => expect(chip(t('settings.about.oss.short.packs'))).toBeTruthy());
    chip(t('settings.about.oss.short.packs')).click();
    await waitFor(() => expect(screen.getByTestId('about-oss-list').textContent).toContain(t('settings.about.packs.none')));
  });
});

describe('AboutModal license', () => {
  beforeEach(() => {
    useUi.getState().openModal('about');
  });
  afterEach(() => {
    cleanup();
    useUi.getState().openModal(null);
  });

  it('shows the copyright, and the full Apache License 2.0 text at once', async () => {
    render(<AboutModal />);
    expect(screen.getByTestId('about-modal').textContent).toContain('© 2026');
    const text = await screen.findByTestId('about-license-text');
    expect(text.textContent).toContain('Version 2.0, January 2004');
    // The notice and the bundled software's notices are not repeated here: the open-source tab has each package's text.
    expect(screen.getByTestId('about-license').textContent).not.toContain('THIRD_PARTY_NOTICES');
    expect(screen.queryAllByRole('button', { name: /LICENSE/ })).toHaveLength(0);
  });
});
