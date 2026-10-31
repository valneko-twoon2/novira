// Whether the drawing settings being edited belong to the whole comic or to the page on screen.
import { afterEach, describe, expect, it } from 'vitest';
import { useDrawScope } from './drawScope';

afterEach(() => useDrawScope.setState({ scope: 'comic' }));

describe('the scope of the drawing settings', () => {
  it('starts on the whole comic', () => {
    expect(useDrawScope.getState().scope).toBe('comic');
  });

  it('switches to the page and back', () => {
    useDrawScope.getState().setScope('page');
    expect(useDrawScope.getState().scope).toBe('page');
    useDrawScope.getState().setScope('comic');
    expect(useDrawScope.getState().scope).toBe('comic');
  });
});
