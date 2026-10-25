// @vitest-environment jsdom
// The drafts view: starting a batch, the group tabs, and the grid of candidates with selecting, marking and finishing.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t, tCount } from '@/i18n';
import { useDraftForm } from '@/state/draftForm';
import { useDrafts, type DraftCandidate, type DraftGroup } from '@/state/drafts';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { SETTINGS_DEFAULTS, useSettings } from '@/state/settings';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { DraftsView } from './DraftsView';
import { byDay } from './GroupTabs';

const initial = { drafts: useDrafts.getState(), gallery: useGallery.getState(), toasts: useToasts.getState(), models: useModels.getState(), ui: useUi.getState() };
const lastToast = () => useToasts.getState().toasts.at(-1);

const candidate = (n: number, over: Partial<DraftCandidate> = {}): DraftCandidate => ({
  id: `c${n}`,
  seed: 100 + n,
  itemId: n,
  imageName: `d${n}.png`,
  status: 'ready',
  error: null,
  finalItemId: null,
  finalImageName: null,
  finalStatus: null,
  verdict: null,
  ...over,
});
const group = (id: string, candidates: DraftCandidate[]): DraftGroup => ({
  id,
  createdAt: 0,
  params: { modelName: `Model ${id}`, steps: 28, width: 512, height: 768 } as DraftGroup['params'],
  boardId: null,
  position: 0.35,
  candidates,
});
const picture = (name: string) => ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 512, height: 768 }) as never;

beforeEach(() => {
  useDraftForm.setState({ count: null, percent: null });
  useSettings.setState({ draftCount: SETTINGS_DEFAULTS.draftCount, draftPosition: SETTINGS_DEFAULTS.draftPosition });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useDrafts.setState({ ...initial.drafts, groups: [], currentId: null, selection: [], busy: false }, true);
  useGallery.setState({ ...initial.gallery, images: [] }, true);
  useToasts.setState(initial.toasts, true);
  useModels.setState(initial.models, true);
});
afterEach(() => {
  cleanup();
  useSettings.getState().reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const show = () =>
  render(
    <TooltipProvider>
      <DraftsView />
    </TooltipProvider>,
  );

describe('starting drafts', () => {
  it('shows the empty state and starts a batch with the chosen count and position', async () => {
    const start = vi.fn().mockResolvedValue(null);
    useDrafts.setState({ start });
    show();
    expect(screen.getByText(t('drafts.empty.title'))).toBeTruthy();
    const count = screen.getAllByLabelText(t('drafts.count')).find((e) => (e as HTMLInputElement).type === 'number')!;
    fireEvent.change(count, { target: { value: '12' } });
    fireEvent.blur(count);
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenCalledWith(12, 0.35, null));
    expect(lastToast()).toBeUndefined();
  });

  it('starts with the count the settings give, 4 at first, and keeps what is typed for this run', async () => {
    const start = vi.fn().mockResolvedValue(null);
    useDrafts.setState({ start });
    show();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith(4, 0.35, null));
    cleanup();
    useSettings.getState().set({ draftCount: 10 });
    show();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith(10, 0.35, null));
    // Changing the box does not change the setting.
    const count = screen.getAllByLabelText(t('drafts.count')).find((e) => (e as HTMLInputElement).type === 'number')!;
    fireEvent.change(count, { target: { value: '3' } });
    fireEvent.blur(count);
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith(3, 0.35, null));
    expect(useSettings.getState().draftCount).toBe(10);
  });

  it('starts the position from the settings, and keeps count and position when the screen is left and opened again', async () => {
    const start = vi.fn().mockResolvedValue(null);
    useDrafts.setState({ start });
    useSettings.getState().set({ draftPosition: 50 });
    show();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith(4, 0.5, null));
    const count = screen.getAllByLabelText(t('drafts.count')).find((e) => (e as HTMLInputElement).type === 'number')!;
    fireEvent.change(count, { target: { value: '7' } });
    fireEvent.blur(count);
    const position = screen.getAllByLabelText(t('drafts.position')).find((e) => (e as HTMLInputElement).type === 'number')!;
    fireEvent.change(position, { target: { value: '30' } });
    fireEvent.blur(position);
    cleanup();
    // Another screen was shown meanwhile: the box and the slider come back as they were set, not from the settings.
    show();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenLastCalledWith(7, 0.3, null));
    expect(useSettings.getState().draftPosition).toBe(50);
  });

  it('explains why a batch could not start, and reports a failure', async () => {
    const start = vi.fn().mockResolvedValueOnce({ error: 'not-txt2img' }).mockResolvedValueOnce({ error: 'no-builder' }).mockRejectedValueOnce(new Error('queue down'));
    useDrafts.setState({ start });
    show();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'warning', title: t('drafts.onlyTxt2img') }));
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(lastToast()).toMatchObject({ title: t('drafts.notReady') }));
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'queue down' }));
  });
});

