// Collapsible group of entities of one type, listed top-most first, with count and visibility toggle.
import { useState, type ReactNode } from 'react';
import { CaretDown, Eye, EyeSlash, Plus } from '@phosphor-icons/react';
import { useShallow } from 'zustand/react/shallow';
import { t } from '@/i18n';
import { type EntityType } from '@/state/canvas';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { cx, IconButton } from '@/ui';
import { ADD_LABEL, GROUP_TITLE } from '../names';
import { EntityRow } from './EntityRow';
import { canAdd, useLayersHost } from './layersHost';

export function GroupShell({
  title,
  count,
  actions,
  children,
  testId,
}: {
  title: string;
  count: number;
  actions?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className={cx('canvas-group', open && 'is-open')} data-testid={testId}>
      <div className="canvas-group__header">
        <button type="button" className="canvas-group__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <CaretDown size={12} className="canvas-group__caret" />
          <span className="canvas-group__title">{title}</span>
          <span className="canvas-group__count">{count}</span>
        </button>
        {actions}
      </div>
      {open && <div className="canvas-group__body">{children}</div>}
    </section>
  );
}

export function EntityGroup({ type }: { type: EntityType }) {
  const entities = useCanvasStore(useShallow((s) => s.entities.filter((e) => e.type === type)));
  const hidden = useCanvasStore((s) => s.groupHidden[type]);
  const setHidden = useCanvasStore((s) => s.setGroupHidden);
  const add = useCanvasStore((s) => s.addEntity);
  const addable = canAdd(useLayersHost(), type);
  if (!entities.length) return null;
  return (
    <GroupShell
      title={t(GROUP_TITLE[type])}
      count={entities.length}
      testId={`canvas-group-${type}`}
      actions={
        <>
          <IconButton
            label={hidden ? t('canvas.groups.show') : t('canvas.groups.hide')}
            icon={hidden ? <EyeSlash /> : <Eye />}
            size="xs"
            onClick={() => setHidden(type, !hidden)}
          />
          {addable && <IconButton label={t(ADD_LABEL[type])} icon={<Plus />} size="xs" onClick={() => add(type)} />}
        </>
      }
    >
      <div className={cx('canvas-group__list', hidden && 'is-hidden')}>
        {[...entities].reverse().map((e) => (
          <EntityRow key={e.id} entity={e} />
        ))}
      </div>
    </GroupShell>
  );
}
