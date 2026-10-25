// Video screen of the Generate tab: make a video from text, or animate a reference image (image mode).
import { FilmSlate, ImageSquare, Trash, X } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { backend, randomSeed, type ImageDTO } from '@/backend';
import { t, tCount } from '@/i18n';
import { useFinish } from '@/state/dialogs/finish';
import { findImage, useGallery } from '@/state/gallery';
import { BASE_LABELS, isVideoModel, useModels } from '@/state/models';
import { toast } from '@/state/toasts';
import { VIDEO_FAMILY_PRESETS, VIDEO_LIMITS, VIDEO_PRESETS, VIDEO_SIZES, framesFor, useVideo, type VideoMode, type VideoModel } from '@/state/media/video';
import { Button, Checkbox, cx, IconButton, ImageDropZone, NumberInput, Select, SliderNumber, Textarea } from '@/ui';
import { MediaJobs, useMediaJobs } from '@/features/media/MediaJobs';
import { MediaPanel } from '@/features/media/MediaPanel';
import { SeedControl } from '@/features/media/SeedControl';
import { PackChoice } from '@/features/media/PackChoice';
import { VideoPresetBar } from './VideoPresetBar';
import './video.css';

/** Left panel while the Generate tab is on Video: the Invoke row and the video settings. */
export function VideoPanel() {
  const model = useVideo((s) => s.form.model);
  const own = useVideo((s) => s.form.modelKey);
  const setForm = useVideo((s) => s.setForm);
  // The download card is for the two models of the video pack; an installed model needs none.
  const choice = own ? <></> : (
    <PackChoice
      title={t('media.choice.pickVideo')}
      testId="video-pack"
      selected={model === 'fast' ? 'turbo' : 'video'}
      onSelect={(kind) => setForm({ model: kind === 'turbo' ? 'fast' : 'standard' })}
      options={[
        { kind: 'video', name: t('video.model.standard'), note: t('video.model.standardHint') },
        { kind: 'turbo', name: t('video.model.fast'), note: t('video.model.fastHint') },
      ]}
    />
  );
  return (
    <MediaPanel kind="video" packCard={choice} presets={<VideoPresetBar />} seed={<VideoSeed />}>
      <VideoForm />
    </MediaPanel>
  );
}

function VideoSeed() {
  const seed = useVideo((s) => s.form.seed);
  const random = useVideo((s) => s.form.randomizeSeed);
  const setForm = useVideo((s) => s.setForm);
  return <SeedControl seed={seed} random={random} onSeed={(v) => setForm({ seed: v })} onRandom={(v) => setForm({ randomizeSeed: v })} onShuffle={() => setForm({ seed: randomSeed() })} />;
}

