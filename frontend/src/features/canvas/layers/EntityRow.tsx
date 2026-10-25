// One entity in the layers list: thumbnail, editable name, visibility/lock/delete, settings when selected. A slot row
// shows the host's label and cannot be renamed, deleted or dragged out to another target.
import { useState } from 'react';
import { Eye, EyeSlash, Lock, LockOpen, Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { isSlot, type CanvasEntity } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { setDeferredDrag } from '@/state/dnd';
import { ContextMenu, ContextMenuTrigger, cx, IconButton } from '@/ui';
import { CANVAS_LAYER_DRAG } from '../dragSources';
import { EntityContextMenu } from './EntityContextMenu';
import { EntityThumbnail } from './EntityThumbnail';
import { rowLabel, useLayersHost } from './layersHost';
import { EntitySettings } from './settings/EntitySettings';

// The layer being dragged inside the list, so a row can tell a reorder from a drag to another target.
let draggedLayerId: string | null = null;

function NameField({ entity }: { entity: CanvasEntity }) {
  const [editing, setEditing] = useState(false);
  const update = useCanvasStore((s) => s.updateEntity);
  const name = rowLabel(useLayersHost(), entity);
  if (isSlot(entity)) return <span className="canvas-entity__name">{name}</span>;
  if (!editing) {
    return (
      <span className="canvas-entity__name" title={t('canvas.entity.renameHint')} onDoubleClick={() => setEditing(true)}>
        {name}
      </span>
    );
  }
  const commit = (value: string) => {
    setEditing(false);
    const v = value.trim();
    if (v !== name) update(entity.id, { name: v || null });
  };
  return (
    <input
      className="ui-input canvas-entity__rename"
      defaultValue={name}
      aria-label={t('common.rename')}
      autoFocus
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commit(e.currentTarget.value);
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

export function EntityRow({ entity }: { entity: CanvasEntity }) {
  const selected = useCanvasStore((s) => s.selectedEntityId === entity.id);
  const select = useCanvasStore((s) => s.select);
  const update = useCanvasStore((s) => s.updateEntity);
  const remove = useCanvasStore((s) => s.removeEntity);
  const moveTo = useCanvasStore((s) => s.moveEntityTo);
  const store = useCanvasStoreApi();
  const [over, setOver] = useState(false);
  const slot = isSlot(entity);
  const canReorder = (): boolean => !!draggedLayerId && draggedLayerId !== entity.id && store.getState().entities.find((x) => x.id === draggedLayerId)?.type === entity.type;
  return (
    <div className={cx('canvas-entity', selected && 'is-selected', !entity.isEnabled && 'is-disabled', over && 'is-drop-target')} data-testid="canvas-entity">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="canvas-entity__row"
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            draggable
            onDragStart={(e) => {
              draggedLayerId = entity.id;
              if ((entity.type === 'raster' && !slot) || entity.type === 'control') setDeferredDrag(e, CANVAS_LAYER_DRAG, entity.id);
              else e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              draggedLayerId = null;
              setOver(false);
            }}
            onDragOver={(e) => {
              if (!canReorder()) return;
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              setOver(false);
              if (!canReorder() || !draggedLayerId) return;
              e.preventDefault();
              moveTo(draggedLayerId, entity.id);
              draggedLayerId = null;
            }}
            onClick={() => select(entity.id)}
            onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && select(entity.id)}
          >
            <EntityThumbnail entity={entity} />
            <NameField entity={entity} />
            <span className="canvas-entity__actions">
              <IconButton
                label={entity.isLocked ? t('canvas.entity.unlock') : t('canvas.entity.lock')}
                icon={entity.isLocked ? <Lock /> : <LockOpen />}
                size="xs"
                isActive={entity.isLocked}
                className={cx(!entity.isLocked && 'canvas-entity__hover')}
                onClick={(e) => {
                  e.stopPropagation();
                  update(entity.id, { isLocked: !entity.isLocked });
                }}
              />
              <IconButton
                label={entity.isEnabled ? t('canvas.entity.hide') : t('canvas.entity.show')}
                icon={entity.isEnabled ? <Eye /> : <EyeSlash />}
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  update(entity.id, { isEnabled: !entity.isEnabled });
                }}
              />
              {!slot && (
                <IconButton
                  label={t('common.delete')}
                  icon={<Trash />}
                  size="xs"
                  className="canvas-entity__hover"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(entity.id);
                  }}
                />
              )}
            </span>
          </div>
        </ContextMenuTrigger>
        <EntityContextMenu entity={entity} />
      </ContextMenu>
      {selected && <EntitySettings entity={entity} />}
    </div>
  );
}
