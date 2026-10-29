// @vitest-environment jsdom
// The balloon editor beside the page: every control writes to the balloon, a change of shape brings the new shape's look,
// and the controls that do not apply to a shape (tail, spikes, the look of lettering) are not offered.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '@/i18n';
import { newProject, type BubbleKind, type ComicBubble } from '@/state/comic/document';
import { DEFAULT_STAMP_ID } from '@/state/comic/stamps';
import { findPanel, useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { BubbleEditor } from './BubbleEditor';

let panelId = '';
let bubbleId = '';
const bubble = (): ComicBubble => findPanel(useComic.getState().projects, panelId)!.panel.bubbles.find((b) => b.id === bubbleId)!;

function Host() {
  const b = useComic((s) => findPanel(s.projects, panelId)?.panel.bubbles.find((x) => x.id === bubbleId));
  return b ? <BubbleEditor panelId={panelId} bubble={b} /> : <p data-testid="gone" />;
}

function open(kind: BubbleKind = 'speech') {
  const project = newProject('Editor');
  panelId = project.pages[0]!.panels[0]!.id;
  useComic.getState().setProjects([project]);
  bubbleId = useComic.getState().addBubble(panelId, kind)!;
  return render(
    <TooltipProvider>
      <Host />
    </TooltipProvider>,
  );
}

const setNum = (label: string, value: string) => {
  const input = screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
const choose = (label: string, option: string) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: option }));
};

beforeEach(() => {
  setLocale('en');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    cb();
    return 0;
  });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useComic.setState({ bubbleShaping: false });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLocale('ja');
});

describe('the words of a balloon', () => {
  it('takes the typing at once, and writes the words', () => {
    open();
    const field = screen.getByLabelText(t('comic.bubble.text')) as HTMLTextAreaElement;
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 'Hi there' } });
    expect(bubble().text).toBe('Hi there');
  });

  it('closes the editor on Escape in the field, and keeps other keys from reaching the page', () => {
    open();
    const pageKey = vi.fn();
    window.addEventListener('keydown', pageKey);
    const field = screen.getByLabelText(t('comic.bubble.text'));
    act(() => useComic.getState().openBubbleEditor(panelId, bubbleId));
    fireEvent.keyDown(field, { key: 'Delete' });
    expect(pageKey).not.toHaveBeenCalled();
    expect(useComic.getState().bubbleEditor).toBe(true);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(useComic.getState().bubbleEditor).toBe(false);
    window.removeEventListener('keydown', pageKey);
  });

  it('wraps the selected words in bold marks, and takes the marks off again', () => {
    open();
    act(() => useComic.getState().updateBubble(panelId, bubbleId, { text: 'hello world' }));
    const field = screen.getByLabelText(t('comic.bubble.text')) as HTMLTextAreaElement;
    field.setSelectionRange(0, 5);
    fireEvent.click(screen.getByTestId('comic-bubble-bold'));
    const marked = bubble().text;
    expect(marked).not.toBe('hello world');
    expect(marked).toContain('hello');
    // The same words stay selected (inside the marks), and a second press takes the marks off them.
    field.setSelectionRange(marked.indexOf('hello'), marked.indexOf('hello') + 5);
    fireEvent.click(screen.getByTestId('comic-bubble-bold'));
    expect(bubble().text).toBe('hello world');
  });

  it('wraps the selected words in emphasis dots', () => {
    open();
    act(() => useComic.getState().updateBubble(panelId, bubbleId, { text: 'abc' }));
    (screen.getByLabelText(t('comic.bubble.text')) as HTMLTextAreaElement).setSelectionRange(1, 2);
    fireEvent.click(screen.getByTestId('comic-bubble-dots'));
    expect(bubble().text).not.toBe('abc');
    expect(bubble().text).toContain('b');
  });

  it('keeps the field selection when a mark button is pressed (no focus change)', () => {
    open();
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    screen.getByTestId('comic-bubble-bold').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('picks a font', async () => {
    open();
    fireEvent.click(screen.getByTestId('comic-bubble-font'));
    fireEvent.click((await screen.findAllByTestId('font-option'))[1]!);
    expect(bubble().font).not.toBeNull();
  });
});

