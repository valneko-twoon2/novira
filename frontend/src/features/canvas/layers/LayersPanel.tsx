// Right-column layers panel: header with add / more menus, then entity groups in InvokeAI order. A host other than the
// Image tab narrows what the panel offers through `host` (see layersHost.ts).
import { DotsThreeVertical, ImageSquare, Image, PersonSimpleRun, Plus, Selection, Sliders, Stack, Trash, UsersThree } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { isSlot, type EntityType } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { usePoseDialog } from '@/state/dialogs/pose';
import { useParams } from '@/state/params';
import type { TabName } from '@/state/ui';
import { Button, EmptyState, IconButton, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/ui';
import { mergeVisible } from '../actions';
import { ADD_LABEL } from '../names';
import { EntityGroup } from './EntityGroup';
import { canAdd, LayersHostContext, useLayersHost, type LayersHost } from './layersHost';
import { RefImagesGroup } from './RefImagesGroup';
import '../canvas.css';

const ADD_ITEMS: { type: EntityType; icon: ReactNode }[] = [
  { type: 'raster', icon: <Image /> },
  { type: 'control', icon: <Sliders /> },
  { type: 'inpaint', icon: <Selection /> },
  { type: 'regional', icon: <UsersThree /> },
];

/** Top to bottom, as in InvokeAI. */
const GROUP_ORDER: EntityType[] = ['regional', 'inpaint', 'control', 'raster'];

function AddMenu() {
  const add = useCanvasStore((s) => s.addEntity);
  const select = useCanvasStore((s) => s.select);
  const host = useLayersHost();
  const entities = useCanvasStore((s) => s.entities);
  const items = ADD_ITEMS.filter((x) => canAdd(host, x.type));
  const blocked = (type: EntityType) => host.addBlocked?.(entities, type) ?? null;
  const reasons = [...new Set(items.map((x) => blocked(x.type)).filter((r): r is string => !!r))];
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="xs" leftIcon={<Plus />} data-testid="canvas-add-layer">
          {t('common.add')}
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        {!host.hideGlobalRefs && (
          <>
            <MenuItem icon={<ImageSquare />} onSelect={() => select(useParams.getState().addRefImage())}>
              {t('canvas.add.globalRef')}
            </MenuItem>
            <MenuSeparator />
          </>
        )}
        {reasons.map((reason) => (
          <MenuLabel key={reason}>{reason}</MenuLabel>
        ))}
        {[...items].reverse().map((x) => (
          <MenuItem key={x.type} icon={x.icon} disabled={!!blocked(x.type)} onSelect={() => add(x.type)}>
            {t(ADD_LABEL[x.type])}
          </MenuItem>
        ))}
        {canAdd(host, 'control') && (
          <>
            <MenuSeparator />
            <MenuItem icon={<PersonSimpleRun />} onSelect={() => usePoseDialog.getState().open()}>
              {t('pose.menu')}
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

function MoreMenu() {
  // Deleting everything leaves the host's slots, so it is off while only slots are there.
  const count = useCanvasStore((s) => s.entities.filter((e) => !isSlot(e)).length);
  const store = useCanvasStoreApi();
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={t('canvas.layers.more')} icon={<DotsThreeVertical />} size="xs" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem icon={<Stack />} onSelect={() => void mergeVisible(store)}>
          {t('canvas.actions.mergeVisible')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash />} danger disabled={!count} onSelect={() => store.getState().clearCanvas()}>
          {t('canvas.layers.deleteAll')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

const NO_HOST: LayersHost = {};

export function LayersPanel({ host = NO_HOST }: { tab?: TabName; host?: LayersHost }) {
  const count = useCanvasStore((s) => s.entities.length);
  const refCount = useParams((s) => (host.hideGlobalRefs ? 0 : s.refImages.length));
  const add = useCanvasStore((s) => s.addEntity);
  return (
    <LayersHostContext.Provider value={host}>
      <div className="panel canvas-layers" data-testid="canvas-layers">
        <div className="canvas-layers__header">
          <span className="canvas-layers__title">{t('canvas.layers.title')}</span>
          <span className="canvas-layers__spacer" />
          <AddMenu />
          <MoreMenu />
        </div>
        <div className="panel__scroll canvas-layers__scroll">
          {count + refCount === 0 ? (
            <EmptyState icon={<Stack size={28} />} title={t('canvas.layers.empty')} description={t('canvas.layers.emptyHint')}>
              <div className="canvas-layers__quick">
                {ADD_ITEMS.filter((x) => canAdd(host, x.type)).map((x) => (
                  <Button key={x.type} size="xs" variant="outline" leftIcon={x.icon} onClick={() => add(x.type)}>
                    {t(ADD_LABEL[x.type])}
                  </Button>
                ))}
              </div>
            </EmptyState>
          ) : (
            <>
              {!host.hideGlobalRefs && <RefImagesGroup />}
              {GROUP_ORDER.map((type) => (
                <EntityGroup key={type} type={type} />
              ))}
            </>
          )}
        </div>
      </div>
    </LayersHostContext.Provider>
  );
}