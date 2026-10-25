// What the comic screen adds to the Generate form in its left column: whether the settings below are the whole comic's or the
// page on screen's, the quality words and the shared negative prompt, and the character references. The prompt boxes hold the
// selected panel's prompts while the comic screen is open (see state/comic/promptSync.ts).
import { t } from '@/i18n';
import { useDrawScope, type DrawScope } from '@/state/comic/drawScope';
import { reloadDraw } from '@/state/comic/drawSync';
import { CAST_REFERENCE_DEFAULT, CAST_REFERENCE_MAX, CAST_REFERENCE_MIN } from '@/state/comic/document';
import { STYLE_MAX, defaultStyle, type ComicStyle } from '@/state/comic/style';
import { activePage, activeProject, useComic } from '@/state/comic/store';
import { findModel } from '@/state/models';
import { useParams } from '@/state/params';
import { Button, Checkbox, cx, Field, Section, SliderNumber, Textarea } from '@/ui';

/** Whether the settings below edit the whole comic or the page on screen, and the way back from a page's own changes. */
function DrawScopeBar() {
  const scope = useDrawScope((s) => s.scope);
  const page = useComic((s) => activePage(s));
  const changed = !!page && (Object.keys(page.draw ?? {}).length > 0 || !!page.style);
  return (
    <div className="comic-drawscope" data-testid="comic-draw-scope">
      <div className="comic-quick__modes" role="group" aria-label={t('comic.draw.scope.label')}>
        {(['comic', 'page'] as DrawScope[]).map((s) => (
          <button key={s} type="button" className={cx('comic-quick__mode', s === scope && 'is-on')} aria-pressed={s === scope} data-testid={`comic-draw-scope-${s}`} onClick={() => useDrawScope.getState().setScope(s)}>
            {t(`comic.draw.scope.${s}`)}
          </button>
        ))}
      </div>
      <p className="comic-hint">{t('comic.draw.scope.help')}</p>
      {changed && page && (
        <p className="comic-hint">
          {t('comic.draw.scope.pageChanged')}{' '}
          <Button
            size="xs"
            variant="outline"
            data-testid="comic-draw-page-reset"
            onClick={() => {
              useComic.getState().setPageDraw(page.id, undefined);
              useComic.getState().setPageStyle(page.id, undefined);
              reloadDraw();
            }}
          >
            {t('comic.draw.scope.pageReset')}
          </Button>
        </p>
      )}
    </div>
  );
}

/** The quality words and the shared negative prompt of the comic (or of the page, in the page scope); the defaults are the hints. */
function StyleFields() {
  const scope = useDrawScope((s) => s.scope);
  const project = useComic((s) => activeProject(s));
  const page = useComic((s) => activePage(s));
  const base = useParams((s) => findModel(s.modelKey)?.base ?? null);
  if (!project) return null;
  const onPage = scope === 'page' && !!page;
  const current: ComicStyle | undefined = onPage ? page.style : project.style;
  const fallback = defaultStyle(base);
  const set = (patch: ComicStyle) => {
    const next: ComicStyle = { ...current, ...patch };
    for (const k of ['positive', 'negative'] as const) if (!next[k]) delete next[k];
    const style = Object.keys(next).length ? next : undefined;
    if (onPage) useComic.getState().setPageStyle(page.id, style);
    else useComic.getState().setStyle(project.id, style);
  };
  return (
    <section className="comic-drawstyle" data-testid="comic-draw-style">
      <h4 className="comic-drawstyle__title">{t('comic.draw.style.title')}</h4>
      {(['positive', 'negative'] as const).map((k) => (
        <label key={k} className="comic-cast__field">
          <span className="comic-cast__label">{t(`comic.draw.style.${k}`)}</span>
          <Textarea value={current?.[k] ?? ''} maxLength={STYLE_MAX} placeholder={fallback[k]} onChange={(e) => set({ [k]: e.target.value })} data-testid={`comic-draw-style-${k}`} />
        </label>
      ))}
      <p className="comic-hint">{t('comic.draw.style.help')}</p>
    </section>
  );
}

/**
 * Whether the panels follow their characters' reference pictures through an IP-Adapter, and how strongly: off unless
 * turned on, for the whole comic.
 */
function CastReferenceFields() {
  const project = useComic((s) => activeProject(s));
  if (!project) return null;
  const strength = project.castReference;
  const set = (weight: number | undefined) => useComic.getState().setCastReference(project.id, weight);
  return (
    <section className="comic-drawstyle" data-testid="comic-cast-reference">
      <h4 className="comic-drawstyle__title">{t('comic.draw.castReference.title')}</h4>
      <span data-testid="comic-cast-reference-use">
        <Checkbox checked={strength !== undefined} onChange={(on) => set(on ? CAST_REFERENCE_DEFAULT : undefined)} label={t('comic.draw.castReference.use')} />
      </span>
      {strength !== undefined && (
        <Field label={t('comic.draw.castReference.weight')}>
          <SliderNumber
            value={strength}
            onChange={set}
            min={CAST_REFERENCE_MIN}
            max={CAST_REFERENCE_MAX}
            step={0.05}
            precision={2}
            aria-label={t('comic.draw.castReference.weight')}
          />
        </Field>
      )}
      <p className="comic-hint">{t('comic.draw.castReference.help')}</p>
    </section>
  );
}

/** The comic's own drawing settings, in an accordion among the Generate form's: scope, quality words and character references. */
export function ComicDrawExtras() {
  return (
    <Section title={t('comic.draw.settings')} defaultOpen>
      <div className="comic-drawsettings" data-testid="comic-draw-settings">
        <p className="comic-drawsettings__help">{t('comic.draw.settingsHelp')}</p>
        <DrawScopeBar />
        <StyleFields />
        <CastReferenceFields />
      </div>
    </Section>
  );
}
