// @vitest-environment jsdom
// The large view of the Candidates view: opened by a double click or Enter, moved through with ← →, ✓ (Enter) and ×
// (Delete) then on to the next, Esc back to the list; the phone layout keeps its own large view.
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useDrafts } from '@/state/drafts';
import { useGallery } from '@/state/gallery';
import { batch, candidate, cleanupDrafts, group, made, picture, resetDrafts, show } from './drafts.testkit';

beforeEach(resetDrafts);
afterEach(cleanupDrafts);

const cellButton = (i: number) => within(screen.getAllByTestId('draft-cell')[i]!).getByRole('button', { name: /seed/ });
const shownName = () => screen.getByTestId('drafts-large-image').getAttribute('data-name');
const key = (k: string) => fireEvent.keyDown(screen.getByTestId('drafts-large'), { key: k });

/** A generation batch of three drawn pictures and a batch of two drafts, one not drawn yet (it has no picture to show). */
function setup() {
  const adopt = vi.fn().mockResolvedValue(undefined);
  const finish = vi.fn().mockResolvedValue(undefined);
  useDrafts.setState({ adopt, finish, groups: [group('d', [candidate(1), candidate(2, { status: 'queued', imageName: null })]), batch('g', [made(3), made(4), made(5)])] });
  useGallery.setState({ images: ['d1.png', 'g3.png', 'g4.png', 'g5.png'].map((n) => picture(n)) });
  show();
  return { adopt, finish };
}