function VideoForm() {
  const form = useVideo((s) => s.form);
  const setForm = useVideo((s) => s.setForm);
  const images = useGallery((s) => s.images);
  const source = images.find((i) => i.name === form.sourceImageName);
  const frames = framesFor(form.seconds, form.fps);
  const models = useModels((s) => s.models);
  const installed = useMemo(() => models.filter(isVideoModel), [models]);
  const own = form.modelKey ? installed.find((m) => m.key === form.modelKey) : undefined;
  const pickModel = (value: string) => {
    const picked = installed.find((m) => m.key === value);
    if (!picked) {
      setForm({ modelKey: null, model: value as VideoModel, ...VIDEO_PRESETS[value as VideoModel] });
      return;
    }
    const preset = VIDEO_FAMILY_PRESETS[picked.base];
    setForm({ modelKey: picked.key, ...(preset ?? {}) });
  };

  const pickFromGallery = () => {
    const name = useGallery.getState().selection.at(-1);
    const image = findImage(name ?? null);
    if (!image || image.mediaType === 'video') {
      toast({ status: 'warning', title: t('video.pickFromGalleryNone') });
      return;
    }
    setForm({ sourceImageName: image.name, mode: 'image' });
  };

  const upload = async (files: File[]) => {
    try {
      const image = await backend.uploadImage(files[0]!, { boardId: null, category: 'user' });
      useGallery.getState().addImage(image);
      setForm({ sourceImageName: image.name, mode: 'image' });
    } catch (err) {
      toast({ status: 'error', title: t('video.uploadFailed'), description: err instanceof Error ? err.message : String(err) });
    }
  };

  const modes: { value: VideoMode; label: string }[] = [
    { value: 'text', label: t('video.mode.text') },
    { value: 'image', label: t('video.mode.image') },
  ];

  return (
    <section className="mf-card">
      <div className="mf-seg" role="tablist" aria-label={t('video.mode.label')}>
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={form.mode === m.value}
            className={cx(form.mode === m.value && 'is-on')}
            data-testid={`video-mode-${m.value}`}
            onClick={() => setForm({ mode: m.value })}
          >
            {m.label}
          </button>
        ))}
      </div>

      {form.mode === 'image' && (
        <ImageDropZone
          className="vv-source"
          label={t('video.dropImage')}
          onImages={(names) => {
            const image = findImage(names[0] ?? null);
            if (image && image.mediaType !== 'video') setForm({ sourceImageName: image.name });
          }}
          onFiles={(files) => void upload(files)}
        >
          {source ? (
            <div className="vv-source__preview">
              <img src={source.thumbnailUrl} alt="" draggable={false} />
              <IconButton size="xs" label={t('video.clearImage')} icon={<X />} onClick={() => setForm({ sourceImageName: null })} />
            </div>
          ) : (
            <div className="vv-source__empty">
              <ImageSquare size={24} />
              <span>{t('video.sourceHint')}</span>
            </div>
          )}
          <Button size="xs" variant="outline" onClick={pickFromGallery}>
            {t('video.pickFromGallery')}
          </Button>
        </ImageDropZone>
      )}

      <label className="mf-field">
        <span>{t('video.prompt')}</span>
        <Textarea
          rows={4}
          value={form.positivePrompt}
          placeholder={t(form.mode === 'image' ? 'video.promptPlaceholderImage' : 'video.promptPlaceholderText')}
          onChange={(e) => setForm({ positivePrompt: e.target.value })}
          data-testid="video-prompt"
        />
      </label>
      <label className="mf-field">
        <span>{t('video.negative')}</span>
        <Textarea rows={2} value={form.negativePrompt} onChange={(e) => setForm({ negativePrompt: e.target.value })} />
      </label>

      <label className="mf-field">
        <span>{t('video.model')}</span>
        <Select
          value={own ? own.key : form.model}
          onChange={pickModel}
          options={[
            { value: 'standard', label: t('video.model.standard') },
            { value: 'fast', label: t('video.model.fast') },
            ...installed.map((m) => ({ value: m.key, label: `${m.name} (${BASE_LABELS[m.base]})` })),
          ]}
          aria-label={t('video.model')}
          data-testid="video-model"
        />
        <small className="mf-hint">{own ? t('video.model.ownHint', { family: BASE_LABELS[own.base] }) : t(form.model === 'fast' ? 'video.model.fastHint' : 'video.model.standardHint')}</small>
      </label>
      <div className="mf-grid">
        <label className="mf-field">
          <span>{t('video.size')}</span>
          <Select
            value={`${form.width}x${form.height}`}
            onChange={(v) => {
              const size = VIDEO_SIZES.find((s) => s.value === v);
              if (size) setForm({ width: size.width, height: size.height });
            }}
            options={VIDEO_SIZES.map((s) => ({ value: s.value, label: `${s.width}×${s.height}` }))}
            aria-label={t('video.size')}
          />
        </label>
        <label className="mf-field">
          <span>{t('video.fps')}</span>
          <NumberInput value={form.fps} onChange={(v) => setForm({ fps: v })} min={VIDEO_LIMITS.fps.min} max={VIDEO_LIMITS.fps.max} aria-label={t('video.fps')} />
        </label>
      </div>
      <div className="mf-field">
        <span>{t('video.length', { seconds: form.seconds, frames })}</span>
        <SliderNumber
          value={form.seconds}
          onChange={(v) => setForm({ seconds: v })}
          min={VIDEO_LIMITS.seconds.min}
          max={VIDEO_LIMITS.seconds.max}
          step={1}
          aria-label={t('video.lengthLabel')}
        />
      </div>
      <div className="mf-grid">
        <label className="mf-field">
          <span>{t('video.steps')}</span>
          <NumberInput value={form.steps} onChange={(v) => setForm({ steps: v })} min={VIDEO_LIMITS.steps.min} max={VIDEO_LIMITS.steps.max} aria-label={t('video.steps')} />
        </label>
        <label className="mf-field">
          <span>{t('video.cfg')}</span>
          <NumberInput value={form.cfgScale} onChange={(v) => setForm({ cfgScale: v })} min={VIDEO_LIMITS.cfg.min} max={VIDEO_LIMITS.cfg.max} step={0.5} aria-label={t('video.cfg')} />
        </label>
      </div>
      <div className="mf-light" data-testid="video-light">
        <strong>{t('video.light.title')}</strong>
        <Checkbox checked={form.fp8} onChange={(v) => setForm({ fp8: v })} label={t('video.light.fp8')} />
        <small className="mf-hint">{t('video.light.fp8Hint')}</small>
        <Checkbox checked={form.tiledDecode} onChange={(v) => setForm({ tiledDecode: v })} label={t('video.light.tiled')} />
        <small className="mf-hint">{t('video.light.tiledHint')}</small>
        <small className="mf-hint">{t('video.light.finishHint')}</small>
      </div>

      <p className="mf-note">{t('video.note')}</p>
    </section>
  );
}

