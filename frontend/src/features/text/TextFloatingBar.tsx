// The quick controls over the selected layer on the canvas: the font, the size and the colors of a text layer, the colors of
// a bubble, and duplicate and delete. Everything else is in the left column. It follows the layer and hides while the
// layer is being dragged.
import { Copy, Trash } from '@phosphor-icons/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { snapWeight } from '@/state/fonts';
import { useTextEditor } from '@/state/text/textEditor';
import type { Layer } from '@/state/text/textModel';
import { FontPicker, IconButton, NumberInput } from '@/ui';
import { placeBar } from './barPlace';
import { ColorField } from './ColorField';
import type { Half } from './hit';

export function TextFloatingBar({ layer, half, scale, sheet }: { layer: Layer; half: Half; scale: number; sheet: { width: number; height: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The bar's own size decides where it fits: measured when it appears and whenever its content changes the size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize((now) => (now.width === el.offsetWidth && now.height === el.offsetHeight ? now : { width: el.offsetWidth, height: el.offsetHeight }));
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const state = useTextEditor.getState;
  const { update, updateStyle, duplicate, remove } = state();
  const key = (name: string) => `${layer.id}:bar-${name}`;
  /** The layer as it is now: two quick edits may land before the next draw, so a change builds on the store, not on the props. */
  const current = () => state().scene.layers.find((l) => l.id === layer.id);
  const at = placeBar(layer, half, scale, sheet, size);
  return (
    <div ref={ref} className="tx-bar" style={{ left: at.left, top: at.top, visibility: size.width === 0 ? 'hidden' : 'visible' }} role="toolbar" aria-label={t('text.bar')} data-testid="text-bar">
      {layer.type === 'text' ? (
        <>
          <div className="tx-bar__font">
            <FontPicker
              value={layer.style.fontFamily}
              onChange={(family) => family && updateStyle(layer.id, { fontFamily: family, fontWeight: snapWeight(family, layer.style.fontWeight) }, { key: key('font') })}
              label={t('text.font')}
              testId="text-bar-font"
            />
          </div>
          <div className="tx-bar__size">
            <NumberInput value={layer.style.fontSize} min={8} max={2000} onChange={(fontSize) => updateStyle(layer.id, { fontSize }, { key: key('size') })} aria-label={t('text.size')} />
          </div>
          {layer.style.fill.kind === 'solid' ? (
            <ColorField value={layer.style.fill.color} label={t('text.color')} onChange={(color) => updateStyle(layer.id, { fill: { kind: 'solid', color } }, { key: key('fill') })} />
          ) : (
            <>
              <ColorField value={layer.style.fill.top} label={t('text.fill.top')} onChange={(top) => {
                  const fill = current()?.style.fill;
                  if (fill?.kind === 'gradient') updateStyle(layer.id, { fill: { ...fill, top } }, { key: key('fill-top') });
                }} />
              <ColorField value={layer.style.fill.bottom} label={t('text.fill.bottom')} onChange={(bottom) => {
                  const fill = current()?.style.fill;
                  if (fill?.kind === 'gradient') updateStyle(layer.id, { fill: { ...fill, bottom } }, { key: key('fill-bottom') });
                }} />
            </>
          )}
          {layer.style.stroke && (
            <ColorField value={layer.style.stroke.color} label={t('text.stroke')} onChange={(color) => {
                const stroke = current()?.style.stroke;
                if (stroke) updateStyle(layer.id, { stroke: { ...stroke, color } }, { key: key('stroke') });
              }} />
          )}
        </>
      ) : (
        <>
          <ColorField value={layer.fill} label={t('text.bubble.fill')} onChange={(fill) => update(layer.id, { fill }, { key: key('bubble-fill') })} />
          <ColorField value={layer.border.color} label={t('text.bubble.border')} onChange={(color) => {
              const now = current();
              if (now?.type === 'bubble') update(layer.id, { border: { ...now.border, color } }, { key: key('bubble-border') });
            }} />
        </>
      )}
      <IconButton label={t('text.layer.duplicate')} icon={<Copy />} size="xs" onClick={() => duplicate(layer.id)} />
      <IconButton label={t('text.layer.delete')} icon={<Trash />} size="xs" onClick={() => remove(layer.id)} />
    </div>
  );
}