describe('model of the drafts', () => {
  it('starts the drafts with the model picked here instead of the Generate tab model', async () => {
    const start = vi.fn().mockResolvedValue(null);
    useDrafts.setState({ start });
    useModels.setState({ models: [{ key: 'm1', name: 'Anime XL', base: 'sdxl', type: 'main' } as never] });
    show();
    fireEvent.click(screen.getByTestId('drafts-model'));
    fireEvent.click(screen.getByText('Anime XL'));
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'm1'));
  });

  it('offers the diffusion models of the newer families, and names the edit models it leaves out', () => {
    useModels.setState({
      models: [
        { key: 'm1', name: 'Anime XL', base: 'sdxl', type: 'main', path: 'animeXL.safetensors' },
        { key: 'm2', name: 'NyaNya Anima', base: 'anima', type: 'diffusion_model', path: 'nyanya.safetensors' },
        { key: 'm3', name: 'Kontext', base: 'flux', type: 'diffusion_model', path: 'flux1-kontext-dev.safetensors' },
        { key: 'm4', name: 'Wan 5B', base: 'wan', type: 'diffusion_model', path: 'wan2.2_ti2v_5B.safetensors' },
      ] as never,
    });
    show();
    expect(screen.getByTestId('drafts-left-out').textContent).toBe(t('drafts.leftOut', { names: 'Kontext' }));
    fireEvent.click(screen.getByTestId('drafts-model'));
    const list = screen.getByTestId('model-picker-list');
    expect(within(list).getByText('NyaNya Anima')).toBeTruthy();
    expect(within(list).getByText('Anime XL')).toBeTruthy();
    expect(within(list).queryByText('Kontext')).toBeNull();
    expect(within(list).queryByText('Wan 5B')).toBeNull();
  });

  it('says nothing is left out when every model can draft, and explains a refused edit model', async () => {
    const start = vi.fn().mockResolvedValue({ error: 'edit-model' });
    useDrafts.setState({ start });
    useModels.setState({ models: [{ key: 'm1', name: 'Anime XL', base: 'sdxl', type: 'main', path: 'a.safetensors' }] as never });
    show();
    expect(screen.queryByTestId('drafts-left-out')).toBeNull();
    fireEvent.click(screen.getByTestId('drafts-start'));
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'warning', title: t('drafts.editModel') }));
  });

  it('does not open the viewer when the keep star is double clicked', () => {
    useGallery.setState({ images: [picture('d1.png')] });
    useDrafts.setState({ groups: [group('a', [candidate(1)])], currentId: 'a' });
    show();
    fireEvent.doubleClick(screen.getByLabelText(t('drafts.keep')));
    expect(useGallery.getState().selection).toEqual([]);
  });
});

