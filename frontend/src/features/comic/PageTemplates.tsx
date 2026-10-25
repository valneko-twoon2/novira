// The page templates, opened from the page's toolbar: every layout drawn as a small page, the built-in grids, the built-in
// shapes and the comic's saved ones. A press applies one to the page on screen; a layout with fewer panels than the page
// waits for a second press, since it drops the last panels with their pictures and balloons. The page's own layout can be
// saved as a template at the bottom.
import { useState } from 'react';
import { SquaresFour, X } from '@phosphor-icons/react';
import { t } from '@/i18n';
import type { ComicPage, ComicProject, PageSize, ReadingDirection } from '@/state/comic/document';
import { autoShapes, pageAspect, templateShapes } from '@/state/comic/layout';
import type { Shape } from '@/state/comic/shapes';
import { useComic } from '@/state/comic/store';
import { BUILTIN_PAGE_LAYOUTS, BUILTIN_SHAPE_LAYOUTS } from '@/state/comic/templates';
import { Button, cx, IconButton, Modal, TextInput, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { PageThumb } from './PageThumb';

/** A layout a template stands for, with the shapes its drawing shows. */
interface Choice {
  key: string;
  name: string;
  panelCount: number;
  columns: number;
  direction: ReadingDirection;
  size: PageSize;
  /** The shapes the layout gives the panels, or null for the automatic layout. */
  shapes: Shape[] | null;
  /** The shapes drawn on its card. */
  drawn: Shape[];
  aspect: number;
  /** The saved template's id, which can be deleted. */
  savedId?: string;
}

function choices(project: ComicProject, page: ComicPage): { group: string; items: Choice[] }[] {
  const aspect = pageAspect(page.size);
  const base = { direction: page.direction, size: page.size, aspect };
  const shapeChoice = (l: (typeof BUILTIN_SHAPE_LAYOUTS)[number]): Choice => {
    const shapes = templateShapes(l.shapes, aspect, page.direction);
    return { ...base, key: `shape:${l.id}`, name: t(`comic.template.builtin.${l.id}`), panelCount: shapes.length, columns: page.columns, shapes, drawn: shapes };
  };
  return [
    {
      group: t('comic.template.group.grid'),
      items: BUILTIN_PAGE_LAYOUTS.map((l) => ({
        ...base,
        key: `builtin:${l.id}`,
        name: t(`comic.template.builtin.${l.id}`),
        panelCount: l.panelCount,
        columns: l.columns,
        shapes: null,
        drawn: autoShapes(l.panelCount, l.columns, page.direction, aspect),
      })),
    },
    {
      group: t('comic.template.group.shape'),
      items: BUILTIN_SHAPE_LAYOUTS.map(shapeChoice),
    },
    {
      group: t('comic.template.group.saved'),
      items: project.pageTemplates.map((tpl) => {
        const savedAspect = pageAspect(tpl.size);
        return {
          key: `saved:${tpl.id}`,
          name: tpl.name,
          panelCount: tpl.panelCount,
          columns: tpl.columns,
          direction: tpl.direction,
          size: tpl.size,
          aspect: savedAspect,
          shapes: tpl.shapes,
          drawn: tpl.shapes ?? autoShapes(tpl.panelCount, tpl.columns, tpl.direction, savedAspect),
          savedId: tpl.id,
        };
      }),
    },
  ];
}

export function PageTemplates({ project, page }: { project: ComicProject; page: ComicPage }) {
  const [open, setOpen] = useState(false);
  // The template pressed once that drops panels: its next press applies it.
  const [armed, setArmed] = useState<string | null>(null);
  const [name, setName] = useState('');
  const close = (o: boolean) => {
    setOpen(o);
    setArmed(null);
  };
  const apply = (c: Choice) => {
    if ((c.shapes?.length ?? c.panelCount) < page.panels.length && armed !== c.key) {
      setArmed(c.key);
      return;
    }
    useComic.getState().applyPageLayout(page.id, { panelCount: c.panelCount, columns: c.columns, direction: c.direction, size: c.size, shapes: c.shapes });
    close(false);
  };
  const save = () => {
    useComic.getState().savePageTemplate(page.id, name.trim() || t('comic.template.defaultName', { number: project.pageTemplates.length + 1 }));
    setName('');
  };

  return (
    <>
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.template.pageTitle')} icon={<SquaresFour />} onClick={() => setOpen(true)} data-testid="comic-page-templates" />
      <Modal
        open={open}
        onOpenChange={close}
        title={t('comic.template.pageTitle')}
        size="lg"
        closeLabel={t('common.close')}
        footer={
          <div className="comic-templates__save">
            <TextInput value={name} placeholder={t('comic.template.namePlaceholder')} aria-label={t('comic.template.name')} onChange={(e) => setName(e.target.value)} />
            <Button size="sm" variant="outline" onClick={save} data-testid="comic-page-template-save">
              {t('comic.template.savePage')}
            </Button>
          </div>
        }
      >
        <p className="comic-hint">{armed ? t('comic.template.applyConfirm') : t('comic.template.pickHint')}</p>
        {choices(project, page).map(
          (g) =>
            g.items.length > 0 && (
              <section key={g.group} className="comic-templates__group">
                <h4 className="comic-templates__title">{g.group}</h4>
                <div className="comic-templates__grid">
                  {g.items.map((c) => (
                    <div key={c.key} className={cx('comic-templates__item', armed === c.key && 'is-armed')}>
                      <button type="button" className="comic-templates__card" onClick={() => apply(c)} onBlur={() => armed === c.key && setArmed(null)} data-testid="comic-page-template" data-template={c.key}>
                        <PageThumb shapes={c.drawn} aspect={c.aspect} />
                        <span className="comic-templates__name">{armed === c.key ? t('comic.template.applyAgain') : c.name}</span>
                      </button>
                      {c.savedId && (
                        <IconButton
                          className="comic-templates__delete"
                          size="xs"
                          label={t('comic.template.delete')}
                          icon={<X />}
                          onClick={() => useComic.getState().deletePageTemplate(c.savedId!)}
                          data-testid="comic-page-template-delete"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ),
        )}
      </Modal>
    </>
  );
}
