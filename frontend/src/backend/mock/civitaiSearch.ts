// Pure filtering, sorting and cursor pagination over the Browse fixture.
import type { CivitaiModel, CivitaiPeriod, CivitaiSearchParams, CivitaiSearchResult } from '../types';
import { isPaid } from '../paid';
import { CIVITAI_MODELS, CIVITAI_NOW } from './civitaiData';

export const CIVITAI_PAGE_SIZE = 20;
const SDXL_COMPAT = new Set(['SDXL 1.0', 'Illustrious', 'NoobAI', 'Pony']);
const PERIOD_DAYS: Record<CivitaiPeriod, number> = { all: Infinity, year: 365, month: 30, week: 7, day: 1 };

/** Hugging Face stand-ins: the same fixtures as `owner/repo` models with one file at a path, without sizes or ratings. */
export const HUGGINGFACE_MODELS: CivitaiModel[] = CIVITAI_MODELS.slice(0, 18).map((m, i) => {
  const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const repo = `${m.creator.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'someone'}/${slug}`;
  return {
    ...m,
    id: repo,
    source: 'huggingface' as const,
    rating: 0,
    ratingCount: 0,
    imageCount: i % 3 === 0 ? 0 : m.imageCount,
    imageUrls: undefined,
    versions: [{ ...m.versions[0]!, id: 'main', name: 'main', files: [{ id: `${slug}.safetensors`, name: `${slug}.safetensors`, sizeBytes: 0, format: 'SafeTensor' as const, precision: 'fp16' as const }] }],
  };
});

export function searchCivitaiModels(params: CivitaiSearchParams, models: CivitaiModel[] = CIVITAI_MODELS): CivitaiSearchResult {
  const q = params.query.trim().toLowerCase();
  const since = CIVITAI_NOW - PERIOD_DAYS[params.period] * 86_400_000;
  const items = models
    .filter((m) => params.kind === 'all' || m.kind === params.kind)
    .filter((m) => params.baseModel === 'all' || (params.baseModel === 'sdxl-compat' ? SDXL_COMPAT.has(m.baseModel) : m.baseModel === params.baseModel))
    .filter((m) => params.includeNsfw || !m.nsfw)
    .filter((m) => params.source === 'huggingface' || m.createdAt >= since)
    .filter((m) => (params.licenses ?? []).every((k) => (m.permissions ?? []).some((p) => p.key === k && p.allowed === true)))
    .filter((m) => !params.safetensorsOnly || m.versions[0]?.files.some((f) => f.format === 'SafeTensor'))
    .filter((m) => !params.price || (params.price === 'paid') === isPaid(m.versions[0], CIVITAI_NOW))
    .filter((m) => !params.creator?.trim() || m.creator.toLowerCase() === params.creator.trim().toLowerCase())
    .filter((m) => !q || `${m.name} ${m.creator} ${m.tags.join(' ')} ${m.triggerWords.join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const key = params.sort === 'downloads' ? b.downloads - a.downloads : params.sort === 'rating' ? b.rating - a.rating || b.ratingCount - a.ratingCount : b.createdAt - a.createdAt;
      return key || a.id.localeCompare(b.id);
    });
  const start = Math.max(0, Number(params.cursor ?? 0) || 0);
  const end = start + CIVITAI_PAGE_SIZE;
  return { items: items.slice(start, end), nextCursor: end < items.length ? String(end) : null };
}
