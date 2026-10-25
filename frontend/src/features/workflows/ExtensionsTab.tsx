// Extension manager: a screen of its own, reachable from the side bar and the download dock at any time. Like the model
// manager it has a rail (state and purpose), a toolbar (search, sort), a grid of cards for every pack of the ComfyUI
// Registry plus the ones novira suggests and the ones found in ComfyUI, and a detail panel (author, licence, versions,
// install / remove). ComfyUI itself is the first card. Any GitHub address can be installed from the same screen.
import { ArrowClockwise, Check, DownloadSimple, PuzzlePiece, Sparkle } from '@phosphor-icons/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { buildItems, countFilters, filterItems, hasUpdate, sortItems, type ExtensionFilter, type ExtensionItem, type ExtensionSort } from '@/state/comfy/extensionList';
import { packKey, useNodePacks } from '@/state/comfy/nodePacks';
import { packDescKey } from '@/state/comfy/packCatalog';
import { PURPOSES, purposeKey } from '@/state/comfy/purposes';
import { useRegistry } from '@/state/comfy/registry';
import { Badge, Button, EmptyState, Select, TextInput, cx, type SelectOption } from '@/ui';
import { ComfyDetail, ExtensionDetail } from './ExtensionDetail';
import { AddByAddress } from './PacksView';
import './workflows.css';
import './extensions.css';

/** Cards drawn at first, and added each time the end of the list scrolls into view. */
const PAGE = 60;
const COMFY = '@comfyui';
/** The first results of a search that are handed to the assistant. */
const ASK_RESULTS = 8;

const RAIL_MIN = 160;
const RAIL_MAX = 480;
const RAIL_KEY = 'novira.extensions.railWidth';
const clampRail = (w: number) => Math.min(RAIL_MAX, Math.max(RAIL_MIN, w));

function loadRailWidth(): number {
  try {
    const v = Number(localStorage.getItem(RAIL_KEY));
    return v ? clampRail(v) : 200;
  } catch {
    return 200;
  }
}

/** The thin bar between the rail and the list: drag (or use the arrow keys) to make the rail wider or narrower. */
function RailHandle({ width, onChange }: { width: number; onChange: (w: number) => void }) {
  const save = (w: number) => {
    try {
      localStorage.setItem(RAIL_KEY, String(w));
    } catch {
      /* the width just is not remembered */
    }
  };
  return (
    <div
      className="ex-rail-handle"
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={RAIL_MIN}
      aria-valuemax={RAIL_MAX}
      aria-valuenow={width}
      aria-label={t('workflows.packs.mgr.railResize')}
      tabIndex={0}
      data-testid="ex-rail-handle"
      style={{ left: width - 3 }}
      onPointerDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const start = width;
        let last = start;
        const move = (m: PointerEvent) => {
          last = clampRail(start + m.clientX - startX);
          onChange(last);
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          save(last);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const w = clampRail(width + (e.key === 'ArrowRight' ? 16 : -16));
        onChange(w);
        save(w);
      }}
    />
  );
}

const describe = (i: ExtensionItem) => (i.catalog ? t(packDescKey(i.catalog.id)) : '');
const descOf = (i: ExtensionItem) => (i.catalog ? t(packDescKey(i.catalog.id)) : (i.registry?.description ?? t('workflows.packs.manage.custom')));

function RailItem({ id, label, count, active, onPick }: { id: string; label: string; count: number; active: boolean; onPick: () => void }) {
  return (
    <button type="button" className={cx('ex-rail__item', active && 'is-active')} aria-pressed={active} data-testid={`ex-cat-${id}`} onClick={onPick}>
      <span className="ex-rail__label">{label}</span>
      <span className="ex-rail__count">{count}</span>
    </button>
  );
}

function CardIcon({ src }: { src: string | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="ex-card__media">
      {src && !broken ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <PuzzlePiece size={28} />}
    </div>
  );
}

function InstalledBadge() {
  return (
    <Badge scheme="success">
      <Check size={10} weight="bold" /> {t('workflows.packs.installed')}
    </Badge>
  );
}

