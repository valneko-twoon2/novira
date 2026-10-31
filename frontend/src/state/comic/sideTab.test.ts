// Which tab the comic screen's right column shows.
import { afterEach, describe, expect, it } from 'vitest';
import { useComicSideTab } from './sideTab';

afterEach(() => useComicSideTab.setState({ right: 'assistant' }));

describe('the right tab of the comic screen', () => {
  it('starts on the assistant and switches to the gallery and back', () => {
    expect(useComicSideTab.getState().right).toBe('assistant');
    useComicSideTab.getState().setRight('gallery');
    expect(useComicSideTab.getState().right).toBe('gallery');
    useComicSideTab.getState().setRight('assistant');
    expect(useComicSideTab.getState().right).toBe('assistant');
  });
});
