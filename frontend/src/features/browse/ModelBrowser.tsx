// Online model search (Civitai-style). Downloads go through the normal install pipeline.
import { MagnifyingGlass, Warning } from '@phosphor-icons/react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { Button, EmptyState } from '@/ui';
import { BrowseBar } from './BrowseBar';
import { useBrowse } from './browseStore';
import './browse.css';
import { DetailDrawer } from './DetailDrawer';
import { DownloadDock } from './DownloadDock';
import { HuggingFaceBrowse } from './HuggingFaceBrowse';
import { ModelCard } from './ModelCard';
import { useCivitaiSearch } from './useCivitaiSearch';
import { useDebounced } from './useDebounced';

const SKELETON_COUNT = 10;

export function ModelBrowser() {
  const { source, kind, baseModel, sort, period, includeNsfw, licenses, checkpointType, safetensorsOnly, creator, price, query, selected, cardSize, setFilter, select } = useBrowse();
  const [queryInput, setQueryInput] = useState(query);
  const debounced = useDebounced(queryInput, 300);
  useEffect(() => setFilter('query', debounced), [debounced, setFilter]);

  const hf = source === 'huggingface';
  // Hugging Face is opened by address (see HuggingFaceBrowse), so the paged search runs for Civitai only.
  const { items, status, error, loadingMore, hasMore, loadMore, retry } = useCivitaiSearch({ source: 'civitai', query, kind, baseModel, sort, period, includeNsfw, licenses, checkpointType: kind === 'Checkpoint' || kind === 'all' ? checkpointType : '', safetensorsOnly, creator, price }, !hf);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loadingMore) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMore, items.length]);

  return (
    <div className="browse" data-testid="browse">
      <BrowseBar queryInput={queryInput} onQueryInput={setQueryInput} />
      {hf ? (
        <div className="browse-scroll">
          <HuggingFaceBrowse />
        </div>
      ) : (
      <div className="browse-scroll">
        {status === 'error' ? (
          <EmptyState icon={<Warning size={28} />} title={t('browse.status.error')} description={error}>
            <Button size="sm" onClick={retry}>
              {t('browse.status.retry')}
            </Button>
          </EmptyState>
        ) : status === 'ready' && items.length === 0 ? (
          <EmptyState icon={<MagnifyingGlass size={28} />} title={t('browse.status.empty')} description={t('browse.status.emptyHint')} />
        ) : (
          <div className="browse-grid" style={{ '--browse-card': `${cardSize}px` } as CSSProperties}>
            {status === 'loading'
              ? Array.from({ length: SKELETON_COUNT }, (_, i) => <div key={i} className="browse-card browse-card--skeleton browse-skeleton" aria-hidden="true" />)
              : items.map((m) => <ModelCard key={m.id} model={m} onOpen={() => select(m)} />)}
            {loadingMore && Array.from({ length: 5 }, (_, i) => <div key={`more-${i}`} className="browse-card browse-card--skeleton browse-skeleton" aria-hidden="true" />)}
          </div>
        )}
        {hasMore && (
          <div ref={sentinel} className="browse-more">
            <Button size="sm" onClick={loadMore} disabled={loadingMore}>
              {t('browse.status.loadMore')}
            </Button>
          </div>
        )}
        {status === 'ready' && !hasMore && items.length > 0 && <div className="browse-end">{t('browse.status.end')}</div>}
      </div>
      )}
      {selected && <DetailDrawer key={selected.id} model={selected} onClose={() => select(null)} />}
      <DownloadDock />
    </div>
  );
}
