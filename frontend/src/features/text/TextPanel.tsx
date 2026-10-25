// Left panel of the Text tab: text-style presets, add layers, choose the background, manage the layer stack, edit the selected layer.
import { ArrowDown, ArrowUp, ChatCircle, Copy, Eye, EyeSlash, Lock, LockOpen, TextT, Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { findImage, useGallery } from '@/state/gallery';
import { useTextEditor } from '@/state/text/textEditor';
import { BUBBLE_SHAPES, type Layer } from '@/state/text/textModel';
import { Button, cx, IconButton, NumberInput, Select } from '@/ui';
import { SHAPE_LABELS, LayerProperties } from './LayerProperties';
import { TextPresetBar } from './TextPresetBar';
import './text.css';

const SIZES = [
  { value: '1024x1024', width: 1024, height: 1024 },
  { value: '1024x1536', width: 1024, height: 1536 },
  { value: '1536x1024', width: 1536, height: 1024 },
  { value: '1920x1080', width: 1920, height: 1080 },
  { value: '2048x2048', width: 2048, height: 2048 },
];

export function TextPanel() {
  const scene = useTextEditor((s) => s.scene);
  const selectedId = useTextEditor((s) => s.selectedId);
  const selected = scene.layers.find((l) => l.id === selectedId) ?? null;
  return (
    <div className="tx-panel" data-testid="text-panel">
      <AddRow />
      <div className="tx-panel__body">
        <BackgroundSection />
        <LayerList layers={scene.layers} selectedId={selectedId} />
        {selected && (
          <section className="tx-section">
            <h3 className="tx-section__title">{t(selected.type === 'text' ? 'text.layer.text' : 'text.layer.bubble')}</h3>
            <LayerProperties key={selected.id} layer={selected} />
          </section>
        )}
      </div>
    </div>
  );
}

function AddRow() {
  const addText = useTextEditor((s) => s.addText);
  const addBubble = useTextEditor((s) => s.addBubble);
  return (
    <header className="pp-head tx-add">
      <TextPresetBar />
      <div className="pp-head__generate">
        <Button variant="solid" scheme="invoke" size="lg" leftIcon={<TextT weight="bold" />} onClick={() => addText(t('text.defaultText'))} data-testid="text-add-text">
          {t('text.add.text')}
        </Button>
      </div>
      <div className="tx-add__bubbles" role="group" aria-label={t('text.add.bubble')}>
        <span className="tx-label">
          <ChatCircle size={14} /> {t('text.add.bubble')}
        </span>
        <div className="tx-add__row">
          {BUBBLE_SHAPES.map((shape) => (
            <button key={shape} type="button" className="tx-chip" onClick={() => addBubble(shape, t('text.defaultBubble'))} data-testid={`text-add-${shape}`}>
              {t(SHAPE_LABELS[shape])}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function BackgroundSection() {
  const scene = useTextEditor((s) => s.scene);
  const setBackground = useTextEditor((s) => s.setBackground);
  const resize = useTextEditor((s) => s.resize);
  const viewerName = useGallery((s) => s.viewerImageName);
  const viewer = viewerName ? findImage(viewerName) : undefined;
  const bg = scene.background;
  const kind = bg.kind === 'image' ? 'image' : bg.color ? 'color' : 'transparent';
  const size = SIZES.find((s) => s.width === scene.width && s.height === scene.height)?.value ?? null;
  return (
    <section className="tx-section" data-testid="text-background">
      <h3 className="tx-section__title">{t('text.bg.title')}</h3>
      <div className="tx-seg" role="group" aria-label={t('text.bg.title')}>
        <button type="button" aria-pressed={kind === 'image'} className={kind === 'image' ? 'is-on' : ''} disabled={!viewer && kind !== 'image'} onClick={() => viewer && setBackground({ kind: 'image', imageName: viewer.name }, { width: viewer.width, height: viewer.height })}>
          {t('text.bg.image')}
        </button>
        <button type="button" aria-pressed={kind === 'color'} className={kind === 'color' ? 'is-on' : ''} onClick={() => setBackground({ kind: 'color', color: '#ffffff' })}>
          {t('text.bg.color')}
        </button>
        <button type="button" aria-pressed={kind === 'transparent'} className={kind === 'transparent' ? 'is-on' : ''} onClick={() => setBackground({ kind: 'color', color: null })}>
          {t('text.bg.transparent')}
        </button>
      </div>
      {kind === 'image' && (
        <p className="tx-note">{t('text.bg.imageNote', { name: bg.kind === 'image' ? bg.imageName : '' })}</p>
      )}
      {kind !== 'image' && viewer && (
        <Button size="sm" onClick={() => setBackground({ kind: 'image', imageName: viewer.name }, { width: viewer.width, height: viewer.height })} data-testid="text-use-viewer">
          {t('text.bg.useViewer')}
        </Button>
      )}
      {kind === 'color' && bg.kind === 'color' && bg.color && (
        <input type="color" className="tx-color__swatch" value={bg.color} aria-label={t('text.color')} onChange={(e) => setBackground({ kind: 'color', color: e.target.value })} />
      )}
      {kind !== 'image' && (
        <div className="tx-inline">
          <Select
            value={size}
            placeholder={t('text.bg.custom')}
            onChange={(v) => {
              const s = SIZES.find((x) => x.value === v);
              if (s) resize(s.width, s.height);
            }}
            options={SIZES.map((s) => ({ value: s.value, label: `${s.width}×${s.height}` }))}
            aria-label={t('text.bg.size')}
          />
          <NumberInput value={scene.width} min={64} max={4096} onChange={(w) => resize(w, scene.height)} aria-label={t('text.bg.width')} />
          <NumberInput value={scene.height} min={64} max={4096} onChange={(h) => resize(scene.width, h)} aria-label={t('text.bg.height')} />
        </div>
      )}
    </section>
  );
}

function LayerList({ layers, selectedId }: { layers: Layer[]; selectedId: string | null }) {
  const { select, update, remove, duplicate, reorder, clear } = useTextEditor.getState();
  return (
    <section className="tx-section" data-testid="text-layers">
      <h3 className="tx-section__title">
        {t('text.layers.title')}
        {layers.length > 0 && (
          <button type="button" className="tx-link" onClick={() => clear()}>
            {t('text.layers.clear')}
          </button>
        )}
      </h3>
      {layers.length === 0 && <p className="tx-note">{t('text.layers.empty')}</p>}
      <ul className="tx-layers">
        {[...layers].reverse().map((l) => (
          <li key={l.id} className={cx('tx-layer', l.id === selectedId && 'is-selected', !l.visible && 'is-hidden')}>
            <button type="button" className="tx-layer__main" onClick={() => select(l.id)} data-testid={`text-layer-${l.id}`}>
              {l.type === 'text' ? <TextT size={14} /> : <ChatCircle size={14} />}
              <span className="tx-layer__name">{l.text.split('\n')[0] || t(l.type === 'text' ? 'text.layer.text' : 'text.layer.bubble')}</span>
            </button>
            <IconButton label={t(l.visible ? 'text.layer.hide' : 'text.layer.show')} icon={l.visible ? <Eye /> : <EyeSlash />} size="xs" onClick={() => update(l.id, { visible: !l.visible })} />
            <IconButton label={t(l.locked ? 'text.layer.unlock' : 'text.layer.lock')} icon={l.locked ? <Lock /> : <LockOpen />} size="xs" onClick={() => update(l.id, { locked: !l.locked })} />
            <IconButton label={t('text.layer.up')} icon={<ArrowUp />} size="xs" onClick={() => reorder(l.id, 'up')} />
            <IconButton label={t('text.layer.down')} icon={<ArrowDown />} size="xs" onClick={() => reorder(l.id, 'down')} />
            <IconButton label={t('text.layer.duplicate')} icon={<Copy />} size="xs" onClick={() => duplicate(l.id)} />
            <IconButton label={t('text.layer.delete')} icon={<Trash />} size="xs" onClick={() => remove(l.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
