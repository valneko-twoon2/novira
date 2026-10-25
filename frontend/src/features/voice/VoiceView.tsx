// Voice screen of the Generate tab: the text, the language and the voice (left), finished clips (center).
import type { VoiceMode } from '@/backend';
import { MediaPanel } from '@/features/media/MediaPanel';
import { t } from '@/i18n';
import { VOICE_LANGUAGES, VOICE_SPEAKERS, useVoice } from '@/state/media/voice';
import { cx, Select, Textarea } from '@/ui';
import { VoicePresetBar } from './VoicePresetBar';

/** Left panel while the Generate tab is on Voice. */
export function VoicePanel() {
  return (
    <MediaPanel kind="voice" presets={<VoicePresetBar />}>
      <VoiceForm />
    </MediaPanel>
  );
}

const MODES: VoiceMode[] = ['preset', 'design'];

function VoiceForm() {
  const form = useVoice((s) => s.form);
  const setForm = useVoice((s) => s.setForm);
  return (
    <section className="mf-card">
      <label className="mf-field">
        <span>{t('voice.text')}</span>
        <Textarea rows={6} value={form.text} placeholder={t('voice.textPlaceholder')} onChange={(e) => setForm({ text: e.target.value })} data-testid="voice-text" />
      </label>
      <label className="mf-field">
        <span>{t('voice.language')}</span>
        <Select
          value={form.language}
          onChange={(v) => setForm({ language: v })}
          options={VOICE_LANGUAGES.map((l) => ({ value: l, label: t(`voice.lang.${l}`) }))}
          aria-label={t('voice.language')}
        />
      </label>

      <div className="mf-seg" role="tablist" aria-label={t('voice.mode.label')}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={form.mode === m}
            className={cx(form.mode === m && 'is-on')}
            data-testid={`voice-mode-${m}`}
            onClick={() => setForm({ mode: m })}
          >
            {t(`voice.mode.${m}`)}
          </button>
        ))}
      </div>

      {form.mode === 'preset' ? (
        <>
          <label className="mf-field">
            <span>{t('voice.speaker')}</span>
            <Select
              value={form.speaker}
              onChange={(v) => setForm({ speaker: v })}
              options={VOICE_SPEAKERS.map((s) => ({ value: s, label: t(`voice.speaker.${s}`) }))}
              aria-label={t('voice.speaker')}
            />
          </label>
          <label className="mf-field">
            <span>{t('voice.style')}</span>
            <Textarea rows={2} value={form.instruct} placeholder={t('voice.stylePlaceholder')} onChange={(e) => setForm({ instruct: e.target.value })} data-testid="voice-style" />
          </label>
        </>
      ) : (
        <label className="mf-field">
          <span>{t('voice.description')}</span>
          <Textarea rows={3} value={form.instruct} placeholder={t('voice.descriptionPlaceholder')} onChange={(e) => setForm({ instruct: e.target.value })} data-testid="voice-description" />
        </label>
      )}
      <p className="mf-note">{t('voice.note')}</p>
    </section>
  );
}
