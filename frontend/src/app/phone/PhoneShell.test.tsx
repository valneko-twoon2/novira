// @vitest-environment jsdom
// The phone layout: its tabs, the Generate tab's form and button, the job being drawn in the title bar and full screen,
// and the way to the desktop layout.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueItem } from '@/backend';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { invoke, registerInvokeBuilder } from '@/state/invoke';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { PhoneShell } from './PhoneShell';
import { usePhone } from './phoneStore';

vi.mock('@/state/invoke', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/state/invoke')>()), invoke: vi.fn() }));

const initial = { params: useParams.getState(), queue: useQueue.getState(), ui: useUi.getState() };
const ready = (reasons: string[] = []) => registerInvokeBuilder('generate', { readiness: () => reasons, build: () => Promise.reject(new Error('unused')) });
const running = (id: number, over: Partial<QueueItem> = {}): QueueItem =>
  ({ id, batchId: 'b', status: 'in_progress', origin: 'generate', destination: 'gallery', params: { width: 832, height: 1216 }, boardId: null, createdAt: 0, startedAt: 0, completedAt: null, imageName: null, error: null, ...over }) as QueueItem;
const mount = () =>
  render(
    <TooltipProvider>
      <PhoneShell />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useParams.setState(initial.params, true);
  useQueue.setState(initial.queue, true);
  useUi.setState({ ...initial.ui, activeTab: 'models', media: 'video' }, true);
  usePhone.setState({ tab: 'generate', view: null });
  vi.mocked(invoke).mockReset();
  ready();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('phone layout', () => {
  it("opens the assistant's chat over the tabs from the title bar, and draws pictures again after a request", () => {
    vi.spyOn(backend, 'agentStatus').mockResolvedValue({ provider: null, installed: false, loggedIn: false, models: [] });
    useAgent.setState({ open: false, busy: false });
    mount();
    expect(screen.queryByTestId('phone-chat')).toBeNull();
    fireEvent.click(screen.getByTestId('phone-chat-open'));
    expect(screen.getByTestId('phone-chat')).toBeTruthy();
    expect(screen.getByTestId('phone-shell').hasAttribute('data-chat')).toBe(true);
    // A tool of the request opened a screen this layout has not; when the request ends the phone draws pictures again.
    act(() => {
      useAgent.setState({ busy: true });
      useUi.getState().setTab('workflows');
    });
    expect(useUi.getState().activeTab).toBe('workflows');
    act(() => useAgent.setState({ busy: false }));
    expect(useUi.getState().activeTab).toBe('generate');
    expect(useUi.getState().media).toBe('image');
    act(() => useAgent.setState({ open: false }));
    expect(screen.getByTestId('phone-shell').hasAttribute('data-chat')).toBe(false);
  });

  it('opens on the Generate tab and draws with the Generate screen whatever the desktop layout had open', () => {
    mount();
    expect(screen.getByTestId('phone-tab-generate')).toBeTruthy();
    expect(screen.getByRole('heading', { name: t('app.tabs.generate') })).toBeTruthy();
    expect(useUi.getState().activeTab).toBe('generate');
    expect(useUi.getState().media).toBe('image');
    const nav = screen.getByRole('navigation', { name: t('phone.nav') });
    expect(within(nav).getByTestId('phone-nav-generate').getAttribute('aria-current')).toBe('page');
  });
});

describe('phone Generate tab', () => {
  it('writes the prompts the desktop left panel writes', () => {
    mount();
    fireEvent.change(screen.getByTestId('positive-prompt'), { target: { value: 'a cat on a roof' } });
    fireEvent.change(screen.getByTestId('negative-prompt'), { target: { value: 'blurry' } });
    expect(useParams.getState().positivePrompt).toBe('a cat on a roof');
    expect(useParams.getState().negativePrompt).toBe('blurry');
  });

  it('says why it cannot draw yet and keeps the button off, then draws when ready', () => {
    ready(['Pick a model']);
    mount();
    expect(screen.getByTestId('generation-reason').textContent).toBe('Pick a model');
    expect((screen.getByTestId('invoke-button') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    ready();
    mount();
    expect(screen.queryByTestId('generation-reason')).toBeNull();
    fireEvent.click(screen.getByTestId('invoke-button'));
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('shows the progress and how many are queued while it draws', () => {
    useQueue.setState({ items: [running(3)], status: { ...initial.queue.status, inProgress: 1, pending: 2 }, progress: { itemId: 3, step: 6, totalSteps: 20, progressImageUrl: null, message: '' } });
    mount();
    const button = screen.getByTestId('invoke-button');
    expect(button.textContent).toContain(t('params.invoke.generating'));
    expect(button.textContent).toContain('30%');
    expect(within(button).getByLabelText(t('params.invoke.queued', { count: 3 }))).toBeTruthy();
  });
});

describe('the job being drawn', () => {
  it('shows nothing while no job runs', () => {
    mount();
    expect(screen.queryByTestId('phone-live-chip')).toBeNull();
  });

  it('shows the step in the title bar and the picture full screen, closing when the job ends', () => {
    useQueue.setState({ items: [running(9)], progress: { itemId: 9, step: 5, totalSteps: 25, progressImageUrl: 'data:image/png;base64,AA==', message: '' } });
    mount();
    const chip = screen.getByTestId('phone-live-chip');
    expect(chip.textContent).toContain('5/25');
    fireEvent.click(chip);
    const view = screen.getByTestId('phone-view');
    expect(within(view).getByTestId('viewer-live')).toBeTruthy();
    expect(usePhone.getState().view).toEqual({ kind: 'live', itemId: 9 });
    act(() => useQueue.setState({ items: [running(9, { status: 'completed' })] }));
    expect(screen.queryByTestId('phone-view')).toBeNull();
    expect(usePhone.getState().view).toBeNull();
  });

  it('closes full screen with its button', () => {
    useQueue.setState({ items: [running(9)], progress: null });
    mount();
    fireEvent.click(screen.getByTestId('phone-live-chip'));
    fireEvent.click(screen.getByTestId('phone-view-close'));
    expect(screen.queryByTestId('phone-view')).toBeNull();
  });
});
