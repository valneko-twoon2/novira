// The background controls in the canvas toolbar of the Text tab, beside the zoom where the canvas size is shown: the image / colour /
// transparent switch, the colour, and the canvas size (a list of common sizes and the width and height). A picture background
// takes the picture's size, so then only the size is shown, with the picture's name in the info mark.
import { t } from '@/i18n';
import { findImage, useGallery } from '@/state/gallery';
import { useTextEditor } from '@/state/text/textEditor';
import { ColorInput, InfoMark, NumberInput, Select } from '@/ui';

const SIZES = [
  { value: '1024x1024', width: 1024, height: 1024 },
  { value: '1024x1536', width: 1024, height: 1536 },
  { value: '1536x1024', width: 1536, height: 1024 },
  { value: '1920x1080', width: 1920, height: 1080 },
  { value: '2048x2048', width: 2048, height: 2048 },
];

export function TextBackgroundBar() {
  const scene = useTextEditor((s) => s.scene);
  const setBackground = useTextEditor((s) => s.setBackground);
  const resize = useTextEditor((s) => s.resize);
  const viewerName = useGallery((s) => s.viewerImageName);
  const viewer = viewerName ? findImage(viewerName) : undefined;
  const bg = scene.background;
  const kind = bg.kind === 'image' ? 'image' : bg.color ? 'color' : 'transparent';
  const size = SIZES.find((s) => s.width === scene.width && s.height === scene.height)?.value ?? null;
  return (
    <div className="tx-bgbar" data-testid="text-background">
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
      {kind === 'color' && bg.kind === 'color' && bg.color && (
        <ColorInput className="tx-color__swatch" value={bg.color} aria-label={t('text.color')} onChange={(color) => setBackground({ kind: 'color', color })} />
      )}
      {kind === 'image' ? (
        <>
          <span className="tx-toolbar__size">
            {scene.width} × {scene.height}
          </span>
          <InfoMark info={t('text.bg.imageNote', { name: bg.kind === 'image' ? bg.imageName : '' })} />
        </>
      ) : (
        <>
          <Select
            className="tx-bgbar__size"
            value={size}
            placeholder={t('text.bg.custom')}
            onChange={(v) => {
              const s = SIZES.find((x) => x.value === v);
              if (s) resize(s.width, s.height);
            }}
            options={SIZES.map((s) => ({ value: s.value, label: `${s.width}×${s.height}` }))}
            aria-label={t('text.bg.size')}
          />
          <NumberInput className="tx-bgbar__num" value={scene.width} min={64} max={4096} onChange={(w) => resize(w, scene.height)} aria-label={t('text.bg.width')} />
          <span className="tx-bgbar__times" aria-hidden="true">×</span>
          <NumberInput className="tx-bgbar__num" value={scene.height} min={64} max={4096} onChange={(h) => resize(scene.width, h)} aria-label={t('text.bg.height')} />
        </>
      )}
    </div>
  );
}
