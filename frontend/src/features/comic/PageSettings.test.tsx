// @vitest-environment jsdom
// The page's settings popover: every control writes to the open page (or the comic), and the shapes button is only for pages
// whose panels were reshaped by hand.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '@/i18n';
import { FRAME_WIDTH_RANGE, newProject } from '@/state/comic/document';
import { MAX_PANELS_PER_PAGE } from '@/state/comic/layout';
import { useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { PageSettings } from './PageSettings';

const page = () => useComic.getState().projects[0]!.pages[0]!;
const project = () => useComic.getState().projects[0]!;

function Host() {
  const p = useComic((s) => s.projects[0]!);
  return <PageSettings page={p.pages[0]!} project={p} />;
}

async function startUp() {
  useComic.getState().setProjects([newProject('Settings')]);
  render(
    <TooltipProvider>
      <Host />
    </TooltipProvider>,
  );
  fireEvent.click(screen.getByTestId('comic-page-settings'));
  await screen.findByTestId('comic-pages');
}

/** Types into the number box of a labelled control (a slider shares the label) and commits. */
const setNum = (label: string, value: string) => {
  const input = screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
const choose = (label: string, option: string | RegExp) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: option }));
};

beforeEach(() => {
  setLocale('en');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLocale('ja');
});

describe('the page settings', () => {
  it('sets the number of panels, within the most a page holds', async () => {
    await startUp();
    setNum(t('comic.page.panelCount'), '5');
    expect(page().panels).toHaveLength(5);
    setNum(t('comic.page.panelCount'), '999');
    expect(page().panels).toHaveLength(MAX_PANELS_PER_PAGE);
    setNum(t('comic.page.panelCount'), '0');
    expect(page().panels).toHaveLength(1);
  });

  it('changes the columns, the paper and the reading direction from their lists', async () => {
    await startUp();
    choose(t('comic.page.columns'), /3/);
    expect(page().columns).toBe(3);
    choose(t('comic.page.size'), /^A5/);
    expect(page().size).toBe('A5');
    choose(t('comic.page.direction'), t('comic.page.direction.ltr'));
    expect(page().direction).toBe('ltr');
  });

  it('writes the frame width, the margin and the inset, kept within their ranges', async () => {
    await startUp();
    setNum(t('comic.page.frameWidth'), '1.5');
    expect(page().frameMm).toBeCloseTo(1.5);
    setNum(t('comic.page.frameWidth'), '50');
    expect(page().frameMm).toBe(FRAME_WIDTH_RANGE.max);
    setNum(t('comic.page.margin'), '4');
    expect(page().marginMm).toBe(4);
    setNum(t('comic.page.inset'), '2.5');
    expect(page().insetMm).toBe(2.5);
  });

  it('writes the frame colour', async () => {
    await startUp();
    fireEvent.change(screen.getByTestId('comic-frame-color'), { target: { value: '#ff0000' } });
    expect(page().frameColor).toBe('#ff0000');
  });

  it('sets the effect of the comic, and of the page or back to following the comic', async () => {
    await startUp();
    choose(t('comic.effect.comic'), t('comic.effect.sepia'));
    expect(project().effect).toBe('sepia');
    choose(t('comic.effect.page'), t('comic.effect.mono'));
    expect(page().effect).toBe('mono');
    choose(t('comic.effect.page'), t('comic.effect.follow'));
    expect(page().effect ?? null).toBeNull();
  });

  it('keeps the shapes button off while the layout is automatic, and resets hand-made shapes with it', async () => {
    await startUp();
    const reset = screen.getByTestId('comic-shape-reset') as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    expect(screen.getByText(t('comic.page.autoLayout'))).toBeTruthy();
    const quad = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    act(() => {
      useComic.setState((s) => ({ projects: s.projects.map((p) => ({ ...p, pages: p.pages.map((pg) => ({ ...pg, shapes: pg.panels.map(() => quad) })) })) }));
    });
    expect(reset.disabled).toBe(false);
    expect(screen.getByText(t('comic.shape.custom'))).toBeTruthy();
    fireEvent.click(reset);
    expect(page().shapes).toBeNull();
    expect(reset.disabled).toBe(true);
  });
});
