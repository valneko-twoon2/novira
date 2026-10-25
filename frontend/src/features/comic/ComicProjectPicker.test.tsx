// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { ComicProjectPicker } from './ComicProjectPicker';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  setLocale('en');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLocale('ja');
});

const renderPicker = () =>
  render(
    <TooltipProvider>
      <ComicProjectPicker />
    </TooltipProvider>,
  );

describe('the comic chooser', () => {
  it('shows the open comic and how many pages it has, and opens another from its list', () => {
    const first = newProject('First');
    const second = newProject('Second');
    useComic.getState().setProjects([first, second]);
    renderPicker();
    expect(screen.getByTestId('comic-project-picker').textContent).toContain('First');
    expect(screen.getByTestId('comic-project-bar').textContent).toContain('1 page');

    fireEvent.click(screen.getByTestId('comic-project-picker'));
    const items = screen.getAllByTestId('comic-project-item');
    expect(items).toHaveLength(2);
    fireEvent.click(items[1]!.querySelector('.pp-picker__item')!);
    expect(useComic.getState().activeProjectId).toBe(second.id);
  });

  it('makes a new comic from the foot of its list, named in a dialog', () => {
    useComic.getState().setProjects([]);
    renderPicker();
    expect(screen.getByTestId('comic-project-picker').textContent).toContain(t('comic.project.choose'));
    fireEvent.click(screen.getByTestId('comic-project-picker'));
    expect(screen.getByText(t('comic.project.empty'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('comic-new'));
    const name = screen.getByRole('textbox');
    fireEvent.change(name, { target: { value: 'Harbour' } });
    fireEvent.submit(name.closest('form')!);
    expect(useComic.getState().projects.map((p) => p.name)).toEqual(['Harbour']);
  });
});
