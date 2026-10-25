// The panes of the Settings modal, one per tab: general, generation, gallery, editing, comic and text, accounts and
// developer. Each control writes its setting at once; the engine and data panes have files of their own.
import { useState } from 'react';
import { backend } from '@/backend';
import { LOCALES, t, tCount, type Locale, type MessageKey } from '@/i18n';
import { FRAME_MARGIN_RANGE, FRAME_WIDTH_RANGE, PAGE_SIZES, READING_DIRECTIONS } from '@/state/comic/document';
import { useGallery, type GallerySettings } from '@/state/gallery';
import { COMIC_PANELS_RANGE, DRAFT_COUNT_RANGE, DRAFT_POSITION_RANGE, READ_ACCESS, TOAST_SECONDS_RANGE, UNDO_LIMIT_RANGE, useSettings, type SettingsValues, type StartTab } from '@/state/settings';
import { toast } from '@/state/toasts';
import { NAV, type TabName } from '@/state/ui';
import { sanitizeUiZoom, UI_ZOOM_STEPS } from '@/state/uiZoom';
import { Button, FontPicker, Select, Slider, SliderNumber, Switch } from '@/ui';
import { CivitaiKeyControl, HuggingFaceTokenControl } from './CivitaiKeyControl';
import { LowMemoryNote, LowMemorySwitch } from './LowMemoryControl';
import { Row, SectionBlock } from './settingsLayout';

const LANGUAGE_KEYS: Record<Locale, MessageKey> = {
  ja: 'settings.language.ja',
  en: 'settings.language.en',
  'zh-CN': 'settings.language.zhcn',
  'zh-TW': 'settings.language.zhtw',
  ko: 'settings.language.ko',
  ru: 'settings.language.ru',
  es: 'settings.language.es',
  'pt-BR': 'settings.language.ptbr',
  fr: 'settings.language.fr',
  de: 'settings.language.de',
};

/** The side bar's name of each tab. */
const TAB_LABEL: Record<TabName, MessageKey> = {
  generate: 'app.tabs.generate',
  canvas: 'app.tabs.canvas',
  comic: 'app.tabs.comic',
  upscaling: 'app.tabs.upscaling',
  workflows: 'app.tabs.workflows',
  models: 'app.tabs.models',
  browse: 'app.tabs.browse',
  queue: 'app.tabs.queue',
  extensions: 'app.nav.extensions',
};

type BoolSetting = { [K in keyof SettingsValues]: SettingsValues[K] extends boolean ? K : never }[keyof SettingsValues];

function Toggle({ k, label, help, testId }: { k: BoolSetting; label: string; help?: string; testId?: string }) {
  const value = useSettings((s) => s[k]);
  const set = useSettings((s) => s.set);
  return (
    <Row label={label} help={help}>
      <Switch checked={value} onChange={(v) => set({ [k]: v })} aria-label={label} data-testid={testId} />
    </Row>
  );
}

/** A number setting with a slider and a box beside it. */
function NumberRow({ k, label, help, range, testId }: { k: 'toastSeconds' | 'undoLimit' | 'comicPanelCount' | 'comicFrameMm' | 'comicMarginMm' | 'mockStepDelay' | 'draftCount' | 'draftPosition'; label: string; help?: string; range: { min: number; max: number; step: number }; testId?: string }) {
  const value = useSettings((s) => s[k]);
  const set = useSettings((s) => s.set);
  return (
    <Row label={label} help={help}>
      <div className="st-slider" data-testid={testId}>
        <SliderNumber value={value} onChange={(v) => set({ [k]: v })} min={range.min} max={range.max} step={range.step} aria-label={label} />
      </div>
    </Row>
  );
}

