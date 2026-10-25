// Right-click menu of an entity row: duplicate, arrange, flip, turn, scale, invert, random pose, convert, copy, save, export, delete.
// A slot row offers only the arrange items: the host draws the layer, so there is nothing else to do with it here.
import { ArrowDown, ArrowLineDown, ArrowLineUp, ArrowUp, ArrowsLeftRight, Copy, CopySimple, FlipHorizontal, FlipVertical, FloppyDisk, Export, Circle, MagnifyingGlassMinus, MagnifyingGlassPlus, Shuffle, Trash, ArrowClockwise, ArrowCounterClockwise } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { isSlot, type CanvasEntity, type EntityType, type FlipAxis } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextSubMenu } from '@/ui';
import { copyEntityToClipboard, exportEntityToFile, invertMask, randomizePoses, saveEntityToGallery, transformEntity } from '../actions';
import { objectsBounds } from '@/ui/canvasDraw/bounds';
import { ADD_LABEL } from '../names';

const CONVERT_TO: Record<EntityType, EntityType[]> = {
  raster: ['control', 'inpaint', 'regional'],
  control: ['raster', 'inpaint', 'regional'],
  inpaint: ['regional', 'raster'],
  regional: ['inpaint', 'raster'],
};

export function EntityContextMenu({ entity }: { entity: CanvasEntity }) {
  const store = useCanvasStoreApi();
  const s = store.getState;
  const isTop = useCanvasStore((st) => st.entities.filter((e) => e.type === entity.type).at(-1)?.id === entity.id);
  const isBottom = useCanvasStore((st) => st.entities.find((e) => e.type === entity.type)?.id === entity.id);
  const bounds = objectsBounds(entity.objects);
  // Masks keep their shape; only raster and control layers are redrawn as a turned or scaled picture.
  const canTransform = !!bounds && (entity.type === 'raster' || entity.type === 'control') && !entity.isLocked;
  const flip = (axis: FlipAxis) => {
    if (!bounds) return;
    const center = axis === 'horizontal' ? bounds.x + bounds.width / 2 : bounds.y + bounds.height / 2;
    s().flipEntity(entity.id, axis, center);
  };
  const arrange = (
    <ContextSubMenu icon={<ArrowsLeftRight />} label={t('canvas.entityMenu.arrange')}>
      <ContextMenuItem icon={<ArrowLineUp />} disabled={isTop} onSelect={() => s().arrangeEntity(entity.id, 'top')}>
        {t('canvas.entityMenu.moveToTop')}
      </ContextMenuItem>
      <ContextMenuItem icon={<ArrowUp />} disabled={isTop} onSelect={() => s().arrangeEntity(entity.id, 'up')}>
        {t('canvas.entityMenu.moveUp')}
      </ContextMenuItem>
      <ContextMenuItem icon={<ArrowDown />} disabled={isBottom} onSelect={() => s().arrangeEntity(entity.id, 'down')}>
        {t('canvas.entityMenu.moveDown')}
      </ContextMenuItem>
      <ContextMenuItem icon={<ArrowLineDown />} disabled={isBottom} onSelect={() => s().arrangeEntity(entity.id, 'bottom')}>
        {t('canvas.entityMenu.moveToBottom')}
      </ContextMenuItem>
    </ContextSubMenu>
  );
  if (isSlot(entity)) return <ContextMenuContent>{arrange}</ContextMenuContent>;
  return (
    <ContextMenuContent>
      <ContextMenuItem icon={<CopySimple />} onSelect={() => s().duplicateEntity(entity.id)}>
        {t('canvas.entityMenu.duplicate')}
      </ContextMenuItem>
      {arrange}
      <ContextMenuItem icon={<FlipHorizontal />} disabled={!bounds} onSelect={() => flip('horizontal')}>
        {t('canvas.entityMenu.flipHorizontal')}
      </ContextMenuItem>
      <ContextMenuItem icon={<FlipVertical />} disabled={!bounds} onSelect={() => flip('vertical')}>
        {t('canvas.entityMenu.flipVertical')}
      </ContextMenuItem>
      <ContextMenuItem icon={<ArrowClockwise />} disabled={!canTransform} onSelect={() => void transformEntity(entity.id, 'rotateRight', store)}>
        {t('canvas.entityMenu.rotateRight')}
      </ContextMenuItem>
      <ContextMenuItem icon={<ArrowCounterClockwise />} disabled={!canTransform} onSelect={() => void transformEntity(entity.id, 'rotateLeft', store)}>
        {t('canvas.entityMenu.rotateLeft')}
      </ContextMenuItem>
      <ContextMenuItem icon={<MagnifyingGlassPlus />} disabled={!canTransform} onSelect={() => void transformEntity(entity.id, 'scaleUp', store)}>
        {t('canvas.entityMenu.scaleUp')}
      </ContextMenuItem>
      <ContextMenuItem icon={<MagnifyingGlassMinus />} disabled={!canTransform} onSelect={() => void transformEntity(entity.id, 'scaleDown', store)}>
        {t('canvas.entityMenu.scaleDown')}
      </ContextMenuItem>
      {(entity.type === 'inpaint' || entity.type === 'regional') && (
        <ContextMenuItem icon={<Circle />} disabled={entity.isLocked} onSelect={() => void invertMask(entity.id, store)}>
          {t('canvas.entityMenu.invertMask')}
        </ContextMenuItem>
      )}
      {entity.type === 'control' && (
        <ContextMenuItem icon={<Shuffle />} disabled={entity.isLocked} onSelect={() => randomizePoses(entity.id, undefined, store)}>
          {t('canvas.pose.random')}
        </ContextMenuItem>
      )}
      <ContextSubMenu icon={<ArrowsLeftRight />} label={t('canvas.entityMenu.convertTo')}>
        {CONVERT_TO[entity.type].map((to) => (
          <ContextMenuItem key={to} onSelect={() => s().convertEntity(entity.id, to)}>
            {t(ADD_LABEL[to])}
          </ContextMenuItem>
        ))}
      </ContextSubMenu>
      <ContextMenuSeparator />
      <ContextMenuItem icon={<Copy />} onSelect={() => void copyEntityToClipboard(entity.id, store)}>
        {t('canvas.entityMenu.copyToClipboard')}
      </ContextMenuItem>
      <ContextMenuItem icon={<FloppyDisk />} onSelect={() => void saveEntityToGallery(entity.id, store)}>
        {t('canvas.entityMenu.saveToGallery')}
      </ContextMenuItem>
      <ContextMenuItem icon={<Export />} onSelect={() => void exportEntityToFile(entity.id, store)}>
        {t('canvas.entityMenu.exportToFile')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem icon={<Trash />} danger shortcut="Del" onSelect={() => s().removeEntity(entity.id)}>
        {t('common.delete')}
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
