// Backend selection: the Rust backend inside the desktop app, the Rust backend over HTTP on a page that novira-server served, otherwise the mock. The mock is a chunk of its own, loaded only in a plain browser (mockModule.ts), so the desktop app does not load it. `?scenario=empty` starts the mock with an empty gallery; `?engine=install` makes it pretend the image engine is being installed. The mock keeps its comics in the session storage, so they survive a reload.
import type { BackendClient } from './client';
import { mockPicture } from './mock/mockPictures';
import { mockModule, type MockModule } from './mockModule';
import { HttpBackend, isServedByServer } from './http/HttpBackend';
import { serverLanApi, type LanApi } from './http/lan';
import { isTauri, TauriBackend } from './tauri/TauriBackend';

function scenario(): 'default' | 'empty' {
  if (typeof location === 'undefined') return 'default';
  return new URLSearchParams(location.search).get('scenario') === 'empty' ? 'empty' : 'default';
}

function engineInstall(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).get('engine') === 'install';
}

/** The browser's session storage, where the mock keeps its comics across a reload; none in tests. */
function comicStorage(): Storage | null {
  try {
    return import.meta.env.MODE !== 'test' && typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function mockBackend({ MockBackend }: MockModule): BackendClient {
  return new MockBackend(scenario(), engineInstall(), comicStorage());
}

const native: BackendClient | undefined = isTauri() ? new TauriBackend() : isServedByServer() ? new HttpBackend() : undefined;
const mock = native ? undefined : mockModule();

/**
 * The backend the screens talk to. Inside the app and on a served page it is set at once; the browser mock is set when
 * its chunk has loaded (`backendReady`), and start-up (main.tsx) waits for that before it loads the app.
 */
export let backend: BackendClient = native ?? (mock && !(mock instanceof Promise) ? mockBackend(mock) : (undefined as unknown as BackendClient));

/** Settles when `backend` is set. */
export const backendReady: Promise<void> =
  mock instanceof Promise
    ? mock.then((m) => {
        backend = mockBackend(m);
      })
    : Promise.resolve();

/**
 * Whether a file or folder can be picked in a native dialog: the desktop app opens one, the mock stands in for it, and a
 * page on the browser server has none, so the controls built on it say they need the desktop app there.
 */
export function hasNativeDialogs(): boolean {
  return backend.kind !== 'http';
}

/** The picture the browser mock stands in for a cover that is missing. The desktop app has none, so the cover stays empty there. */
export function standInCover(key: string | number): string | undefined {
  return backend.kind === 'mock' ? mockPicture(key) : undefined;
}

/**
 * The home network of the page's own server, to open and close it, trust a network and approve phones: the server's on a
 * page that `novira-server` served, the mock's (a pretend one, `?lan`) in a plain browser, none in the desktop app. Whether
 * this page may use it is answered by `state()` (a phone gets nothing).
 */
export async function getLanApi(): Promise<LanApi | null> {
  const served = serverLanApi();
  if (served) return served;
  if (backend.kind !== 'mock' || typeof location === 'undefined') return null;
  const flag = new URLSearchParams(location.search).get('lan');
  return flag === null ? null : (await import('./mock/mockLan')).mockLan(flag);
}

export type { BackendClient } from './client';
export * from './types';
export { loadImage } from './mock/imageSynth';
export { draftStep } from './draft';
export { FAMILY_SAMPLING, fixedSampling, samplingLabel } from './familySampling';
export { canOpenNewWindow, openInNewWindow } from './openWindow';
export type { LanApi, LanDevice, LanFailure, LanPending, LanResult, LanState, PairingCode } from './http/lan';
export { perf } from './perf';
export { randomSeed, batchSeed, mulberry32, MAX_SEED } from './mock/random';