export function GeneralPane() {
  const s = useSettings();
  const mock = backend.kind === 'mock';
  const startOptions: { value: StartTab; label: string }[] = [{ value: 'last', label: t('settings.startTab.last') }, ...NAV.map((tab) => ({ value: tab, label: t(TAB_LABEL[tab]) }))];
  return (
    <>
      <SectionBlock title={t('settings.section.look')}>
        <Row label={t('settings.language.label')}>
          <Select className="st-select" value={s.language} onChange={(v) => s.set({ language: v })} options={LOCALES.map((l) => ({ value: l, label: t(LANGUAGE_KEYS[l]) }))} aria-label={t('settings.language.label')} />
        </Row>
        <Row label={t('settings.theme.label')}>
          <Select
            className="st-select"
            value={s.theme}
            onChange={(v) => s.set({ theme: v })}
            options={[
              { value: 'dark', label: t('settings.theme.dark') },
              { value: 'light', label: t('settings.theme.light') },
            ]}
            aria-label={t('settings.theme.label')}
          />
        </Row>
        {!mock && (
          <Row label={t('settings.uiZoom.label')} help={t('settings.uiZoom.help')}>
            <Select
              className="st-select"
              value={String(sanitizeUiZoom(s.uiZoom))}
              onChange={(v) => s.set({ uiZoom: Number(v) })}
              options={UI_ZOOM_STEPS.map((z) => ({ value: String(z), label: `${Math.round(z * 100)}%` }))}
              aria-label={t('settings.uiZoom.label')}
              data-testid="settings-ui-zoom"
            />
          </Row>
        )}
      </SectionBlock>
      <SectionBlock title={t('settings.section.behaviour')}>
        <Row label={t('settings.startTab.label')}>
          <Select className="st-select" value={s.startTab} onChange={(v) => s.set({ startTab: v })} options={startOptions} aria-label={t('settings.startTab.label')} data-testid="settings-start-tab" />
        </Row>
        <NumberRow k="toastSeconds" label={t('settings.toastSeconds.label')} range={TOAST_SECONDS_RANGE} testId="settings-toast-seconds" />
      </SectionBlock>
    </>
  );
}

export function GenerationPane() {
  const mock = backend.kind === 'mock';
  const readAccess = useSettings((s) => s.assistantReadAccess);
  const webAccess = useSettings((s) => s.assistantWebAccess);
  const set = useSettings((s) => s.set);
  return (
    <>
      <SectionBlock title={t('settings.section.generation')}>
        <Toggle k="antialiasProgressImages" label={t('settings.antialiasProgressImages')} />
        <Row label={t('settings.lowMemory.label')} help={t('settings.lowMemory.help')}>
          <LowMemorySwitch />
        </Row>
        <LowMemoryNote />
        <NumberRow k="draftCount" label={t('settings.draftCount.label')} range={DRAFT_COUNT_RANGE} testId="settings-draft-count" />
        <NumberRow k="draftPosition" label={t('settings.draftPosition.label')} range={DRAFT_POSITION_RANGE} testId="settings-draft-position" />
        {mock && <NumberRow k="mockStepDelay" label={t('settings.mockStepDelay')} help={t('settings.mockStepDelayHelp')} range={{ min: 0, max: 300, step: 10 }} />}
      </SectionBlock>
      <SectionBlock title={t('settings.section.assistant')}>
        <Row label={t('settings.assistantRead.label')} help={t('settings.assistantRead.help')}>
          <Select
            className="st-select"
            value={readAccess}
            onChange={(v) => set({ assistantReadAccess: v })}
            options={READ_ACCESS.map((a) => ({ value: a, label: t(`settings.assistantRead.${a}`) }))}
            aria-label={t('settings.assistantRead.label')}
            data-testid="settings-assistant-read"
          />
        </Row>
        <Row label={t('settings.assistantWeb.label')} help={t('settings.assistantWeb.help')}>
          <Select
            className="st-select"
            value={webAccess}
            onChange={(v) => set({ assistantWebAccess: v })}
            options={READ_ACCESS.map((a) => ({ value: a, label: t(`settings.assistantRead.${a}`) }))}
            aria-label={t('settings.assistantWeb.label')}
            data-testid="settings-assistant-web"
          />
        </Row>
      </SectionBlock>
    </>
  );
}

