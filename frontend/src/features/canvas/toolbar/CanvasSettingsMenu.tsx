// Canvas settings menu: display toggles, behaviour toggles, history and clear actions.
import { Broom, ClockCounterClockwise, GearSix, Stack, Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { type CanvasSettings } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { IconButton, TOOLBAR_BUTTON_SIZE, Menu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/ui';
import { mergeVisible } from '../actions';
import { fitBboxToLayers } from '../view';

const TOGGLES: { key: keyof CanvasSettings; label: () => string }[] = [
  { key: 'showGrid', label: () => t('canvas.settings.showGrid') },
  { key: 'snapToGrid', label: () => t('canvas.settings.snapToGrid') },
  { key: 'showHud', label: () => t('canvas.settings.showHud') },
  { key: 'dimOutsideBbox', label: () => t('canvas.settings.dimOutsideBbox') },
  { key: 'clipToBbox', label: () => t('canvas.settings.clipToBbox') },
  { key: 'preserveMask', label: () => t('canvas.settings.preserveMask') },
  { key: 'autoProcess', label: () => t('canvas.settings.autoProcess') },
];

export function CanvasSettingsMenu() {
  const settings = useCanvasStore((s) => s.settings);
  const setSettings = useCanvasStore((s) => s.setSettings);
  const hasHistory = useCanvasStore((s) => s.past.length + s.future.length > 0);
  const hasEntities = useCanvasStore((s) => s.entities.length > 0);
  const store = useCanvasStoreApi();
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('canvas.settings.title')} icon={<GearSix />} data-testid="canvas-settings" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>{t('canvas.settings.title')}</MenuLabel>
        {TOGGLES.map((x) => (
          <MenuCheckItem key={x.key} checked={settings[x.key]} onChange={(v) => setSettings({ [x.key]: v })}>
            {x.label()}
          </MenuCheckItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<Stack />} onSelect={() => void mergeVisible(store)}>
          {t('canvas.actions.mergeVisible')}
        </MenuItem>
        <MenuItem onSelect={() => fitBboxToLayers(store)} shortcut="Shift+C">
          {t('canvas.actions.fitBboxToLayers')}
        </MenuItem>
        <MenuItem icon={<ClockCounterClockwise />} disabled={!hasHistory} onSelect={() => store.getState().clearHistory()}>
          {t('canvas.actions.clearHistory')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Broom />} danger disabled={!hasEntities} onSelect={() => store.getState().clearCanvas()}>
          {t('canvas.actions.clearCanvas')}
        </MenuItem>
        <MenuItem icon={<Trash />} danger onSelect={() => store.getState().clearStaged()}>
          {t('canvas.actions.clearStaging')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