/** Center area while the Generate tab is on Video: running jobs and the finished clips. */
export function VideoResults() {
  const images = useGallery((s) => s.images);
  const { active } = useMediaJobs('video');
  const videos = useMemo(() => images.filter((i) => i.mediaType === 'video').sort((a, b) => b.createdAt - a.createdAt), [images]);
  return (
    <div className="mf-results" data-testid="video-results">
      <MediaJobs kind="video" />
      {videos.length === 0 && active.length === 0 ? (
        <div className="mf-empty">
          <FilmSlate size={32} />
          <strong>{t('video.empty.title')}</strong>
          <p>{t('video.empty.description')}</p>
        </div>
      ) : (
        <div className="vv-list">
          {videos.map((v) => (
            <VideoCard key={v.name} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoCard({ video }: { video: ImageDTO }) {
  const meta = video.metadata;
  const frames = meta?.videoFrames;
  const fps = meta?.videoFps;
  return (
    <article className="vv-clip" data-testid="video-clip">
      <video src={video.url} poster={video.thumbnailUrl} controls loop muted playsInline preload="metadata" />
      <div className="vv-clip__meta">
        <span className="vv-clip__prompt" title={meta?.positivePrompt}>
          {meta?.positivePrompt}
        </span>
        <span className="vv-clip__info">
          {video.width}×{video.height}
          {frames && fps ? ` · ${tCount('video.clipLength', Math.round((frames / fps) * 10) / 10)}` : ''}
          {meta ? ` · seed ${meta.seed}` : ''}
        </span>
        <Button size="xs" variant="outline" onClick={() => useFinish.getState().open(video.name)} data-testid="video-finish">
          {t('video.finish')}
        </Button>
        <IconButton
          size="xs"
          label={t('video.delete')}
          icon={<Trash />}
          onClick={() => {
            void backend.deleteImages([video.name]).then(() => useGallery.getState().removeImages([video.name]));
          }}
        />
      </div>
    </article>
  );
}
