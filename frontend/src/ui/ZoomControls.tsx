// Zoom out / percentage menu / zoom in / (actual size) / fit: the zoom group shared by the canvas toolbar and the viewer.
import { FrameCorners, MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { cx, IconButton, TOOLBAR_BUTTON_SIZE, Tooltip } from './controls';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './overlays';
import { chordLabel } from './useHotkey';
import { ZOOM_HOTKEYS } from './zoomHotkeys';
import { ZOOM_PRESETS } from './zoomMath';

const withKey = (label: string, chord: string) => `${label} (${chordLabel(chord)})`;

interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (scale: number) => void;
  onFit: () => void;
  /** Name of the fit action (e.g. "Reset view", "Fit to view"). */
  fitLabel: string;
  /** Show a 1:1 (100%) button next to the fit button. */
  onActualSize?: () => void;
  /** Extra items under the presets in the percentage menu. */
  menuItems?: ReactNode;
  className?: string;
  /** Test id of the percentage button. */
  testId?: string;
}

export function ZoomControls({ scale, onZoomIn, onZoomOut, onZoomTo, onFit, fitLabel, onActualSize, menuItems, className, testId }: Props) {
  return (
    <div className={cx('ui-zoom', className)} role="group" aria-label={t('common.zoom')}>
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('common.zoomOut')} tooltip={withKey(t('common.zoomOut'), ZOOM_HOTKEYS.zoomOut)} icon={<MagnifyingGlassMinus />} onClick={onZoomOut} />
      <Menu>
        <Tooltip content={t('common.zoom')}>
          <MenuTrigger asChild>
            <button type="button" className="ui-zoom__value" aria-label={`${t('common.zoom')}: ${Math.round(scale * 100)}%`} data-testid={testId}>
              {Math.round(scale * 100)}%
            </button>
          </MenuTrigger>
        </Tooltip>
        <MenuContent>
          {ZOOM_PRESETS.map((p) => (
            <MenuItem key={p} onSelect={() => onZoomTo(p)}>
              {Math.round(p * 100)}%
            </MenuItem>
          ))}
          {menuItems && <MenuSeparator />}
          {menuItems}
        </MenuContent>
      </Menu>
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('common.zoomIn')} tooltip={withKey(t('common.zoomIn'), ZOOM_HOTKEYS.zoomIn)} icon={<MagnifyingGlassPlus />} onClick={onZoomIn} />
      {onActualSize && (
        <Tooltip content={withKey(t('common.zoomActualSize'), ZOOM_HOTKEYS.actualSize)}>
          <button type="button" className="ui-zoom__value ui-zoom__actual" aria-label={t('common.zoomActualSize')} onClick={onActualSize}>
            1:1
          </button>
        </Tooltip>
      )}
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={withKey(fitLabel, ZOOM_HOTKEYS.fit)} icon={<FrameCorners />} onClick={onFit} />
    </div>
  );
}
