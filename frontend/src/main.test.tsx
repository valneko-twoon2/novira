// @vitest-environment jsdom
// The entry point: waits for the backend, then renders the first-start screen or the app, and logs a start-up failure.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const render = vi.fn();
const createRoot = vi.fn(() => ({ render }));
const mark = vi.fn();
let firstStart: () => Promise<unknown>;
let backendReady: Promise<void>;

function mockAll() {
  vi.doMock('react-dom/client', () => ({ createRoot }));
  vi.doMock('@/backend', () => ({ backendReady, firstStart: () => firstStart(), perf: { mark } }));
  vi.doMock('@/backend/http/hideToken', () => ({ hideToken: () => calls.push('hideToken') }));
  vi.doMock('@/i18n', () => ({ localeReady: async () => void calls.push('localeReady') }));
  vi.doMock('@/state/savedTheme', () => ({ savedTheme: () => 'light' }));
  vi.doMock('@/state/uiStateSync', () => ({ adoptBackendUiState: async () => void calls.push('adopt') }));
  vi.doMock('@/app/App', () => ({ App: function App() { return null; } }));
  vi.doMock('@/features/splash/FirstRun', () => ({ FirstRun: function FirstRun() { return null; } }));
}

const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  calls.length = 0;
  render.mockClear();
  createRoot.mockClear();
  mark.mockClear();
  backendReady = Promise.resolve();
  firstStart = async () => null;
  vi.resetModules();
  mockAll();
  document.body.replaceChildren(Object.assign(document.createElement('div'), { id: 'root' }));
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  vi.doUnmock('react-dom/client');
  vi.restoreAllMocks();
});

describe('main', () => {
  it('renders the app after adopting the saved state and theme, in that order', async () => {
    await import('./main');
    await settle();
    expect(calls).toEqual(['hideToken', 'adopt', 'localeReady']);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(mark.mock.calls.map((c) => c[0])).toEqual(['backend-ready', 'app-loaded']);
    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(render).toHaveBeenCalledTimes(1);
    const tree = render.mock.calls[0]![0] as { props: { children: { type: { name: string } } } };
    expect(tree.props.children.type.name).toBe('App');
  });

  it('renders only the folder screen on the very first start, without loading the app state', async () => {
    const info = { folders: [] };
    firstStart = async () => info;
    await import('./main');
    await settle();
    expect(calls).toEqual(['hideToken', 'localeReady']);
    expect(mark.mock.calls.map((c) => c[0])).toEqual(['backend-ready']);
    expect(document.documentElement.dataset.theme).toBeUndefined();
    const tree = render.mock.calls[0]![0] as { props: { children: { type: { name: string }; props: { initial: unknown } } } };
    expect(tree.props.children.type.name).toBe('FirstRun');
    expect(tree.props.children.props.initial).toBe(info);
  });

  it('logs a start-up failure to the console instead of leaving it unhandled', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    backendReady = Promise.reject(new Error('no backend'));
    backendReady.catch(() => undefined);
    await import('./main');
    await settle();
    expect(error).toHaveBeenCalledWith('novira: the app could not start', expect.objectContaining({ message: 'no backend' }));
    expect(render).not.toHaveBeenCalled();
  });

  it('does nothing when the page has no root element', async () => {
    document.body.replaceChildren();
    await import('./main');
    await settle();
    expect(createRoot).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});
