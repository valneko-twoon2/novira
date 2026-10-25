// @vitest-environment jsdom
// The "export all pages" menu: it offers PDF, CBZ and PSD, hands the project to the saver, and the file name stays valid.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n';
import { newProject } from '@/state/comic/document';
import { TooltipProvider } from '@/ui';
import { BookExport } from './BookExport';
import { bookFileName } from './saveBook';
import { pagePsdFileName } from './savePage';

const saveBook = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('./saveBook', async (original) => ({ ...(await original<typeof import('./saveBook')>()), saveBook }));

beforeEach(() => {
  setLocale('en');
  saveBook.mockClear();
});
afterEach(() => {
  cleanup();
  setLocale('ja');
});

describe('BookExport', () => {
  it('saves the project as a PDF, a CBZ or a ZIP of PSD pages from the menu', async () => {
    const project = newProject('Story');
    render(
      <TooltipProvider>
        <BookExport project={project} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId('comic-book-export'));
    fireEvent.click(await screen.findByTestId('comic-book-pdf'));
    await waitFor(() => expect(saveBook).toHaveBeenCalledWith(project, 'pdf'));
    fireEvent.click(await screen.findByTestId('comic-book-cbz'));
    await waitFor(() => expect(saveBook).toHaveBeenCalledWith(project, 'cbz'));
    fireEvent.click(await screen.findByTestId('comic-book-psd'));
    await waitFor(() => expect(saveBook).toHaveBeenCalledWith(project, 'psd'));
  });
});

describe('bookFileName', () => {
  it('replaces characters a file name cannot hold and adds the extension', () => {
    expect(bookFileName('a/b:c*?', 'pdf')).toBe('a_b_c_.pdf');
  });
  it('falls back to a default for an empty or dots-only name', () => {
    expect(bookFileName('', 'cbz')).toBe('comic.cbz');
    expect(bookFileName(' ... ', 'pdf')).toBe('comic.pdf');
  });
  it('names the ZIP of PSD pages, and the PSD of one page by the comic and the page number', () => {
    expect(bookFileName('Story', 'psd')).toBe('Story-psd.zip');
    const project = newProject('a/b');
    const second = { ...project.pages[0]!, id: 'second' };
    expect(pagePsdFileName({ ...project, pages: [project.pages[0]!, second] }, second)).toBe('a_b-2.psd');
  });
});
