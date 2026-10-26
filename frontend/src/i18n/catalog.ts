// Message catalogs split per area so features can be edited independently.
// `ja` is the source of truth; ja and en hold every key, the other locales may lack some and fall back to en
// (tests/i18n.test.ts, scripts/check-i18n-sync.mjs). ja and en are built into the app; the other languages are loaded
// when chosen (`loadCatalog`), one chunk per language (`bundles/<language>.ts`), so the app does not carry eight
// catalogs it does not show. A new area is imported here for ja and en; the other languages' bundles find it by its folder.
import jaAgent from './locales/ja/agent.json';
import jaApp from './locales/ja/app.json';
import jaBatch from './locales/ja/batch.json';
import jaFinish from './locales/ja/finish.json';
import jaBrowse from './locales/ja/browse.json';
import jaCanvas from './locales/ja/canvas.json';
import jaCharacters from './locales/ja/characters.json';
import jaCommon from './locales/ja/common.json';
import jaDrafts from './locales/ja/drafts.json';
import jaPhone from './locales/ja/phone.json';
import jaEngine from './locales/ja/engine.json';
import jaGallery from './locales/ja/gallery.json';
import jaManual from './locales/ja/manual.json';
import jaCutout from './locales/ja/cutout.json';
import jaLogo from './locales/ja/logo.json';
import jaMedia from './locales/ja/media.json';
import jaModels from './locales/ja/models.json';
import jaMusic from './locales/ja/music.json';
import jaParams from './locales/ja/params.json';
import jaPresets from './locales/ja/presets.json';
import jaQueue from './locales/ja/queue.json';
import jaSegment from './locales/ja/segment.json';
import jaSettings from './locales/ja/settings.json';
import jaSplash from './locales/ja/splash.json';
import jaFirstrun from './locales/ja/firstrun.json';
import jaText from './locales/ja/text.json';
import jaVideo from './locales/ja/video.json';
import jaVoice from './locales/ja/voice.json';
import jaPose from './locales/ja/pose.json';
import jaFacefix from './locales/ja/facefix.json';
import jaXyplot from './locales/ja/xyplot.json';
import jaCaption from './locales/ja/caption.json';
import jaLora from './locales/ja/lora.json';
import jaShare from './locales/ja/share.json';
import jaWorkflows from './locales/ja/workflows.json';
import jaComic from './locales/ja/comic.json';
import enAgent from './locales/en/agent.json';
import enApp from './locales/en/app.json';
import enBatch from './locales/en/batch.json';
import enFinish from './locales/en/finish.json';
import enBrowse from './locales/en/browse.json';
import enCanvas from './locales/en/canvas.json';
import enCharacters from './locales/en/characters.json';
import enCommon from './locales/en/common.json';
import enDrafts from './locales/en/drafts.json';
import enPhone from './locales/en/phone.json';
import enEngine from './locales/en/engine.json';
import enGallery from './locales/en/gallery.json';
import enManual from './locales/en/manual.json';
import enCutout from './locales/en/cutout.json';
import enLogo from './locales/en/logo.json';
import enMedia from './locales/en/media.json';
import enModels from './locales/en/models.json';
import enMusic from './locales/en/music.json';
import enParams from './locales/en/params.json';
import enPresets from './locales/en/presets.json';
import enQueue from './locales/en/queue.json';
import enSegment from './locales/en/segment.json';
import enSettings from './locales/en/settings.json';
import enSplash from './locales/en/splash.json';
import enFirstrun from './locales/en/firstrun.json';
import enText from './locales/en/text.json';
import enVideo from './locales/en/video.json';
import enVoice from './locales/en/voice.json';
import enPose from './locales/en/pose.json';
import enFacefix from './locales/en/facefix.json';
import enXyplot from './locales/en/xyplot.json';
import enCaption from './locales/en/caption.json';
import enLora from './locales/en/lora.json';
import enShare from './locales/en/share.json';
import enWorkflows from './locales/en/workflows.json';
import enComic from './locales/en/comic.json';

export const ja = {
  ...jaCharacters,
  ...jaCommon,
  ...jaApp,
  ...jaEngine,
  ...jaMedia,
  ...jaCutout,

  ...jaLogo,
  ...jaDrafts,
  ...jaPhone,
  ...jaAgent,
  ...jaParams,
  ...jaPresets,
  ...jaGallery,
  ...jaManual,
  ...jaCanvas,
  ...jaWorkflows,
  ...jaComic,
  ...jaModels,
  ...jaBrowse,
  ...jaQueue,
  ...jaSegment,
  ...jaBatch,
  ...jaFinish,
  ...jaSettings,
  ...jaVideo,
  ...jaMusic,
  ...jaVoice,
  ...jaPose,
  ...jaFacefix,
  ...jaXyplot,
  ...jaCaption,
  ...jaLora,
  ...jaShare,
  ...jaText,
  ...jaSplash,
  ...jaFirstrun,
};

export type MessageKey = keyof typeof ja;

/** The messages of one language; a language other than ja may lack some (they fall back to en, then ja). */
export type Catalog = Partial<Record<MessageKey, string>>;

export const en: Catalog = {
  ...enCharacters,
  ...enCommon,
  ...enApp,
  ...enEngine,
  ...enMedia,
  ...enCutout,
  ...enLogo,
  ...enDrafts,
  ...enPhone,
  ...enAgent,
  ...enParams,
  ...enPresets,
  ...enGallery,
  ...enManual,
  ...enCanvas,
  ...enWorkflows,
  ...enComic,
  ...enModels,
  ...enBrowse,
  ...enQueue,
  ...enSegment,
  ...enBatch,
  ...enFinish,
  ...enSettings,
  ...enVideo,
  ...enMusic,
  ...enVoice,
  ...enPose,
  ...enFacefix,
  ...enXyplot,
  ...enCaption,
  ...enLora,
  ...enShare,
  ...enText,
  ...enSplash,
  ...enFirstrun,
};

export const LOCALES = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'ru', 'es', 'pt-BR', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
/** The languages that always hold every message. The others may lack some and show the English text meanwhile (scripts/i18n-todo.mjs). */
export const PRIMARY_LOCALES: readonly Locale[] = ['ja', 'en'];

/** The languages loaded when chosen: one module per language in `bundles/`, each its own chunk. */
const BUNDLES = import.meta.glob<{ default: Catalog }>('./bundles/*.ts');

/** Every message of a language: ja and en at once, the others from their chunk. */
export async function loadCatalog(locale: Locale): Promise<Catalog> {
  if (locale === 'ja') return ja;
  if (locale === 'en') return en;
  const load = BUNDLES[`./bundles/${locale}.ts`];
  if (!load) throw new Error(`no catalog bundle for ${locale}`);
  return (await load()).default;
}
