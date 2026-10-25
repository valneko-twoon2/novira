// The page's settings, opened from the page's toolbar: how many panels, in how many columns, on which paper, read which
// way, how thick the frame lines are and their colour, the space between a frame and its picture, and whether its panels keep the shapes drawn by hand. The labels stand above their controls, so a long label in
// any language is not cut.
import { SlidersHorizontal } from '@phosphor-icons/react';
import { t, tCount } from '@/i18n';
import {
  COMIC_EFFECTS,
  FRAME_WIDTH_RANGE,
  PAGE_COLUMNS,
  PAGE_SIZES,
  PAGE_SIZE_MM,
  FRAME_MARGIN_RANGE,
  PICTURE_INSET_RANGE,
  type ComicEffect,
  type ComicPage,
  type ComicProject,
  type PageSize,
  type ReadingDirection,
} from '@/state/comic/document';
import { MAX_PANELS_PER_PAGE } from '@/state/comic/layout';
import { useComic } from '@/state/comic/store';
import { Button, Field, IconButton, NumberInput, Popover, PopoverContent, PopoverTrigger, Select, SliderNumber, TOOLBAR_BUTTON_SIZE } from '@/ui';

export function PageSettings({ page, project }: { page: ComicPage; project: ComicProject }) {
  const store = useComic.getState;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.page.settings')} icon={<SlidersHorizontal />} tooltip={false} title={t('comic.page.settings')} data-testid="comic-page-settings" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="comic-settings">
        <div className="comic-settings__body" data-testid="comic-pages">
          <h3 className="comic-settings__title">{t('comic.page.settings')}</h3>
          <div className="comic-settings__grid">
            <Field label={t('comic.page.panelCount')} orientation="vertical">
              <NumberInput
                value={page.panels.length}
                min={1}
                max={MAX_PANELS_PER_PAGE}
                step={1}
                onChange={(v) => store().setPanelCount(page.id, v)}
                aria-label={t('comic.page.panelCount')}
              />
            </Field>
            <Field label={t('comic.page.columns')} orientation="vertical">
              <Select<string>
                value={String(page.columns)}
                onChange={(v) => store().setPageLayout(page.id, { columns: Number(v) })}
                options={PAGE_COLUMNS.map((n) => ({ value: String(n), label: tCount('comic.page.columnCount', n) }))}
                aria-label={t('comic.page.columns')}
              />
            </Field>
            <Field label={t('comic.page.size')} orientation="vertical">
              <Select<string>
                value={page.size}
                onChange={(v) => store().setPageLayout(page.id, { size: v as PageSize })}
                options={PAGE_SIZES.map((s) => ({ value: s, label: `${s} (${PAGE_SIZE_MM[s].width} × ${PAGE_SIZE_MM[s].height} mm)` }))}
                aria-label={t('comic.page.size')}
              />
            </Field>
            <Field label={t('comic.page.direction')} orientation="vertical">
              <Select<ReadingDirection>
                value={page.direction}
                onChange={(direction) => store().setPageLayout(page.id, { direction })}
                options={[
                  { value: 'rtl', label: t('comic.page.direction.rtl') },
                  { value: 'ltr', label: t('comic.page.direction.ltr') },
                ]}
                aria-label={t('comic.page.direction')}
              />
            </Field>
          </div>
          <Field label={t('comic.page.frameWidth')} orientation="vertical">
            <SliderNumber
              value={page.frameMm}
              onChange={(v) => store().setPageLayout(page.id, { frameMm: v })}
              min={FRAME_WIDTH_RANGE.min}
              max={FRAME_WIDTH_RANGE.max}
              step={FRAME_WIDTH_RANGE.step}
              precision={1}
              aria-label={t('comic.page.frameWidth')}
            />
          </Field>
          <Field label={t('comic.page.frameColor')} orientation="vertical">
            <input
              type="color"
              className="comic-color"
              value={page.frameColor}
              aria-label={t('comic.page.frameColor')}
              onChange={(e) => store().setPageLayout(page.id, { frameColor: e.target.value })}
              data-testid="comic-frame-color"
            />
          </Field>
          <Field label={t('comic.page.margin')} orientation="vertical">
            <SliderNumber
              value={page.marginMm}
              onChange={(v) => store().setPageLayout(page.id, { marginMm: v })}
              min={FRAME_MARGIN_RANGE.min}
              max={FRAME_MARGIN_RANGE.max}
              step={FRAME_MARGIN_RANGE.step}
              precision={1}
              aria-label={t('comic.page.margin')}
            />
          </Field>
          <Field label={t('comic.page.inset')} orientation="vertical">
            <SliderNumber
              value={page.insetMm}
              onChange={(v) => store().setPageLayout(page.id, { insetMm: v })}
              min={PICTURE_INSET_RANGE.min}
              max={PICTURE_INSET_RANGE.max}
              step={PICTURE_INSET_RANGE.step}
              precision={1}
              aria-label={t('comic.page.inset')}
            />
          </Field>
          <Field label={t('comic.effect.comic')} orientation="vertical">
            <Select<ComicEffect>
              value={project.effect}
              onChange={(effect) => store().setProjectEffect(effect)}
              options={COMIC_EFFECTS.map((e) => ({ value: e, label: t(`comic.effect.${e}`) }))}
              aria-label={t('comic.effect.comic')}
            />
          </Field>
          <Field label={t('comic.effect.page')} orientation="vertical">
            <Select<string>
              value={page.effect ?? 'follow'}
              onChange={(v) => store().setPageEffect(page.id, v === 'follow' ? null : (v as ComicEffect))}
              options={[{ value: 'follow', label: t('comic.effect.follow') }, ...COMIC_EFFECTS.map((e) => ({ value: e, label: t(`comic.effect.${e}`) }))]}
              aria-label={t('comic.effect.page')}
            />
          </Field>
          <p className="comic-hint">{t('comic.effect.hint')}</p>
          <p className="comic-hint">{t(page.shapes ? 'comic.shape.custom' : 'comic.page.autoLayout')}</p>
          <p className="comic-hint">{t('comic.shape.hint')}</p>
          <div>
            <Button size="sm" variant="outline" disabled={!page.shapes} onClick={() => store().resetPageShapes(page.id)} data-testid="comic-shape-reset">
              {t('comic.shape.reset')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
