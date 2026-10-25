// Logo screen of the Generate tab: the words and style (left), finished logos (center). Logos are kept with the
// gallery's assets, and one can be taken to the Text tab as the background to lay lettering over.
import { Shapes, TextAa, Trash } from '@phosphor-icons/react';
import { useEffect, useMemo } from 'react';
import { backend, randomSeed, type ImageDTO } from '@/backend';
import { MediaJobs, useMediaJobs } from '@/features/media/MediaJobs';
import { MediaPanel } from '@/features/media/MediaPanel';
import { SeedControl } from '@/features/media/SeedControl';
import { t } from '@/i18n';
import { setDragImages } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { LOGO_LIMITS, LOGO_SIZES, useLogo } from '@/state/media/logo';
import { useTextEditor } from '@/state/text/textEditor';
import { isScreenShown, useUi } from '@/state/ui';
import { Button, cx, IconButton, SliderNumber, Textarea, TextInput } from '@/ui';
import { logosOf } from './buildRequest';
import { LogoPresetBar } from './LogoPresetBar';
import { SIZE_LABELS } from './sizeLabels';
import './logo.css';

/** Left panel while the Generate tab is on Logo. */
export function LogoPanel() {
  // The logos go to the assets, so the gallery on the right shows them there.
  useEffect(() => useGallery.getState().setView('assets'), []);
  return (
    <MediaPanel kind="logo" presets={<LogoPresetBar />} seed={<LogoSeed />}>
      <LogoForm />
    </MediaPanel>
  );
}

function LogoSeed() {
  const seed = useLogo((s) => s.form.seed);
  const random = useLogo((s) => s.form.randomizeSeed);
  const setForm = useLogo((s) => s.setForm);
  return <SeedControl seed={seed} random={random} onSeed={(v) => setForm({ seed: v })} onRandom={(v) => setForm({ randomizeSeed: v })} onShuffle={() => setForm({ seed: randomSeed() })} />;
}

function LogoForm() {
  const form = useLogo((s) => s.form);
  const setForm = useLogo((s) => s.setForm);
  return (
    <section className="mf-card">
      <label className="mf-field">
        <span>{t('logo.text')}</span>
        <TextInput
          value={form.text}
          maxLength={LOGO_LIMITS.text}
          placeholder={t('logo.textPlaceholder')}
          onChange={(e) => setForm({ text: e.target.value })}
          data-testid="logo-text"
        />
      </label>
      <label className="mf-field">
        <span>{t('logo.style')}</span>
        <Textarea rows={3} value={form.style} placeholder={t('logo.stylePlaceholder')} onChange={(e) => setForm({ style: e.target.value })} data-testid="logo-style" />
      </label>
      <div className="mf-field">
        <span>{t('logo.size')}</span>
        <div className="mf-seg" role="tablist" aria-label={t('logo.size')}>
          {LOGO_SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={form.size === s.value}
              className={cx(form.size === s.value && 'is-on')}
              data-testid={`logo-size-${s.value}`}
              onClick={() => setForm({ size: s.value })}
            >
              {t(SIZE_LABELS[s.value])}
            </button>
          ))}
        </div>
      </div>
      <div className="mf-field">
        <span>{t('logo.count', { count: form.count })}</span>
        <SliderNumber
          value={form.count}
          onChange={(v) => setForm({ count: v })}
          min={LOGO_LIMITS.count.min}
          max={LOGO_LIMITS.count.max}
          aria-label={t('logo.countLabel')}
        />
      </div>
      <p className="mf-note">{t('logo.note')}</p>
    </section>
  );
}

/** Center area while the Generate tab is on Logo: running jobs, then the finished logos. */
export function LogoResults() {
  const images = useGallery((s) => s.images);
  const { active } = useMediaJobs('logo');
  const logos = useMemo(() => logosOf(images), [images]);
  return (
    <div className="mf-results" data-testid="logo-results">
      <MediaJobs kind="logo" />
      {logos.length === 0 && active.length === 0 ? (
        <div className="mf-empty">
          <Shapes size={32} />
          <strong>{t('logo.empty.title')}</strong>
          <p>{t('logo.empty.description')}</p>
        </div>
      ) : (
        <div className="lg-list">
          {logos.map((logo) => (
            <LogoCard key={logo.name} logo={logo} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Opens the Text tab with the logo as its background. */
function layText(logo: ImageDTO) {
  useTextEditor.getState().setBackground({ kind: 'image', imageName: logo.name }, { width: logo.width, height: logo.height });
  useUi.getState().setMedia('text');
}

function LogoCard({ logo }: { logo: ImageDTO }) {
  return (
    <article className="lg-card" data-testid="logo-card">
      <img src={logo.url} alt={logo.metadata?.positivePrompt ?? ''} draggable onDragStart={(e) => setDragImages(e, [logo.name])} />
      <div className="lg-card__meta">
        <span className="lg-card__info">
          {logo.width}×{logo.height}
          {logo.metadata ? ` · seed ${logo.metadata.seed}` : ''}
        </span>
        {isScreenShown('text') && (
          <Button size="xs" variant="outline" leftIcon={<TextAa />} onClick={() => layText(logo)} data-testid="logo-lay-text">
            {t('logo.layText')}
          </Button>
        )}
        <IconButton
          size="xs"
          label={t('logo.delete')}
          icon={<Trash />}
          onClick={() => {
            void backend.deleteImages([logo.name]).then(() => useGallery.getState().removeImages([logo.name]));
          }}
        />
      </div>
    </article>
  );
}