export function GalleryPane() {
  const g = useGallery((st) => st.settings);
  const set = (patch: Partial<GallerySettings>) => useGallery.getState().setSettings(patch);
  const images = useGallery((st) => st.images);
  const intermediates = images.filter((i) => i.isIntermediate).map((i) => i.name);
  const [clearing, setClearing] = useState(false);
  const toggle = (key: 'autoSwitch' | 'autoAssignBoardOnClick' | 'starredFirst' | 'alwaysShowImageSizeBadge' | 'showArchivedBoards' | 'groupByDate', label: string) => (
    <Row label={label}>
      <Switch checked={g[key]} onChange={(v) => set({ [key]: v })} aria-label={label} data-testid={`settings-gallery-${key}`} />
    </Row>
  );
  const clearIntermediates = async () => {
    setClearing(true);
    try {
      await backend.deleteImages(intermediates);
      useGallery.getState().removeImages(intermediates);
      toast({ status: 'success', title: tCount('settings.toast.intermediatesCleared', intermediates.length) });
    } catch (err) {
      toast({ status: 'error', title: t('settings.toast.intermediatesFailed'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      setClearing(false);
    }
  };
  return (
    <>
      <SectionBlock title={t('settings.section.galleryView')}>
        <Row label={t('gallery.settings.thumbnailSize')}>
          <div className="st-slider">
            <Slider value={g.thumbnailSize} min={45} max={256} step={1} onChange={(v) => set({ thumbnailSize: v })} aria-label={t('gallery.settings.thumbnailSize')} />
          </div>
        </Row>
        <Row label={t('gallery.settings.sort')}>
          <Select
            className="st-select"
            value={g.sortDirection}
            onChange={(v) => set({ sortDirection: v })}
            options={[
              { value: 'desc', label: t('gallery.settings.sortNewest') },
              { value: 'asc', label: t('gallery.settings.sortOldest') },
            ]}
            aria-label={t('gallery.settings.sort')}
          />
        </Row>
        {toggle('starredFirst', t('gallery.settings.starredFirst'))}
        {toggle('groupByDate', t('gallery.settings.groupByDate'))}
        {toggle('alwaysShowImageSizeBadge', t('gallery.settings.alwaysShowSize'))}
        {toggle('showArchivedBoards', t('gallery.settings.showArchived'))}
      </SectionBlock>
      <SectionBlock title={t('settings.section.galleryActions')}>
        {toggle('autoSwitch', t('gallery.settings.autoSwitch'))}
        {toggle('autoAssignBoardOnClick', t('gallery.settings.autoAssign'))}
        <Toggle k="confirmOnDelete" label={t('settings.confirmOnDelete')} />
        <Row label={t('settings.clearIntermediates')} help={t('settings.clearIntermediatesHelp')}>
          <Button size="sm" scheme="danger" variant="outline" disabled={intermediates.length === 0} isLoading={clearing} onClick={() => void clearIntermediates()}>
            {tCount('settings.clearIntermediatesButton', intermediates.length)}
          </Button>
        </Row>
      </SectionBlock>
    </>
  );
}

export function EditPane() {
  return (
    <SectionBlock title={t('settings.section.edit')}>
      <NumberRow k="undoLimit" label={t('settings.undoLimit.label')} help={t('settings.undoLimit.help')} range={UNDO_LIMIT_RANGE} testId="settings-undo-limit" />
    </SectionBlock>
  );
}

export function ComicTextPane() {
  const s = useSettings();
  return (
    <>
      <SectionBlock title={t('settings.section.fonts')}>
        <Row label={t('settings.comicFont.label')}>
          <FontPicker value={s.comicFont || null} onChange={(font) => s.set({ comicFont: font ?? '' })} defaultLabel={t('common.font.standard')} label={t('settings.comicFont.label')} testId="settings-comic-font" />
        </Row>
        <Row label={t('settings.textFont.label')}>
          <FontPicker value={s.textFont || null} onChange={(font) => s.set({ textFont: font ?? '' })} defaultLabel={t('common.font.standard')} label={t('settings.textFont.label')} testId="settings-text-font" />
        </Row>
      </SectionBlock>
      <SectionBlock title={t('settings.section.comicPage')}>
        <p className="st-row__help st-pane__note">{t('settings.comicPage.help')}</p>
        <Row label={t('comic.page.size')}>
          <Select className="st-select" value={s.comicPageSize} onChange={(v) => s.set({ comicPageSize: v })} options={PAGE_SIZES.map((p) => ({ value: p, label: p }))} aria-label={t('comic.page.size')} data-testid="settings-comic-size" />
        </Row>
        <Row label={t('comic.page.direction')}>
          <Select
            className="st-select"
            value={s.comicDirection}
            onChange={(v) => s.set({ comicDirection: v })}
            options={READING_DIRECTIONS.map((d) => ({ value: d, label: t(`comic.page.direction.${d}`) }))}
            aria-label={t('comic.page.direction')}
            data-testid="settings-comic-direction"
          />
        </Row>
        <NumberRow k="comicPanelCount" label={t('settings.comicPage.panels')} range={COMIC_PANELS_RANGE} testId="settings-comic-panels" />
        <NumberRow k="comicFrameMm" label={t('comic.page.frameWidth')} range={FRAME_WIDTH_RANGE} />
        <NumberRow k="comicMarginMm" label={t('comic.page.margin')} range={FRAME_MARGIN_RANGE} />
      </SectionBlock>
    </>
  );
}

export function AccountsPane() {
  return (
    <SectionBlock title={t('settings.section.accounts')}>
      <Row label={t('settings.civitaiKey.label')} help={t('settings.civitaiKey.help')}>
        <CivitaiKeyControl />
      </Row>
      <Row label={t('settings.hfToken.label')} help={t('settings.hfToken.help')}>
        <HuggingFaceTokenControl />
      </Row>
    </SectionBlock>
  );
}

export function DeveloperPane() {
  return (
    <SectionBlock title={t('settings.section.developer')}>
      <Toggle k="showDevLog" label={t('settings.showDevLog')} help={t('settings.showDevLogHelp')} />
    </SectionBlock>
  );
}
