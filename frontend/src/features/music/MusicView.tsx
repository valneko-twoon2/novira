// Music screen of the Generate tab: style tags, lyrics and the musical settings (left), finished songs (center).
import { randomSeed } from '@/backend';
import { MediaPanel } from '@/features/media/MediaPanel';
import { SeedControl } from '@/features/media/SeedControl';
import { t } from '@/i18n';
import { MUSIC_KEYS, MUSIC_LANGUAGES, MUSIC_LIMITS, TIME_SIGNATURES, useMusic } from '@/state/media/music';
import { Checkbox, NumberInput, Select, SliderNumber, Textarea } from '@/ui';
import { MusicPresetBar } from './MusicPresetBar';

/** Left panel while the Generate tab is on Music. */
export function MusicPanel() {
  return (
    <MediaPanel kind="music" presets={<MusicPresetBar />} seed={<MusicSeed />}>
      <MusicForm />
    </MediaPanel>
  );
}

function MusicSeed() {
  const seed = useMusic((s) => s.form.seed);
  const random = useMusic((s) => s.form.randomizeSeed);
  const setForm = useMusic((s) => s.setForm);
  return <SeedControl seed={seed} random={random} onSeed={(v) => setForm({ seed: v })} onRandom={(v) => setForm({ randomizeSeed: v })} onShuffle={() => setForm({ seed: randomSeed() })} />;
}

function MusicForm() {
  const form = useMusic((s) => s.form);
  const setForm = useMusic((s) => s.setForm);
  return (
    <section className="mf-card">
      <label className="mf-field">
        <span>{t('music.tags')}</span>
        <Textarea rows={3} value={form.tags} placeholder={t('music.tagsPlaceholder')} onChange={(e) => setForm({ tags: e.target.value })} data-testid="music-tags" />
      </label>

      <Checkbox checked={form.instrumental} onChange={(v) => setForm({ instrumental: v })} label={t('music.instrumental')} />
      <label className="mf-field">
        <span>{t('music.lyrics')}</span>
        <Textarea
          rows={8}
          value={form.lyrics}
          disabled={form.instrumental}
          placeholder={t('music.lyricsPlaceholder')}
          onChange={(e) => setForm({ lyrics: e.target.value })}
          data-testid="music-lyrics"
        />
      </label>
      <label className="mf-field">
        <span>{t('music.language')}</span>
        <Select
          value={form.language}
          onChange={(v) => setForm({ language: v })}
          options={MUSIC_LANGUAGES.map((l) => ({ value: l, label: t(`music.lang.${l}`) }))}
          disabled={form.instrumental}
          aria-label={t('music.language')}
        />
      </label>

      <div className="mf-field">
        <span>{t('music.length', { seconds: form.seconds })}</span>
        <SliderNumber
          value={form.seconds}
          onChange={(v) => setForm({ seconds: v })}
          min={MUSIC_LIMITS.seconds.min}
          max={MUSIC_LIMITS.seconds.max}
          step={5}
          aria-label={t('music.lengthLabel')}
        />
      </div>
      <div className="mf-grid">
        <label className="mf-field">
          <span>{t('music.bpm')}</span>
          <NumberInput value={form.bpm} onChange={(v) => setForm({ bpm: v })} min={MUSIC_LIMITS.bpm.min} max={MUSIC_LIMITS.bpm.max} aria-label={t('music.bpm')} />
        </label>
        <label className="mf-field">
          <span>{t('music.timeSignature')}</span>
          <Select
            value={String(form.timeSignature)}
            onChange={(v) => setForm({ timeSignature: Number(v) })}
            options={TIME_SIGNATURES.map((n) => ({ value: String(n), label: `${n}/4` }))}
            aria-label={t('music.timeSignature')}
          />
        </label>
      </div>
      <label className="mf-field">
        <span>{t('music.key')}</span>
        <Select value={form.key} onChange={(v) => setForm({ key: v })} options={MUSIC_KEYS.map((k) => ({ value: k, label: k }))} aria-label={t('music.key')} />
      </label>

      <div className="mf-grid">
        <label className="mf-field">
          <span>{t('music.steps')}</span>
          <NumberInput value={form.steps} onChange={(v) => setForm({ steps: v })} min={MUSIC_LIMITS.steps.min} max={MUSIC_LIMITS.steps.max} aria-label={t('music.steps')} />
        </label>
        <label className="mf-field">
          <span>{t('music.cfg')}</span>
          <NumberInput value={form.cfgScale} onChange={(v) => setForm({ cfgScale: v })} min={MUSIC_LIMITS.cfg.min} max={MUSIC_LIMITS.cfg.max} step={0.5} aria-label={t('music.cfg')} />
        </label>
      </div>
      <p className="mf-note">{t('music.note')}</p>
    </section>
  );
}
