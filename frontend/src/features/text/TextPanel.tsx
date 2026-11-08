// Left panel of the Text tab, in the order of the Generate screen: the template card, then the AI finish (run button first), then
// the folded sections of the selected layer and of the background. Adding layers is in the canvas toolbar, the layer stack in
// the right column, the candidates under the canvas.
import { t } from '@/i18n';
import { findImage, useGallery } from '@/state/gallery';
import { useTextEditor } from '@/state/text/textEditor';
import { Button, ColorInput, NumberInput, Section, Select } from '@/ui';
import { LayerProperties } from './LayerProperties';
import { RichSection } from './RichSection';
import { TextPresetBar } from './TextPresetBar';
import { TextScenePresetBar } from './TextScenePresetBar';
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
      <header className="pp-head tx-add">
        <TextScenePresetBar />
      </header>
      <div className="tx-panel__body">
        <RichSection layer={selected?.type === 'text' ? selected : null} />
        {selected && (
          <Section title={t(selected.type === 'text' ? 'text.layer.text' : 'text.layer.bubble')}>
            {selected.type === 'text' && <TextPresetBar />}
            <LayerProperties key={selected.id} layer={selected} />
          </Section>
        )}
        <Section title={t('text.bg.title')}>
          <BackgroundSection />
        </Section>
      </div>
    </div>
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
    <div className="tx-props" data-testid="text-background">
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
        <ColorInput className="tx-color__swatch" value={bg.color} aria-label={t('text.color')} onChange={(color) => setBackground({ kind: 'color', color })} />
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
    </div>
  );
}