const ExtensionCard = memo(function ExtensionCard({ item, selected, onSelect }: { item: ExtensionItem; selected: boolean; onSelect: (folder: string) => void }) {
  const install = useNodePacks((s) => s.install);
  const job = useNodePacks((s) => (item.url ? s.jobs[packKey(item.url)] : undefined));
  const busy = job?.state === 'downloading' || job?.state === 'installing';
  const reg = item.registry;
  return (
    <li>
      <div
        className={cx('ex-card', selected && 'is-selected')}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={() => onSelect(item.folder)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelect(item.folder);
          }
        }}
        data-testid="extension-item"
      >
        <CardIcon src={reg?.icon ?? null} />
        <strong className="ex-card__name" title={item.folder}>
          {item.folder}
        </strong>
        <p className="ex-card__desc">{descOf(item)}</p>
        <div className="ex-card__meta">
          {(item.installed?.version ?? reg?.version) && <span>{item.installed?.version ?? reg?.version}</span>}
          {reg?.updated && <span>{reg.updated}</span>}
        </div>
        <span className="ex-card__author" data-testid="extension-card-author">
          {t('workflows.packs.mgr.author')}: {item.author ?? t('workflows.packs.mgr.authorUnknown')}
        </span>
        <div className="ex-card__foot">
          <span className="ex-card__count" title={t('workflows.packs.mgr.downloads')}>
            {reg && (
              <>
                <DownloadSimple size={13} /> {reg.downloads.toLocaleString()}
              </>
            )}
          </span>
          {item.installed ? (
            hasUpdate(item) && item.url ? (
              <Button
                size="xs"
                variant="solid"
                leftIcon={<ArrowClockwise size={12} />}
                isLoading={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void install(item.url!);
                }}
                data-testid="extension-card-update"
              >
                {t('workflows.packs.mgr.update')}
              </Button>
            ) : (
              <InstalledBadge />
            )
          ) : (
            item.url && (
              <Button
                size="xs"
                variant="solid"
                leftIcon={<DownloadSimple size={12} />}
                isLoading={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void install(item.url!);
                }}
                data-testid="extension-card-install"
              >
                {t('workflows.packs.install')}
              </Button>
            )
          )}
        </div>
      </div>
    </li>
  );
});

function ComfyCard({ version, selected, onSelect }: { version: string; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <div
        className={cx('ex-card', selected && 'is-selected')}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelect();
          }
        }}
        data-testid="comfy-version"
      >
        <CardIcon src={null} />
        <strong className="ex-card__name">{t('workflows.packs.version.comfyTitle')}</strong>
        <p className="ex-card__desc">{t('workflows.packs.mgr.comfyDesc')}</p>
        <div className="ex-card__meta">
          <span>{version}</span>
        </div>
        <div className="ex-card__foot">
          <span />
          <InstalledBadge />
        </div>
      </div>
    </li>
  );
}

