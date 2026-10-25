// The toolbar's "export all pages" menu: the whole comic as one PDF, one CBZ or a ZIP of layered PSD pages. Drawing many pages takes a moment, so the
// buttons wait until the file is made.
import { useState } from 'react';
import { Export } from '@phosphor-icons/react';
import { t } from '@/i18n';
import type { ComicProject } from '@/state/comic/document';
import { Button, IconButton, Popover, PopoverContent, PopoverTrigger, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { saveBook, type BookFormat } from './saveBook';

export function BookExport({ project }: { project: ComicProject }) {
  const [busy, setBusy] = useState(false);
  const run = async (format: BookFormat) => {
    setBusy(true);
    try {
      await saveBook(project, format);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.book.export')} icon={<Export />} tooltip={false} title={t('comic.book.export')} data-testid="comic-book-export" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="comic-settings">
        <div className="comic-settings__body">
          <h3 className="comic-settings__title">{t('comic.book.export')}</h3>
          <p className="comic-book__hint">{t('comic.book.hint')}</p>
          <div className="comic-book__buttons">
            <Button onClick={() => void run('pdf')} disabled={busy} data-testid="comic-book-pdf">
              {busy ? t('comic.book.working') : t('comic.book.pdf')}
            </Button>
            <Button onClick={() => void run('cbz')} disabled={busy} data-testid="comic-book-cbz">
              {busy ? t('comic.book.working') : t('comic.book.cbz')}
            </Button>
            <Button onClick={() => void run('psd')} disabled={busy} data-testid="comic-book-psd">
              {busy ? t('comic.book.working') : t('comic.book.psd')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
