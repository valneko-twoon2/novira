// @vitest-environment jsdom
// The Invoke split button, the iterations box and the cancel / queue menu.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useComic } from '@/state/comic/store';
import { useXyPlotDialog } from '@/state/dialogs/xyplot';
import { invoke, registerInvokeBuilder } from '@/state/invoke';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { InvokeControls } from './InvokeControls';

vi.mock('@/state/invoke', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/state/invoke')>()), invoke: vi.fn() }));

const initial = { params: useParams.getState(), queue: useQueue.getState(), ui: useUi.getState() };
const status = (patch: Partial<ReturnType<typeof useQueue.getState>['status']>) => ({ ...initial.queue.status, ...patch });
const mount = (tab: 'generate' | 'canvas' | 'comic' = 'generate') =>
  render(
    <TooltipProvider>
      <InvokeControls tab={tab} />
    </TooltipProvider>,
  );
const openMenu = (name: string) => {
  fireEvent.pointerDown(screen.getByLabelText(name), { button: 0, ctrlKey: false, pointerType: 'mouse' });
};
const ready = (reasons: string[] = []) => registerInvokeBuilder('generate', { readiness: () => reasons, build: () => Promise.reject(new Error('unused')) });

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useParams.setState(initial.params, true);
  useQueue.setState(initial.queue, true);
  useUi.setState({ ...initial.ui, activeTab: 'generate', media: 'image' }, true);
  useXyPlotDialog.setState({ isOpen: false });
  vi.mocked(invoke).mockReset();
  ready();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Invoke button', () => {
  it('invokes when ready, and is disabled with the reasons when it cannot', () => {
    mount();
    const button = screen.getByTestId('invoke-button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(invoke).toHaveBeenCalledTimes(1);
    cleanup();
    ready(['Pick a model']);
    mount();
    expect((screen.getByTestId('invoke-button') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(t('params.invoke.moreOptions')) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows progress and the queue count while a job runs', () => {
    useQueue.setState({
      status: status({ inProgress: 1, pending: 2 }),
      progress: { itemId: 1, step: 5, totalSteps: 20, progressImageUrl: null, message: '' },
    });
    mount();
    expect(screen.getByText(t('params.invoke.generating'))).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByLabelText(t('params.invoke.queued', { count: 3 })).textContent).toBe('3');
    act(() => useQueue.setState({ progress: null }));
    expect(screen.queryByText('25%')).toBeNull();
  });

  it('adds to the back or the front of the queue from the menu', async () => {
    mount();
    openMenu(t('params.invoke.moreOptions'));
    fireEvent.click(await screen.findByText(t('params.invoke.addFront')));
    expect(invoke).toHaveBeenLastCalledWith({ prepend: true });
    openMenu(t('params.invoke.moreOptions'));
    fireEvent.click(await screen.findByText(t('params.invoke.addBack')));
    expect(invoke).toHaveBeenLastCalledWith();
  });

  it('offers the comparison grid only for image generation', async () => {
    mount();
    openMenu(t('params.invoke.moreOptions'));
    fireEvent.click(await screen.findByText(t('xyplot.menu')));
    expect(useXyPlotDialog.getState().isOpen).toBe(true);
    cleanup();
    act(() => useUi.setState({ media: 'video' }));
    mount();
    openMenu(t('params.invoke.moreOptions'));
    await screen.findByText(t('params.invoke.addFront'));
    expect(screen.queryByText(t('xyplot.menu'))).toBeNull();
  });
});

describe('iterations', () => {
  it('rounds the count and never goes below one', () => {
    mount();
    const box = screen.getByLabelText(t('params.invoke.iterations'));
    fireEvent.change(box, { target: { value: '4.4' } });
    fireEvent.blur(box);
    expect(useParams.getState().iterations).toBe(4);
    fireEvent.change(box, { target: { value: '0' } });
    fireEvent.blur(box);
    expect(useParams.getState().iterations).toBe(1);
  });
});

describe('a screen that draws with its own buttons', () => {
  beforeEach(() => {
    registerInvokeBuilder('comic', { readiness: () => [], showsInvokeButton: false, build: () => Promise.reject(new Error('unused')) });
  });

  it('shows no Invoke button', () => {
    mount('comic');
    expect(screen.queryByTestId('invoke-button')).toBeNull();
  });

  it('shows the cancel controls only while work is queued', () => {
    mount('comic');
    expect(screen.queryByLabelText(t('params.invoke.cancelCurrent'))).toBeNull();
    cleanup();
    useQueue.setState({ status: status({ pending: 1 }) });
    mount('comic');
    expect(screen.getByLabelText(t('params.invoke.cancelCurrent'))).toBeTruthy();
  });
});

describe('CancelControls', () => {
  const running = { id: 7, status: 'in_progress' } as QueueItem;

  it('cannot cancel when nothing is running', () => {
    mount();
    expect((screen.getByLabelText(t('params.invoke.cancelCurrent')) as HTMLButtonElement).disabled).toBe(true);
  });

  it('cancels the running item from the button and from the menu, and clears the queue', async () => {
    const cancel = vi.spyOn(backend, 'cancelQueueItem').mockResolvedValue();
    const clear = vi.spyOn(backend, 'clearQueue').mockResolvedValue();
    useQueue.setState({ items: [running], status: status({ inProgress: 1 }) });
    mount();
    fireEvent.click(screen.getByLabelText(t('params.invoke.cancelCurrent')));
    expect(cancel).toHaveBeenCalledWith(7);
    openMenu(t('params.invoke.queueMenu'));
    fireEvent.click((await screen.findAllByText(t('params.invoke.cancelCurrent'))).find((e) => e.closest('[role="menuitem"]'))!);
    expect(cancel).toHaveBeenCalledTimes(2);
    openMenu(t('params.invoke.queueMenu'));
    fireEvent.click(await screen.findByText(t('params.invoke.clearQueue')));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('pauses, resumes and opens the queue tab', async () => {
    const pause = vi.spyOn(backend, 'pauseProcessor').mockResolvedValue();
    const resume = vi.spyOn(backend, 'resumeProcessor').mockResolvedValue();
    mount();
    openMenu(t('params.invoke.queueMenu'));
    fireEvent.click(await screen.findByText(t('params.invoke.pause')));
    expect(pause).toHaveBeenCalledTimes(1);
    act(() => useQueue.setState({ status: status({ isPaused: true }) }));
    openMenu(t('params.invoke.queueMenu'));
    fireEvent.click(await screen.findByText(t('params.invoke.resume')));
    expect(resume).toHaveBeenCalledTimes(1);
    openMenu(t('params.invoke.queueMenu'));
    fireEvent.click(await screen.findByText(t('params.invoke.openQueue')));
    expect(useUi.getState().activeTab).toBe('queue');
  });
});

describe('Draw button of the comic screen', () => {
  it('is the Invoke button, named after what it draws, and its menu chooses the selected panel or the whole page', async () => {
    registerInvokeBuilder('comic', { readiness: () => [], build: () => Promise.reject(new Error('unused')) });
    useComic.setState({ drawScope: 'panel' });
    mount('comic');
    expect(screen.getByTestId('invoke-button').textContent).toContain(t('comic.panel.draw'));
    openMenu(t('params.invoke.moreOptions'));
    fireEvent.click(await screen.findByRole('menuitem', { name: t('comic.page.drawAll') }));
    expect(useComic.getState().drawScope).toBe('page');
    expect(screen.getByTestId('invoke-button').textContent).toContain(t('comic.page.drawAll'));
    fireEvent.click(screen.getByTestId('invoke-button'));
    expect(invoke).toHaveBeenCalledTimes(1);
    openMenu(t('params.invoke.moreOptions'));
    fireEvent.click(await screen.findByRole('menuitem', { name: t('comic.comic.drawAll') }));
    expect(useComic.getState().drawScope).toBe('comic');
    expect(screen.getByTestId('invoke-button').textContent).toContain(t('comic.comic.drawAll'));
    useComic.setState({ drawScope: 'panel' });
  });
});
