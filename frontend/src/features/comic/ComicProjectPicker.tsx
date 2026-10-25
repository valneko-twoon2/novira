// The comic chooser at the top of the left panel, above the model card and laid out like it: the open comic's first page
// as a small picture, and a list that opens like the model list, each comic with its first page, how many pages it has,
// and a menu to rename or delete it. A new comic is made from the foot of the list.
import { useMemo, useState } from 'react';
import { CaretDown, Check, DotsThree, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { t, tCount } from '@/i18n';
import type { ComicProject } from '@/state/comic/document';
import { pageAspect, pageShapes } from '@/state/comic/layout';
import { activeProject, useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { Button, cx, IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, NameDialog, PressAgainMenuItem, SearchPicker } from '@/ui';
import { PageThumb } from './PageThumb';

/** The first page of a comic as a small picture, with the pictures of its panels. */
function FirstPage({ project, urls, className }: { project: ComicProject | null; urls: Map<string, string>; className: string }) {
  const page = project?.pages[0];
  if (!page) return <span className={cx(className, 'is-empty')} aria-hidden="true" />;
  return (
    <PageThumb
      className={className}
      shapes={pageShapes(page)}
      aspect={pageAspect(page.size)}
      pictures={page.panels.map((p) => (p.imageName ? urls.get(p.imageName) : undefined))}
      page={page}
      urlOf={(name) => urls.get(name)}
    />
  );
}

type Naming = { mode: 'new' } | { mode: 'rename'; project: ComicProject } | null;

export function ComicProjectPicker() {
  const projects = useComic((s) => s.projects);
  const current = useComic((s) => activeProject(s));
  const images = useGallery((s) => s.images);
  const urls = useMemo(() => new Map(images.map((i) => [i.name, i.url])), [images]);
  const [naming, setNaming] = useState<Naming>(null);
  // A run works on the open comic until it ends, so the list stays shut meanwhile.

  return (
    <section className="pp-model comic-picker" data-testid="comic-project-bar">
      <div className="pp-model__row">
        <FirstPage project={current} urls={urls} className="comic-picker__cover" />
        <div className="pp-model__main">
          <SearchPicker
            trigger={
              <button type="button" className="ui-select" aria-label={t('comic.project.label')} data-testid="comic-project-picker">
                <span className="ui-select__value">{current ? current.name || t('comic.project.newName') : <span className="ui-select__placeholder">{t('comic.project.choose')}</span>}</span>
                <CaretDown size={12} />
              </button>
            }
            items={projects}
            itemKey={(p) => p.id}
            textOf={(p) => p.name}
            searchLabel={t('comic.project.search')}
            emptyText={t('comic.project.empty')}
            noMatchText={t('comic.project.noMatch')}
            listTestId="comic-project-list"
            renderItem={(project, close) => (
              <div className={cx('ui-preset__row', project.id === current?.id && 'is-current')} data-testid="comic-project-item">
                <button
                  type="button"
                  className="pp-picker__item"
                  onClick={() => {
                    useComic.getState().selectProject(project.id);
                    close();
                  }}
                >
                  <FirstPage project={project} urls={urls} className="comic-picker__option" />
                  <span className="ui-preset__text">
                    <span className="pp-picker__name">{project.name || t('comic.project.newName')}</span>
                    <span className="ui-preset__summary">{tCount('comic.project.pageCount', project.pages.length)}</span>
                  </span>
                  {project.id === current?.id && <Check size={12} />}
                </button>
                <Menu>
                  <MenuTrigger asChild>
                    <IconButton size="xs" label={t('comic.project.actions', { name: project.name })} icon={<DotsThree weight="bold" />} tooltip={false} data-testid="comic-project-menu" />
                  </MenuTrigger>
                  <MenuContent align="end">
                    <MenuItem
                      icon={<PencilSimple />}
                      onSelect={() => {
                        close();
                        setNaming({ mode: 'rename', project });
                      }}
                    >
                      {t('common.rename')}
                    </MenuItem>
                    <MenuSeparator />
                    <PressAgainMenuItem
                      icon={<Trash />}
                      danger
                      label={t('comic.project.delete')}
                      againLabel={t('comic.project.deleteAgain')}
                      onConfirm={() => useComic.getState().deleteProject(project.id)}
                    />
                  </MenuContent>
                </Menu>
              </div>
            )}
            footer={(close) => (
              <Button
                size="xs"
                variant="outline"
                leftIcon={<Plus />}
                data-testid="comic-new"
                onClick={() => {
                  close();
                  setNaming({ mode: 'new' });
                }}
              >
                {t('comic.project.new')}
              </Button>
            )}
          />
          {current && <span className="comic-picker__meta">{tCount('comic.project.pageCount', current.pages.length)}</span>}
        </div>
      </div>
      {naming && (
        <NameDialog
          title={t('comic.project.nameTitle')}
          initial={naming.mode === 'rename' ? naming.project.name : t('comic.project.newName')}
          onSubmit={(name) => {
            if (naming.mode === 'rename') useComic.getState().renameProject(naming.project.id, name);
            else useComic.getState().createProject(name);
            setNaming(null);
          }}
          onClose={() => setNaming(null)}
        />
      )}
    </section>
  );
}