describe('groups', () => {
  it('shows one tab per group, switches between them and closes one', () => {
    useDrafts.setState({ groups: [group('a', [candidate(1)]), group('b', [candidate(2), candidate(3)])], currentId: 'a' });
    show();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByTestId('draft-cell')).toHaveLength(1);
    fireEvent.click(tabs[1]!);
    expect(screen.getAllByTestId('draft-cell')).toHaveLength(2);
    fireEvent.click(screen.getAllByLabelText(t('drafts.closeGroup'))[1]!);
    expect(useDrafts.getState().groups.map((g) => g.id)).toEqual(['a']);
    expect(screen.getAllByTestId('draft-cell')).toHaveLength(1);
  });

  describe('history', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => group(`g${i + 1}`, [candidate(i + 1)]));

    it('keeps only the latest five as tabs and reaches the older ones from a popup', () => {
      useDrafts.setState({ groups: many(8), currentId: 'g8' });
      show();
      expect(screen.getAllByRole('tab')).toHaveLength(5);
      expect(screen.getByTestId('drafts-older').textContent).toContain('3');
      fireEvent.click(screen.getByTestId('drafts-older'));
      const list = screen.getByTestId('drafts-older-list');
      expect(list.querySelectorAll('li')).toHaveLength(3);
      expect(list.querySelector('li')!.textContent).toContain('3.');
      fireEvent.click(list.querySelectorAll('li > button:first-child')[2]!);
      expect(useDrafts.getState().currentId).toBe('g1');
    });

    it('lists the older ones by day, the latest day and batch first, with the pictures drawn then', () => {
      const at = (id: string, day: number, hour: number, n: number) => ({
        ...group(id, [candidate(n), candidate(n + 50), candidate(n + 60)]),
        createdAt: new Date(2026, 9, day, hour).getTime(),
      });
      useDrafts.setState({
        groups: [at('g1', 3, 9, 1), at('g2', 3, 15, 2), at('g3', 4, 8, 3), ...[4, 5, 6, 7, 8].map((n) => at(`g${n}`, 10, n, n))],
        currentId: 'g8',
      });
      useGallery.setState({ images: [picture('d2.png'), picture('d52.png'), picture('d1.png')] });
      show();
      fireEvent.click(screen.getByTestId('drafts-older'));
      const list = screen.getByTestId('drafts-older-list');
      expect(list.querySelectorAll('section')).toHaveLength(2);
      expect([...list.querySelectorAll('li')].map((li) => li.textContent?.slice(0, 3))).toEqual(['3. ', '2. ', '1. '].map((s) => s.slice(0, 3)));
      const second = list.querySelectorAll('section')[1]!;
      expect([...second.querySelectorAll('li')].map((li) => li.querySelectorAll('img').length)).toEqual([2, 1]);
    });

    it('groups batches by calendar day, newest first', () => {
      const at = (id: string, ...time: [number, number, number, number]) => ({ ...group(id, []), createdAt: new Date(2026, time[0], time[1], time[2], time[3]).getTime() });
      const days = byDay([at('a', 9, 3, 23, 59), at('b', 9, 4, 0, 0), at('c', 9, 3, 0, 0)]);
      expect(days.map((d) => d.groups.map((g) => g.id))).toEqual([['b'], ['a', 'c']]);
    });

    it('shows no popup button while the history fits on the screen', () => {
      useDrafts.setState({ groups: many(5), currentId: 'g5' });
      show();
      expect(screen.queryByTestId('drafts-older')).toBeNull();
      expect(screen.getAllByRole('tab')).toHaveLength(5);
    });

    it('closes all the older ones at once and leaves the latest', () => {
      useDrafts.setState({ groups: many(7), currentId: 'g1' });
      show();
      fireEvent.click(screen.getByTestId('drafts-older'));
      fireEvent.click(screen.getByTestId('drafts-close-older'));
      expect(useDrafts.getState().groups.map((g) => g.id)).toEqual(['g3', 'g4', 'g5', 'g6', 'g7']);
      expect(useDrafts.getState().currentId).toBe('g7');
      expect(screen.queryByTestId('drafts-older')).toBeNull();
    });
  });

  it('shows the last group when none is current', () => {
    useDrafts.setState({ groups: [group('a', [candidate(1)]), group('b', [candidate(2), candidate(3)])], currentId: null });
    show();
    expect(screen.getAllByTestId('draft-cell')).toHaveLength(2);
  });
});

