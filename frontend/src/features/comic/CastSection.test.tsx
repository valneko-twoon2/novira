// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { CAST_MAX, newProject } from '@/state/comic/document';
import { activeProject, useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { CastSection } from './CastSection';

function Open() {
  const project = useComic((s) => activeProject(s))!;
  const panel = project.pages[0]!.panels[0]!;
  return <CastSection panelId={panel.id} panelCast={panel.cast} panelImage={panel.imageName} cast={project.cast} />;
}

/** The cast as the design tab shows it: without a panel. */
function Design() {
  const project = useComic((s) => activeProject(s))!;
  return <CastSection cast={project.cast} />;
}

beforeEach(() => {
  useComic.getState().setProjects([newProject('Cast')]);
});
afterEach(cleanup);

const cast = () => activeProject(useComic.getState())!.cast;
const firstPanel = () => activeProject(useComic.getState())!.pages[0]!.panels[0]!;

describe('the cast of a comic in the panel tools', () => {
  it('keeps the words of a part, and drops a part that is emptied', () => {
    render(
      <TooltipProvider>
        <Open />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-cast-add'));
    fireEvent.change(screen.getByTestId('comic-cast-part-hair'), { target: { value: 'long black hair' } });
    fireEvent.change(screen.getByTestId('comic-cast-part-outfit'), { target: { value: 'navy blazer' } });
    expect(cast()[0]!.parts).toEqual({ hair: 'long black hair', outfit: 'navy blazer' });
    fireEvent.change(screen.getByTestId('comic-cast-part-outfit'), { target: { value: '' } });
    expect(cast()[0]!.parts).toEqual({ hair: 'long black hair' });
    fireEvent.change(screen.getByTestId('comic-cast-part-hair'), { target: { value: '' } });
    expect(cast()[0]!.parts).toBeUndefined();
  });

  it('offers the person of the pose only for a character in a panel with a pose, and shows who it is', () => {
    const add = () => useComic.getState().setCast([{ id: 'a', name: 'Jin', tags: '1boy', imageName: null }]);
    add();
    const { rerender } = render(
      <TooltipProvider>
        <CastSection panelId={firstPanel().id} panelCast={['a']} panelImage={null} cast={cast()} />
      </TooltipProvider>,
    );
    expect(screen.queryByTestId('comic-cast-pose-person')).toBeNull();
    rerender(
      <TooltipProvider>
        <CastSection panelId={firstPanel().id} panelCast={['a']} panelImage={null} cast={cast()} posePeople={2} poseCast={[null, 'a']} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('comic-cast-pose-person').textContent).toContain(t('comic.cast.posePersonN', { n: 2 }));
    expect(screen.getByText(t('comic.cast.posePersonHelp'))).toBeTruthy();
  });

  it('marks a character as not human with the checkbox', () => {
    render(
      <TooltipProvider>
        <Open />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-cast-add'));
    fireEvent.click(screen.getByLabelText(t('comic.cast.nonHuman')));
    expect(cast()[0]!.nonHuman).toBe(true);
  });

  it('adds a character, edits its name and look, and puts it in the selected panel', () => {
    render(
      <TooltipProvider>
        <Open />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-cast-add'));
    expect(cast()).toHaveLength(1);
    fireEvent.change(screen.getByTestId('comic-cast-name'), { target: { value: 'Grandpa' } });
    fireEvent.change(screen.getByTestId('comic-cast-tags'), { target: { value: '1boy, old man, flat cap' } });
    expect(cast()[0]).toMatchObject({ name: 'Grandpa', tags: '1boy, old man, flat cap' });
    const inPanel = () => screen.getByRole('checkbox', { name: t('comic.cast.inPanelOf', { name: 'Grandpa' }) });
    fireEvent.click(inPanel());
    expect(firstPanel().cast).toEqual([cast()[0]!.id]);
    fireEvent.click(inPanel());
    expect(firstPanel().cast).toEqual([]);
  });

  it('removing a character takes it out of the panels too, and the cast stops at its limit', () => {
    render(
      <TooltipProvider>
        <Open />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-cast-add'));
    fireEvent.click(screen.getByRole('checkbox', { name: t('comic.cast.inPanelOf', { name: t('comic.cast.newName', { number: 1 }) }) }));
    expect(firstPanel().cast).toHaveLength(1);
    fireEvent.click(screen.getByTestId('comic-cast-remove'));
    expect(cast()).toEqual([]);
    expect(firstPanel().cast).toEqual([]);
    for (let i = 0; i < CAST_MAX + 2; i++) if (!(screen.getByTestId('comic-cast-add') as HTMLButtonElement).disabled) fireEvent.click(screen.getByTestId('comic-cast-add'));
    expect(cast()).toHaveLength(CAST_MAX);
    expect((screen.getByTestId('comic-cast-add') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows one character at a time: the list picks it, a new one is shown, and a removed one gives way to the first', () => {
    render(
      <TooltipProvider>
        <Open />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-cast-add'));
    fireEvent.change(screen.getByTestId('comic-cast-name'), { target: { value: 'Mio' } });
    fireEvent.click(screen.getByTestId('comic-cast-add'));
    fireEvent.change(screen.getByTestId('comic-cast-name'), { target: { value: 'Jin' } });
    expect(screen.getAllByTestId('comic-cast-entry')).toHaveLength(2);
    expect(screen.getAllByTestId('comic-cast-row')).toHaveLength(1);
    expect(cast().map((c) => c.name)).toEqual(['Mio', 'Jin']);
    const picks = () => screen.getAllByTestId('comic-cast-pick');
    expect(picks().map((p) => p.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    fireEvent.click(picks()[0]!);
    expect((screen.getByTestId('comic-cast-name') as HTMLInputElement).value).toBe('Mio');
    // Each character of the list says whether it is in the panel, by its own name.
    fireEvent.click(screen.getByRole('checkbox', { name: t('comic.cast.inPanelOf', { name: 'Jin' }) }));
    expect(firstPanel().cast).toEqual([cast()[1]!.id]);
    fireEvent.click(screen.getByTestId('comic-cast-remove'));
    expect((screen.getByTestId('comic-cast-name') as HTMLInputElement).value).toBe('Jin');
  });

  it('edits the words of a character in the larger window too, in the design tab only', () => {
    const { unmount } = render(
      <TooltipProvider>
        <Open />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-cast-add'));
    // In the panel tools the words have the popover's width, and a window would open under the popover.
    expect(screen.queryByTestId('comic-cast-words-open')).toBeNull();
    unmount();
    render(
      <TooltipProvider>
        <Design />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-cast-words-open'));
    const dialog = screen.getByTestId('comic-cast-words');
    expect(dialog).toBeTruthy();
    fireEvent.change(screen.getByTestId('comic-cast-words-part-outfit'), { target: { value: 'cream cardigan, muted blue skirt, white blouse' } });
    fireEvent.change(screen.getByTestId('comic-cast-words-negative'), { target: { value: 'glasses' } });
    expect(cast()[0]).toMatchObject({ parts: { outfit: 'cream cardigan, muted blue skirt, white blouse' }, negative: 'glasses' });
    // The boxes under the character show the same words.
    expect((screen.getByTestId('comic-cast-part-outfit') as HTMLTextAreaElement).value).toBe('cream cardigan, muted blue skirt, white blouse');
  });

  it('takes the selected panel picture as the reference of a character, and lets it go', () => {
    render(
      <TooltipProvider>
        <Open />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-cast-add'));
    expect((screen.getByTestId('comic-cast-ref-use') as HTMLButtonElement).disabled).toBe(true);
    act(() => useComic.getState().setPanelImage(firstPanel().id, 'bench.png'));
    fireEvent.click(screen.getByTestId('comic-cast-ref-use'));
    expect(cast()[0]!.imageName).toBe('bench.png');
    expect((screen.getByTestId('comic-cast-ref-use') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('comic-cast-ref-clear'));
    expect(cast()[0]!.imageName).toBeNull();
  });
});
