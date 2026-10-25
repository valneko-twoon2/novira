// Properties of the selected layer: text, position, style, and for a bubble its shape and pointer.
import { ArrowsClockwise } from '@phosphor-icons/react';
import { t, type MessageKey } from '@/i18n';
import { useTextEditor } from '@/state/text/textEditor';
import { BUBBLE_SHAPES, type BubbleLayer, type BubbleShape, type Layer } from '@/state/text/textModel';
import { Button, Checkbox, Field, NumberInput, Select, SliderNumber, Textarea } from '@/ui';
import { ColorField } from './ColorField';
import { StyleControls } from './StyleControls';

export const SHAPE_LABELS: Record<BubbleShape, MessageKey> = {
  round: 'text.shape.round',
  box: 'text.shape.box',
  cloud: 'text.shape.cloud',
  burst: 'text.shape.burst',
  whisper: 'text.shape.whisper',
  narration: 'text.shape.narration',
};

export function LayerProperties({ layer }: { layer: Layer }) {
  const { update } = useTextEditor.getState();
  const set = (patch: Parameters<typeof update>[1], key: string) => update(layer.id, patch, { key: `${layer.id}:${key}` });
  return (
    <div className="tx-props" data-testid="text-props">
      <Textarea
        className="tx-text"
        value={layer.text}
        rows={3}
        placeholder={t('text.content.placeholder')}
        aria-label={t('text.content')}
        onChange={(e) => set({ text: e.target.value }, 'text')}
        data-testid="text-content"
      />
      {layer.type === 'bubble' && <BubbleControls layer={layer} />}
      <Field label={t('text.position')}>
        <div className="tx-inline">
          <NumberInput value={Math.round(layer.x)} onChange={(x) => set({ x }, 'x')} aria-label={t('text.position.x')} />
          <NumberInput value={Math.round(layer.y)} onChange={(y) => set({ y }, 'y')} aria-label={t('text.position.y')} />
        </div>
      </Field>
      <Field label={t('text.rotation')}>
        <SliderNumber value={layer.rotation} min={-180} max={180} onChange={(rotation) => set({ rotation }, 'rotation')} aria-label={t('text.rotation')} />
      </Field>
      <Field label={t('text.opacity')}>
        <SliderNumber value={Math.round(layer.opacity * 100)} min={0} max={100} onChange={(v) => set({ opacity: v / 100 }, 'opacity')} aria-label={t('text.opacity')} />
      </Field>
      <StyleControls layerId={layer.id} style={layer.style} bend={layer.type === 'text' ? layer.bend : undefined} />
    </div>
  );
}

function BubbleControls({ layer }: { layer: BubbleLayer }) {
  const { update } = useTextEditor.getState();
  const set = (patch: Parameters<typeof update>[1], key: string) => update(layer.id, patch, { key: `${layer.id}:${key}` });
  return (
    <div className="tx-controls" data-testid="bubble-controls">
      <Field label={t('text.bubble.shape')}>
        <Select
          value={layer.shape}
          onChange={(shape) => set({ shape, tail: { ...layer.tail, enabled: shape === 'narration' ? false : layer.tail.enabled } }, 'shape')}
          options={BUBBLE_SHAPES.map((s) => ({ value: s, label: t(SHAPE_LABELS[s]) }))}
          aria-label={t('text.bubble.shape')}
        />
      </Field>
      <Field label={t('text.bubble.size')}>
        <div className="tx-inline">
          <NumberInput value={layer.width} min={40} max={4000} onChange={(width) => set({ width }, 'width')} aria-label={t('text.bubble.width')} />
          <NumberInput value={layer.height} min={40} max={4000} onChange={(height) => set({ height }, 'height')} aria-label={t('text.bubble.height')} />
        </div>
      </Field>
      <Field label={t('text.bubble.fill')}>
        <ColorField value={layer.fill} label={t('text.bubble.fill')} onChange={(fill) => set({ fill }, 'fill')} />
      </Field>
      <Field label={t('text.bubble.border')}>
        <div className="tx-inline">
          <ColorField value={layer.border.color} label={t('text.bubble.border')} onChange={(color) => set({ border: { ...layer.border, color } }, 'border-color')} />
          <NumberInput value={layer.border.width} min={0} max={80} onChange={(width) => set({ border: { ...layer.border, width } }, 'border-width')} aria-label={t('text.thickness')} />
        </div>
      </Field>
      {layer.shape !== 'narration' && (
        <div className="tx-group">
          <Checkbox checked={layer.tail.enabled} label={t('text.bubble.tail')} onChange={(enabled) => set({ tail: { ...layer.tail, enabled } }, 'tail')} />
          {layer.tail.enabled && (
            <div className="tx-sub">
              <Field label={t('text.bubble.tail.curve')}>
                <SliderNumber value={Math.round(layer.tail.curve * 100)} min={-100} max={100} onChange={(v) => set({ tail: { ...layer.tail, curve: v / 100 } }, 'tail-curve')} aria-label={t('text.bubble.tail.curve')} />
              </Field>
              <Field label={t('text.bubble.tail.width')}>
                <SliderNumber value={layer.tail.width} min={4} max={400} onChange={(width) => set({ tail: { ...layer.tail, width } }, 'tail-width')} numberMax={2000} aria-label={t('text.bubble.tail.width')} />
              </Field>
              <p className="tx-note">{t('text.bubble.tail.hint')}</p>
            </div>
          )}
        </div>
      )}
      {layer.shape === 'burst' && (
        <Button size="sm" leftIcon={<ArrowsClockwise />} onClick={() => set({ seed: Math.floor(Math.random() * 100000) }, 'seed')}>
          {t('text.bubble.shuffle')}
        </Button>
      )}
      <Checkbox checked={layer.autoFit} label={t('text.bubble.autoFit')} onChange={(autoFit) => set({ autoFit }, 'autofit')} />
    </div>
  );
}
