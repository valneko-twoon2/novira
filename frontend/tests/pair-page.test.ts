// @vitest-environment jsdom
// The phone's pairing page of novira-server (backend/crates/novira-server/src/pair/page.js), run on its own HTML: the code
// in the address's fragment stays there until it is used, so the page can be opened in another browser (a QR reader's own
// view handed on to Safari or Chrome), and is dropped once the request is sent.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PAIR = join(import.meta.dirname, '../../backend/crates/novira-server/src/pair');
const html = readFileSync(join(PAIR, 'page.html'), 'utf8');
const strings = readFileSync(join(PAIR, 'strings.json'), 'utf8');
const script = readFileSync(join(PAIR, 'page.js'), 'utf8').replace('__STRINGS__', strings);
const CODE = '0123456789abcdef0123456789abcdef';

/** Opens the page at `address` with `fetch` answering `status` and `body` to the request. */
function open(address: string, status = 200, body: unknown = { poll: 'p', confirm: '123456' }) {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html>/, '').replace(/<\/html>[\s\S]*$/, '');
  history.replaceState(null, '', address);
  const fetch = vi.fn(async (path: string, _init?: RequestInit) => (path === '/pair/request' ? new Response(JSON.stringify(body), { status }) : new Response(JSON.stringify({ state: 'pending' }))));
  vi.stubGlobal('fetch', fetch);
  runInThisContext(script);
  return fetch;
}

const send = () => document.getElementById('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
const message = () => document.getElementById('message')!.textContent;
/** jsdom's language is English. */
const en = JSON.parse(strings).en as Record<string, string>;

describe('the phone pairing page', () => {
  // The page polls every two seconds once a request waits: fake timers keep that from running on after a test.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps the code in the address until it is used, so another browser can open it', async () => {
    const fetch = open(`/pair#${CODE}`);
    expect(location.hash).toBe(`#${CODE}`);
    expect(document.getElementById('form')!.hidden).toBe(false);
    send();
    await vi.waitFor(() => expect(document.getElementById('confirm')!.hidden).toBe(false));
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string).code).toBe(CODE);
    expect(location.pathname + location.hash).toBe('/pair');
  });

  it('drops a code the server refused as wrong or used, and keeps one for a name to fix', async () => {
    open(`/pair#${CODE}`, 400, { code: 'bad_label' });
    send();
    await vi.waitFor(() => expect(message()).toBe(en.badLabel));
    expect((document.getElementById('send') as HTMLButtonElement).disabled).toBe(false);
    expect(location.hash).toBe(`#${CODE}`);
    open(`/pair#${CODE}`, 403, { code: 'bad_code' });
    send();
    await vi.waitFor(() => expect(location.hash).toBe(''));
  });

  it('says there is no code when the address has none', () => {
    open('/pair');
    expect(document.getElementById('form')!.hidden).toBe(true);
    expect(message()).toBe(en.noCode);
  });
});