describe('candidates', () => {
  const cells = () => screen.getAllByTestId('draft-cell');

  it('labels each candidate by its state', () => {
    useGallery.setState({ images: ['d1.png', 'd5.png', 'f6.png'].map(picture) });
    useDrafts.setState({
      groups: [
        group('a', [
          candidate(1),
          candidate(2, { status: 'queued', imageName: null }),
          candidate(3, { status: 'running', imageName: null }),
          candidate(4, { status: 'failed', imageName: null, error: 'out of memory' }),
          candidate(5, { finalStatus: 'queued', finalItemId: 9 }),
          candidate(6, { finalImageName: 'f6.png', finalStatus: 'ready', finalItemId: 8 }),
          candidate(7, { finalStatus: 'failed', finalItemId: 7 }),
        ]),
      ],
      currentId: 'a',
    });
    show();
    const badges = cells().map((c) => c.querySelector('.dv-badge')!.textContent);
    expect(badges[0]).toBe(t('drafts.badge.draft', { percent: 35, steps: 28, step: 10 }));
    expect(badges[1]).toBe(t('drafts.badge.queued'));
    expect(badges[2]).toBe(t('drafts.badge.drawing'));
    expect(badges[3]).toBe(t('drafts.badge.failed'));
    expect(badges[4]).toBe(t('drafts.badge.finishing'));
    expect(badges[5]).toBe(t('drafts.badge.finished'));
    expect(badges[6]).toBe(t('drafts.badge.failed'));
    expect(cells()[3]!.querySelector('.dv-badge')!.getAttribute('title')).toBe('out of memory');
    expect(cells()[5]!.querySelector('img')!.getAttribute('src')).toBe('blob:t-f6.png');
    expect(cells()[4]!.querySelector('.dv-busy')).toBeTruthy();
  });

  it('selects ready candidates by click or keyboard, and ignores the others', () => {
    useDrafts.setState({ groups: [group('a', [candidate(1), candidate(2, { status: 'queued', imageName: null })])], currentId: 'a' });
    show();
    const pick = (i: number) => within(cells()[i]!).getByRole('button', { name: /seed/ });
    fireEvent.click(pick(0));
    expect(useDrafts.getState().selection).toEqual(['c1']);
    fireEvent.keyDown(pick(0), { key: 'Enter' });
    expect(useDrafts.getState().selection).toEqual([]);
    fireEvent.keyDown(pick(0), { key: ' ' });
    expect(useDrafts.getState().selection).toEqual(['c1']);
    fireEvent.keyDown(pick(0), { key: 'a' });
    fireEvent.click(pick(1));
    fireEvent.keyDown(pick(1), { key: 'Enter' });
    expect(useDrafts.getState().selection).toEqual(['c1']);
    expect(screen.getByText(tCount('drafts.finish', 1))).toBeTruthy();
    fireEvent.click(screen.getByText(t('drafts.clearSelection')));
    expect(useDrafts.getState().selection).toEqual([]);
  });

  it('keeps or rejects a candidate with its buttons', () => {
    useDrafts.setState({ groups: [group('a', [candidate(1)])], currentId: 'a' });
    show();
    fireEvent.click(screen.getByLabelText(t('drafts.keep')));
    expect(useDrafts.getState().groups[0]!.candidates[0]!.verdict).toBe('keep');
    expect(useDrafts.getState().selection).toEqual([]);
    fireEvent.click(screen.getByLabelText(t('drafts.unkeep')));
    fireEvent.click(screen.getByLabelText(t('drafts.reject')));
    expect(useDrafts.getState().groups[0]!.candidates[0]!.verdict).toBe('reject');
    expect(cells()[0]!.className).toContain('is-rejected');
    expect(screen.getByLabelText(t('drafts.unreject'))).toBeTruthy();
  });

  it('opens a candidate in the viewer on double click when its picture exists', () => {
    useGallery.setState({ images: [picture('d1.png')] });
    useDrafts.setState({ groups: [group('a', [candidate(1), candidate(2, { status: 'queued', imageName: null })])], currentId: 'a' });
    show();
    fireEvent.doubleClick(within(cells()[1]!).getByRole('button', { name: /seed/ }));
    expect(useGallery.getState().selection).toEqual([]);
    fireEvent.doubleClick(within(cells()[0]!).getByRole('button', { name: /seed/ }));
    expect(useGallery.getState().selection).toEqual(['d1.png']);
    expect(useUi.getState().mainView.generate).toBe('viewer');
  });

  it('opens a candidate somewhere else when the layout asks, with a button as well as a double click', () => {
    useGallery.setState({ images: [picture('d1.png')] });
    useDrafts.setState({ groups: [group('a', [candidate(1), candidate(2, { status: 'queued', imageName: null })])], currentId: 'a' });
    const onOpen = vi.fn();
    render(
      <TooltipProvider>
        <DraftsView onOpen={onOpen} />
      </TooltipProvider>,
    );
    // Only a candidate with a picture has the button.
    expect(screen.getAllByTestId('draft-open')).toHaveLength(1);
    fireEvent.click(within(cells()[0]!).getByTestId('draft-open'));
    expect(onOpen).toHaveBeenCalledWith('d1.png');
    // The button does not select the candidate, and the desktop viewer is left alone.
    expect(useDrafts.getState().selection).toEqual([]);
    expect(useGallery.getState().selection).toEqual([]);
    fireEvent.doubleClick(within(cells()[0]!).getByRole('button', { name: /seed/ }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('has no open button in the desktop layout', () => {
    useGallery.setState({ images: [picture('d1.png')] });
    useDrafts.setState({ groups: [group('a', [candidate(1)])], currentId: 'a' });
    show();
    expect(screen.queryByTestId('draft-open')).toBeNull();
  });

  it('finishes the selected candidates', async () => {
    const finish = vi.fn().mockResolvedValue(undefined);
    useDrafts.setState({ finish, groups: [group('a', [candidate(1), candidate(2)])], currentId: 'a' });
    show();
    expect((screen.getByTestId('drafts-finish') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(cells()[0]!).getByRole('button', { name: /seed/ }));
    fireEvent.click(within(cells()[1]!).getByRole('button', { name: /seed/ }));
    fireEvent.click(screen.getByTestId('drafts-finish'));
    expect(finish).toHaveBeenCalledWith('a', ['c1', 'c2']);
  });

  it('offers to retry the failed ones', () => {
    const retryFailed = vi.fn().mockResolvedValue(undefined);
    useDrafts.setState({ retryFailed, groups: [group('a', [candidate(1, { status: 'failed', imageName: null }), candidate(2, { status: 'failed', imageName: null })])], currentId: 'a' });
    show();
    fireEvent.click(screen.getByText(tCount('drafts.retry', 2)));
    expect(retryFailed).toHaveBeenCalledWith('a');
  });

  it('pages through more than 24 candidates', () => {
    useDrafts.setState({ groups: [group('a', Array.from({ length: 30 }, (_, i) => candidate(i + 1)))], currentId: 'a' });
    show();
    expect(cells()).toHaveLength(24);
    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
    fireEvent.click(screen.getByText('›'));
    expect(cells()).toHaveLength(6);
    fireEvent.click(screen.getByText('‹'));
    expect(cells()).toHaveLength(24);
    act(() => useDrafts.setState({ busy: true }));
  });
});
