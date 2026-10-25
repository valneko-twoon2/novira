// Pure filtering and sorting for the model grid.
import type { BaseModel, ModelConfig } from '@/backend';
import { matchesCategory, type CategoryId } from './modelCategories';

export type SortKey = 'name' | 'size' | 'base' | 'type';
export type BaseFilter = BaseModel | 'all';

export interface ModelFilter {
  category: CategoryId;
  search: string;
  base: BaseFilter;
  sort: SortKey;
  favorites: string[];
}

export function filterModels(models: ModelConfig[], f: ModelFilter): ModelConfig[] {
  const q = f.search.trim().toLowerCase();
  const out = models.filter(
    (m) =>
      (f.category === 'favorites' ? f.favorites.includes(m.key) : matchesCategory(m.type, f.category)) &&
      (f.base === 'all' || m.base === f.base) &&
      (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.base.includes(q)),
  );
  const cmp: Record<SortKey, (a: ModelConfig, b: ModelConfig) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    size: (a, b) => b.size - a.size,
    base: (a, b) => a.base.localeCompare(b.base) || a.name.localeCompare(b.name),
    type: (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
  };
  return out.sort(cmp[f.sort]);
}