describe('the shape and the look', () => {
  it('writes the toggles: vertical, tail, dark', () => {
    open();
    fireEvent.click(screen.getByTestId('comic-bubble-vertical'));
    expect(bubble().vertical).toBe(true);
    fireEvent.click(screen.getByTestId('comic-bubble-tail-toggle'));
    expect(bubble().tail).toBeNull();
    fireEvent.click(screen.getByTestId('comic-bubble-tail-toggle'));
    expect(bubble().tail).not.toBeNull();
    fireEvent.click(screen.getByTestId('comic-bubble-dark'));
    expect(bubble().dark).toBe(true);
  });

  it('writes the sliders of the look, kept within their ranges', () => {
    open();
    setNum(t('comic.bubble.size'), '1.5');
    expect(bubble().scale).toBeCloseTo(1.5);
    setNum(t('comic.bubble.lineWidth'), '2');
    expect(bubble().lineWidth).toBeCloseTo(2);
    setNum(t('comic.bubble.rough'), '0.8');
    expect(bubble().rough).toBeCloseTo(0.8);
    setNum(t('comic.bubble.width'), '1.2');
    expect(bubble().width).toBeCloseTo(1.2);
    setNum(t('comic.bubble.height'), '1.3');
    expect(bubble().height).toBeCloseTo(1.3);
    setNum(t('comic.bubble.tailWidth'), '1.1');
    expect(bubble().tailWidth).toBeCloseTo(1.1);
    setNum(t('comic.bubble.tailCurve'), '0.5');
    expect(bubble().tailCurve).toBeCloseTo(0.5);
    setNum(t('comic.bubble.lineWidth'), '999');
    expect(bubble().lineWidth).toBeLessThanOrEqual(4);
  });

  it('changes the line from its list', () => {
    open();
    choose(t('comic.bubble.lineLabel'), t('comic.bubble.line.double'));
    expect(bubble().line).toBe('double');
  });

  it('offers spikes and depth only to shapes that have them, and the tail sliders only while there is a tail', () => {
    open();
    expect(screen.queryByLabelText(t('comic.bubble.spikes'))).toBeNull();
    expect(screen.queryByLabelText(t('comic.bubble.depth'))).toBeNull();
    act(() => useComic.getState().updateBubble(panelId, bubbleId, { tail: null }));
    expect(screen.queryByLabelText(t('comic.bubble.tailWidth'))).toBeNull();
    cleanup();
    open('shout');
    setNum(t('comic.bubble.spikes'), '20');
    expect(bubble().spikes).toBe(20);
    setNum(t('comic.bubble.depth'), '0.3');
    expect(bubble().depth).toBeCloseTo(0.3);
  });

  it('brings the new look of a shape when the shape changes, and a tail when the new shape needs one', () => {
    open('caption');
    expect(bubble().tail).toBeNull();
    choose(t('comic.bubble.kindLabel'), t('comic.bubble.kind.shout'));
    expect(bubble().kind).toBe('shout');
    expect(bubble().spikes).toBe(16);
    expect(bubble().tail).not.toBeNull();
    choose(t('comic.bubble.kindLabel'), t('comic.bubble.kind.flash'));
    expect(bubble().kind).toBe('flash');
    expect(bubble().line).toBe('none');
  });

  it('asks for the words to be fitted', () => {
    open();
    fireEvent.click(screen.getByTestId('comic-bubble-fit'));
    expect(useComic.getState().fittingBubbleIds).toContain(bubbleId);
  });
});

describe('the outline', () => {
  it('starts and stops shaping by hand, giving the balloon an outline to shape', () => {
    open();
    expect(bubble().outline ?? null).toBeNull();
    fireEvent.click(screen.getByTestId('comic-bubble-shape'));
    expect(useComic.getState().bubbleShaping).toBe(true);
    expect(bubble().outline).not.toBeNull();
    expect(screen.getByText(t('comic.bubble.shapeHint'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('comic-bubble-shape'));
    expect(useComic.getState().bubbleShaping).toBe(false);
    expect(bubble().outline).not.toBeNull();
  });

  it('smooths the outline, and resets it', () => {
    open();
    fireEvent.click(screen.getByTestId('comic-bubble-shape'));
    const smooth = bubble().outline!.smooth;
    fireEvent.click(screen.getByTestId('comic-bubble-smooth'));
    expect(bubble().outline!.smooth).toBe(!smooth);
    fireEvent.click(screen.getByTestId('comic-bubble-shape-reset'));
    expect(bubble().outline ?? null).toBeNull();
    expect(useComic.getState().bubbleShaping).toBe(false);
    expect(screen.queryByTestId('comic-bubble-smooth')).toBeNull();
  });
});

describe('lettering and stamps', () => {
  it('shows a rotation slider instead of the look for lettering, and no tail button', () => {
    open('sfx');
    expect(screen.queryByTestId('comic-bubble-tail-toggle')).toBeNull();
    expect(screen.queryByTestId('comic-bubble-dark')).toBeNull();
    setNum(t('comic.bubble.rotation'), '30');
    expect(bubble().rotation).toBe(30);
  });

  it('shows the stamp picker for a stamp, which holds the stamp id as its words, and no words field', () => {
    open('stamp');
    expect(screen.queryByLabelText(t('comic.bubble.text'))).toBeNull();
    expect(screen.queryByTestId('comic-bubble-vertical')).toBeNull();
    expect(bubble().text).toBe(DEFAULT_STAMP_ID);
    const tiles = screen.getAllByTestId('comic-stamp-tile');
    fireEvent.click(tiles[tiles.length - 1]!);
    expect(bubble().text).not.toBe('');
  });

  it('gives a balloon turned into a stamp a stamp, and clears the id when it stops being one', () => {
    open('speech');
    act(() => useComic.getState().updateBubble(panelId, bubbleId, { text: 'words' }));
    choose(t('comic.bubble.kindLabel'), t('comic.bubble.kind.stamp'));
    expect(bubble().text).toBe(DEFAULT_STAMP_ID);
    choose(t('comic.bubble.kindLabel'), t('comic.bubble.kind.speech'));
    expect(bubble().text).toBe('');
  });
});

describe('closing and removing', () => {
  it('closes with its button', () => {
    open();
    act(() => useComic.getState().openBubbleEditor(panelId, bubbleId));
    fireEvent.click(screen.getByTestId('comic-bubble-editor-close'));
    expect(useComic.getState().bubbleEditor).toBe(false);
  });

  it('removes the balloon', () => {
    open();
    fireEvent.click(screen.getByTestId('comic-bubble-remove'));
    expect(findPanel(useComic.getState().projects, panelId)!.panel.bubbles).toHaveLength(0);
    expect(screen.getByTestId('gone')).toBeTruthy();
  });
});
