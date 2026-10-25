// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { hideToken, withoutToken } from './hideToken';

describe('hideToken', () => {
  it('drops the token and keeps the rest of the address', () => {
    expect(withoutToken('http://127.0.0.1:5000/?token=abc')).toBe('/');
    expect(withoutToken('http://127.0.0.1:5000/?lan=open&token=abc#x')).toBe('/?lan=open#x');
  });

  it('leaves an address without a token alone', () => {
    expect(withoutToken('http://127.0.0.1:5000/?lan=open')).toBeNull();
    expect(withoutToken('http://127.0.0.1:5000/')).toBeNull();
  });

  it('rewrites the history entry in place', () => {
    window.history.replaceState(null, '', '/?token=abc&scenario=empty');
    const length = window.history.length;
    hideToken();
    expect(window.location.search).toBe('?scenario=empty');
    expect(window.history.length).toBe(length);
  });
});