describe('the large view', { tags: [] }, () => {
  it('opened again on a picture no longer in the flow returns to the list instead of showing another picture', { tags: ['regression', 'error-guessing'] }, () => {
    setup();
    act(() => useDrafts.getState().setViewing('gone'));
    expect(screen.queryByTestId('drafts-large')).toBeNull();
    expect(useDrafts.getState().viewing).toBeNull();
    expect(screen.getAllByTestId('draft-cell')).toHaveLength(5);
  });

  it('opened again on a picture of a batch past the limit shows that very picture', { tags: ['regression', 'boundary'] }, () => {
    const many = Array.from({ length: 9 }, (_, i) => batch(`b${i}`, [made(10 + i)]));
    useDrafts.setState({ groups: many });
    useGallery.setState({ images: many.map((_, i) => picture(`g${10 + i}.png`)) });
    useDrafts.getState().setViewing(many[0]!.candidates[0]!.id);
    show();
    expect(shownName()).toBe('g10.png');
  });

  it('opens on a double click or Enter, and Esc or the back button returns to the list', { tags: ['state-transition'] }, () => {
    setup();
    fireEvent.doubleClick(cellButton(1));
    expect(shownName()).toBe('g4.png');
    expect(screen.queryByTestId('draft-cell')).toBeNull();
    // The selection bar and the list are away while it shows.
    expect(screen.queryByTestId('drafts-grid')).toBeNull();
    key('Escape');
    expect(screen.queryByTestId('drafts-large')).toBeNull();
    fireEvent.keyDown(cellButton(0), { key: 'Enter' });
    expect(shownName()).toBe('g3.png');
    fireEvent.click(screen.getByTestId('drafts-large-back'));
    expect(screen.getAllByTestId('draft-cell')).toHaveLength(5);
    // A candidate with no picture yet does not open.
    fireEvent.doubleClick(cellButton(4));
    expect(screen.queryByTestId('drafts-large')).toBeNull();
  });

  it('shows the way back to the list as a button with its words, not an icon alone', { tags: ['regression'] }, () => {
    setup();
    fireEvent.doubleClick(cellButton(0));
    const back = screen.getByTestId('drafts-large-back');
    expect(back.textContent).toBe(t('drafts.view.back'));
    expect(back.querySelector('svg')).not.toBeNull();
    expect(back.classList.contains('ui-btn--ghost')).toBe(false);
  });

  it('moves through the pictures of the flow with the arrows and the buttons, stopping at both ends', { tags: ['boundary'] }, () => {
    setup();
    fireEvent.doubleClick(cellButton(0));
    expect((screen.getByTestId('drafts-large-prev') as HTMLButtonElement).disabled).toBe(true);
    key('ArrowLeft');
    expect(shownName()).toBe('g3.png');
    key('ArrowRight');
    fireEvent.click(screen.getByTestId('drafts-large-next'));
    key('ArrowRight');
    // Across the batches; the draft not drawn yet is not among them.
    expect(shownName()).toBe('d1.png');
    expect((screen.getByTestId('drafts-large-next') as HTMLButtonElement).disabled).toBe(true);
    key('ArrowRight');
    expect(shownName()).toBe('d1.png');
    fireEvent.click(screen.getByTestId('drafts-large-prev'));
    expect(shownName()).toBe('g5.png');
  });

  it('shows the rest in a strip, the current one marked, and jumps to one clicked', { tags: ['scenario'] }, () => {
    setup();
    fireEvent.doubleClick(cellButton(1));
    const thumbs = screen.getAllByTestId('drafts-strip-thumb');
    expect(thumbs).toHaveLength(4);
    expect(thumbs.map((b) => b.getAttribute('aria-current'))).toEqual(['false', 'true', 'false', 'false']);
    fireEvent.click(thumbs[3]!);
    expect(shownName()).toBe('d1.png');
  });

  it('puts a picture on the board with Enter and shows the next one', { tags: ['scenario'] }, () => {
    const { adopt } = setup();
    fireEvent.doubleClick(cellButton(0));
    key('Enter');
    expect(adopt).toHaveBeenCalledWith('g', ['c3']);
    expect(shownName()).toBe('g4.png');
    fireEvent.click(screen.getByTestId('drafts-large-accept'));
    expect(adopt).toHaveBeenLastCalledWith('g', ['c4']);
    expect(shownName()).toBe('g5.png');
  });

  it('finishes a draft with Enter and stays on the last one, which stays in the flow', { tags: ['boundary', 'decision-table'] }, () => {
    const { finish } = setup();
    fireEvent.doubleClick(cellButton(3));
    key('Enter');
    expect(finish).toHaveBeenCalledWith('d', ['c1']);
    expect(shownName()).toBe('d1.png');
  });

  it('throws a picture away with Delete and shows the next, the one before at the end, and returns to the list when none is left', { tags: ['state-transition', 'boundary'] }, () => {
    useDrafts.setState({ groups: [group('d', [candidate(1), candidate(2)])] });
    useGallery.setState({ images: [picture('d1.png'), picture('d2.png')] });
    show();
    fireEvent.doubleClick(cellButton(0));
    key('Delete');
    expect(useDrafts.getState().groups[0]!.candidates.map((c) => c.id)).toEqual(['c2']);
    expect(shownName()).toBe('d2.png');
    fireEvent.click(screen.getByTestId('drafts-large-discard'));
    expect(useDrafts.getState().groups).toEqual([]);
    expect(screen.queryByTestId('drafts-large')).toBeNull();
  });

  it('does not take Enter from a focused button inside, nor keys pressed elsewhere', { tags: ['error-guessing'] }, () => {
    const { adopt } = setup();
    fireEvent.doubleClick(cellButton(0));
    fireEvent.keyDown(screen.getByTestId('drafts-large-back'), { key: 'Enter' });
    expect(adopt).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(useDrafts.getState().groups.find((g) => g.id === 'g')!.candidates).toHaveLength(3);
  });

  it('keeps the keys working after the focused button goes away or turns off', { tags: ['regression', 'error-guessing'] }, () => {
    // Keys go where the focus is, as in a browser: a removed or disabled button must not leave the focus on the page body.
    const press = (k: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k });
    setup();
    fireEvent.doubleClick(cellButton(1));
    const current = screen.getAllByTestId('drafts-strip-thumb')[1]!;
    current.focus();
    fireEvent.click(current);
    press('Delete');
    expect(shownName()).toBe('g5.png');
    press('ArrowLeft');
    expect(shownName()).toBe('g3.png');
    // To the end with the next button: it turns off there, and ← still works.
    const next = screen.getByTestId('drafts-large-next') as HTMLButtonElement;
    next.focus();
    fireEvent.click(next);
    fireEvent.click(next);
    expect(next.disabled).toBe(true);
    if (document.activeElement === next) next.blur();
    press('ArrowLeft');
    expect(shownName()).toBe('g5.png');
  });

  it('gives way to the next picture when the one shown leaves by other means', { tags: ['error-guessing'] }, () => {
    setup();
    fireEvent.doubleClick(cellButton(1));
    // Dragged onto a board meanwhile.
    act(() => useGallery.getState().upsertImages([{ ...(picture('g4.png') as object), isIntermediate: false } as never]));
    expect(shownName()).toBe('g5.png');
  });
});

describe('the phone layout', { tags: [] }, () => {
  it('opens a picture in its own view from a button or a double click, and has no large view of its own', { tags: ['condition', 'scenario'] }, () => {
    useDrafts.setState({ groups: [group('a', [candidate(1), candidate(2, { status: 'queued', imageName: null })])] });
    useGallery.setState({ images: [picture('d1.png')] });
    const onOpen = vi.fn();
    show(onOpen);
    expect(screen.getAllByTestId('draft-open')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('draft-open'));
    expect(onOpen).toHaveBeenCalledWith('d1.png');
    expect(useDrafts.getState().selection).toEqual([]);
    fireEvent.doubleClick(cellButton(0));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('drafts-large')).toBeNull();
  });

  it('has no open button in the desktop layout', { tags: ['condition'] }, () => {
    useDrafts.setState({ groups: [group('a', [candidate(1)])] });
    useGallery.setState({ images: [picture('d1.png')] });
    show();
    expect(screen.queryByTestId('draft-open')).toBeNull();
  });
});