export function ExtensionsTab() {
  const packs = useNodePacks((s) => s.packs);
  const error = useNodePacks((s) => s.error);
  const restarting = useNodePacks((s) => s.restarting);
  const load = useNodePacks((s) => s.load);
  const restart = useNodePacks((s) => s.restart);
  const registry = useRegistry((s) => s.nodes);
  const registryLoading = useRegistry((s) => s.loading);
  const registryError = useRegistry((s) => s.error);
  const loadRegistry = useRegistry((s) => s.load);
  const [filter, setFilter] = useState<ExtensionFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ExtensionSort>('downloads');
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const [railWidth, setRailWidth] = useState(loadRailWidth);
  useEffect(() => {
    void load();
    void loadRegistry();
  }, [load, loadRegistry]);
  useEffect(() => setVisible(PAGE), [filter, search, sort]);
  const end = useRef<HTMLDivElement>(null);

  const items = useMemo(() => buildItems(packs?.installed ?? [], registry ?? []), [packs?.installed, registry]);
  const shown = useMemo(() => sortItems(filterItems(items, filter, search, describe), sort), [items, filter, search, sort]);
  const open = items.find((i) => i.folder === openFolder) ?? null;
  const counts = useMemo(() => countFilters(items), [items]);
  const countOf = (f: ExtensionFilter) => counts[f] ?? 0;
  const toggle = useCallback((folder: string) => setOpenFolder((cur) => (cur === folder ? null : folder)), []);
  const comfyVersion = packs?.comfyVersion ?? null;
  const showComfy = !!comfyVersion && (filter === 'all' || filter === 'installed') && !search.trim();
  const more = shown.length > visible;
  useEffect(() => {
    const el = end.current;
    if (!more || !el || typeof IntersectionObserver === 'undefined') return;
    const watcher = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + PAGE);
    });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [more, visible]);
  const sortOptions: SelectOption<ExtensionSort>[] = (['downloads', 'stars', 'updated', 'name'] as const).map((k) => ({ value: k, label: t(`workflows.packs.mgr.sort.${k}`) }));

  return (
    <div className="ex" data-testid="extensions-tab" style={{ gridTemplateColumns: `${railWidth}px minmax(0, 1fr)` }}>
      <RailHandle width={railWidth} onChange={setRailWidth} />
      <nav className="ex-rail" aria-label={t('workflows.packs.mgr.title')}>
        <h2 className="ex-rail__title">{t('workflows.packs.mgr.title')}</h2>
        <RailItem id="all" label={t('workflows.packs.mgr.all')} count={countOf('all')} active={filter === 'all'} onPick={() => setFilter('all')} />
        <RailItem id="installed" label={t('workflows.packs.mgr.installed')} count={countOf('installed')} active={filter === 'installed'} onPick={() => setFilter('installed')} />
        <RailItem id="updatable" label={t('workflows.packs.mgr.updatable')} count={countOf('updatable')} active={filter === 'updatable'} onPick={() => setFilter('updatable')} />
        <RailItem id="notInstalled" label={t('workflows.packs.mgr.notInstalled')} count={countOf('notInstalled')} active={filter === 'notInstalled'} onPick={() => setFilter('notInstalled')} />
        <div className="ex-rail__group">{t('workflows.packs.mgr.goals')}</div>
        {PURPOSES.map((g) => (
          <RailItem key={g} id={g} label={t(purposeKey(g))} count={countOf(g)} active={filter === g} onPick={() => setFilter(g)} />
        ))}
      </nav>
      <div className="ex__main">
        <div className="ex-bar">
          <div className="ex-bar__search">
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('workflows.packs.mgr.search')} aria-label={t('workflows.packs.mgr.search')} data-testid="ex-search" />
          </div>
          <div className="ex-bar__select">
            <Select value={sort} onChange={setSort} options={sortOptions} aria-label={t('workflows.packs.mgr.sort.label')} />
          </div>
          <span className="ex-bar__count">{t('workflows.packs.mgr.count', { shown: shown.length, total: items.length })}</span>
          {search.trim() && shown.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Sparkle size={13} />}
              onClick={() => useAgent.getState().ask(t('agent.ask.results', { query: search.trim() }), shown.slice(0, ASK_RESULTS).map((i) => i.folder))}
              data-testid="ex-ask-results"
            >
              {t('agent.ask.resultsButton')}
            </Button>
          )}
        </div>
        <div className="ex-add">
          <strong className="wf-ext__name">{t('workflows.packs.mgr.addTitle')}</strong>
          <span className="wf-ext__note">{t('workflows.packs.mgr.addHint')}</span>
          <AddByAddress onInstalling={() => setFilter('all')} />
        </div>
        {packs && !packs.available && <p className="wf-packs__notice">{t('workflows.packs.unavailable')}</p>}
        {packs?.restartNeeded && (
          <div className="wf-packs__restart" data-testid="extensions-restart">
            <span>{t('workflows.packs.restartNeeded')}</span>
            <Button size="sm" variant="solid" leftIcon={<ArrowClockwise size={14} />} isLoading={restarting} onClick={() => void restart()}>
              {t('workflows.packs.restart')}
            </Button>
          </div>
        )}
        {error && <p className="wf-packs__error">{error}</p>}
        {registryError && (
          <div className="wf-packs__notice" data-testid="registry-failed">
            <span>{t('workflows.packs.mgr.registryFailed', { message: registryError })}</span>{' '}
            <Button size="xs" variant="outline" onClick={() => void loadRegistry(true)}>
              {t('workflows.packs.mgr.retry')}
            </Button>
          </div>
        )}
        {registryLoading && !registry && <p className="wf-ext__note ex-note">{t('workflows.packs.mgr.registryLoading')}</p>}
        <div className="ex__body">
          <div className="ex__scroll">
            {packs?.available === false ? null : !showComfy && shown.length === 0 ? (
              <EmptyState icon={<PuzzlePiece size={28} />} title={t('workflows.packs.mgr.empty')} />
            ) : (
              <>
                <ul className="ex-grid">
                  {showComfy && <ComfyCard version={comfyVersion} selected={openFolder === COMFY} onSelect={() => toggle(COMFY)} />}
                  {shown.slice(0, visible).map((i) => (
                    <ExtensionCard key={i.folder} item={i} selected={i.folder === openFolder} onSelect={toggle} />
                  ))}
                </ul>
                {more && <div ref={end} className="ex-sentinel" data-testid="ex-end" />}
              </>
            )}
          </div>
          {openFolder === COMFY && comfyVersion && <ComfyDetail version={comfyVersion} onClose={() => setOpenFolder(null)} />}
          {open && openFolder !== COMFY && <ExtensionDetail key={open.folder} item={open} onClose={() => setOpenFolder(null)} />}
        </div>
      </div>
    </div>
  );
}
