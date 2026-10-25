import { beforeEach, describe, expect, it } from 'vitest';
import { useGallery } from '@/state/gallery';
import { clickImage, moveSelection } from './selection';

const initial = useGallery.getState();
beforeEach(() => useGallery.setState(initial, true));

describe('keyboard selection moves', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('moves by a number of positions, clamped to the list', () => {
    useGallery.getState().setSelection(['b']);
    expect(moveSelection(list, 1, false)).toBe(2);
    expect(useGallery.getState().selection).toEqual(['c']);
    expect(moveSelection(list, 10, false)).toBe(3);
  });

  it('moves to the index a step function picks (rows of the grid layout)', () => {
    useGallery.getState().setSelection(['a']);
    expect(moveSelection(list, (i) => i + 3, false)).toBe(3);
    expect(moveSelection(list, () => -5, false)).toBe(0);
    expect(useGallery.getState().selection).toEqual(['a']);
  });

  it('starts at the first image when nothing is selected, and does nothing on an empty list', () => {
    expect(moveSelection(list, (i) => i + 2, false)).toBe(0);
    expect(moveSelection([], 1, false)).toBeNull();
  });
});

describe('selection by clicking', () => {
  const none = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
  const list = ['a', 'b', 'c', 'd', 'e'];
  const selection = () => useGallery.getState().selection;

  it('selects the clicked picture alone', () => {
    clickImage('b', none, list);
    expect(selection()).toEqual(['b']);
    clickImage('c', none, list);
    expect(selection()).toEqual(['c']);
  });

  it('adds and removes pictures with Ctrl', () => {
    clickImage('a', none, list);
    clickImage('c', { ...none, ctrlKey: true }, list);
    expect(selection()).toEqual(['a', 'c']);
    clickImage('a', { ...none, ctrlKey: true }, list);
    expect(selection()).toEqual(['c']);
  });

  it('selects a range from the last clicked picture with Shift, in either direction', () => {
    clickImage('b', none, list);
    clickImage('d', { ...none, shiftKey: true }, list);
    expect(selection()).toEqual(['b', 'c', 'd']);
    clickImage('a', { ...none, shiftKey: true }, list);
    expect(selection()).toEqual(['b', 'a']);
  });

  it('falls back to a plain click when the range ends are not in the list', () => {
    clickImage('b', none, list);
    clickImage('zzz', { ...none, shiftKey: true }, list);
    expect(selection()).toEqual(['zzz']);
  });

  it('compares with the picture open in the viewer on Alt-click, or selects it when it is the open one', () => {
    useGallery.setState({ viewerImageName: 'a' });
    clickImage('c', { ...none, altKey: true }, list);
    expect(useGallery.getState().compareImageName).toBe('c');
    clickImage('a', { ...none, altKey: true }, list);
    expect(selection()).toEqual(['a']);
  });
});

describe('extending the selection from the keyboard', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('grows the range from the anchor, and moves the viewer picture when nothing is selected', () => {
    clickImage('b', { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, list);
    moveSelection(list, 2, true);
    expect(useGallery.getState().selection).toEqual(['b', 'c', 'd']);
    useGallery.setState({ selection: [], viewerImageName: 'c' });
    expect(moveSelection(list, -1, false)).toBe(1);
  });
});
