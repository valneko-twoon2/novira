// Invoke (split button), iterations box and cancel controls. Separate controls are 8px apart; only a button and its caret touch.
import { CaretDown, Check, GridFour, Lightning, Queue } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useComic, type DrawScope } from '@/state/comic/store';
import { useXyPlotDialog } from '@/state/dialogs/xyplot';
import { countsPicturesOf, invoke, showsInvokeButtonOf, useReadiness, type BuilderKey } from '@/state/invoke';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { useUi } from '@/state/ui';
import { chordLabel, cx, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, NumberInput, Spinner, Tooltip } from '@/ui';
import { CancelControls } from './CancelControls';
import './invoke.css';

/** `tab` is a tab, or the kind of media on the Generate tab (video, music, voice, logo); `label` replaces the word on the button. */
export function InvokeControls({ tab, label }: { tab: BuilderKey; label?: string }) {
  const reasons = useReadiness(tab);
  const ready = reasons.length === 0;
  const status = useQueue((s) => s.status);
  const progress = useQueue((s) => s.progress);
  const iterations = useParams((s) => s.iterations);
  const setParams = useParams((s) => s.set);
  // The comic screen draws the selected panel or the whole page, whichever its scope says.
  const drawScope = useComic((s) => s.drawScope);
  const imageGenerate = useUi((s) => tab === 'generate' && s.media === 'image');
  const queued = status.pending + status.inProgress;
  const running = status.inProgress > 0;
  const percent = progress ? Math.round((progress.step / progress.totalSteps) * 100) : null;

  const tooltip = ready ? (
    <span>
      {t('params.invoke.tooltip')} <span className="ib-kbd">{chordLabel('mod+enter')}</span>
    </span>
  ) : (
    <div className="ib-reasons">
      <strong>{t('params.invoke.cannotInvoke')}</strong>
      <ul>
        {reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );

  const scopes: { scope: DrawScope; label: string }[] = [
    { scope: 'panel', label: t('comic.panel.draw') },
    { scope: 'page', label: t('comic.page.drawAll') },
    { scope: 'comic', label: t('comic.comic.drawAll') },
  ];
  const invokeLabel = label ?? (tab === 'comic' ? scopes.find((s) => s.scope === drawScope)!.label : t('params.invoke.invoke'));
  // A screen that draws with its own buttons has no Invoke button, and shows the cancel controls only while work is queued.
  const showsInvoke = showsInvokeButtonOf(tab);
  return (
    <div className="ib" data-testid="invoke-bar">
      {showsInvoke && (
        <>
          <div className="ib__split">
            <Tooltip content={tooltip} side="bottom">
              <span className="ib__invoke-wrap">
                <button
                  type="button"
                  className={cx('ui-btn', 'ui-btn--invoke', 'ui-btn--solid', 'ui-btn--lg', 'ib__invoke', running && 'is-running')}
                  disabled={!ready}
                  data-testid="invoke-button"
                  onClick={() => void invoke()}
                >
                  {running ? <Spinner size={14} /> : <Lightning size={16} weight="fill" />}
                  <span className="ib__label">{running ? t('params.invoke.generating') : invokeLabel}</span>
                  {running && percent !== null && <span className="ib__percent">{percent}%</span>}
                  {queued > 0 && (
                    <span className="ib__count" aria-label={t('params.invoke.queued', { count: queued })}>
                      {queued}
                    </span>
                  )}
                </button>
              </span>
            </Tooltip>
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  className="ui-btn ui-btn--invoke ui-btn--solid ui-btn--lg ib__caret ib__caret--invoke"
                  aria-label={t('params.invoke.moreOptions')}
                  disabled={!ready}
                >
                  <CaretDown size={14} weight="bold" />
                </button>
              </MenuTrigger>
              <MenuContent align="end">
                {tab === 'comic' && (
                  <>
                    {scopes.map(({ scope, label }) => (
                      <MenuItem
                        key={scope}
                        icon={drawScope === scope ? <Check weight="bold" /> : <span aria-hidden="true" />}
                        onSelect={() => useComic.getState().setDrawScope(scope)}
                        data-testid={`comic-draw-scope-${scope}`}
                      >
                        {label}
                      </MenuItem>
                    ))}
                    <MenuSeparator />
                  </>
                )}
                <MenuItem icon={<Lightning />} shortcut={chordLabel('mod+enter')} onSelect={() => void invoke()}>
                  {t('params.invoke.addBack')}
                </MenuItem>
                <MenuItem icon={<Queue />} shortcut={chordLabel('mod+shift+enter')} onSelect={() => void invoke({ prepend: true })}>
                  {t('params.invoke.addFront')}
                </MenuItem>
                {imageGenerate && (
                  <MenuItem icon={<GridFour />} onSelect={() => useXyPlotDialog.getState().open()} data-testid="invoke-xyplot">
                    {t('xyplot.menu')}
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          </div>
          {countsPicturesOf(tab) && (
            <Tooltip content={t('params.invoke.iterationsInfo')} side="bottom">
              <span className="ib__iter">
                <span className="ib__iter-x" aria-hidden>
                  ×
                </span>
                <NumberInput
                  className="ib__iter-input"
                  value={iterations}
                  onChange={(v) => setParams({ iterations: Math.max(1, Math.round(v)) })}
                  min={1}
                  max={1000}
                  aria-label={t('params.invoke.iterations')}
                />
              </span>
            </Tooltip>
          )}
        </>
      )}
      {(showsInvoke || queued > 0) && <CancelControls />}
    </div>
  );
}
