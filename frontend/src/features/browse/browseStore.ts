// Browse filters and the selected model; kept in a store so they survive tab switches.
import { create } from 'zustand';
import { isPhoneLayout } from '@/state/layout';
import type { CivitaiKind, CivitaiModel, CivitaiPeriod, CivitaiSort, ModelSource } from '@/backend';

export interface BrowseFilters {
  source: ModelSource;
  query: string;
  kind: CivitaiKind | 'all';
  baseModel: string;
  sort: CivitaiSort;
  period: CivitaiPeriod;
  includeNsfw: boolean;
  /** Permission keys the license must allow (Civitai). */
  licenses: string[];
  /** `Trained`, `Merge`, or empty for either (checkpoints, Civitai). */
  checkpointType: string;
  safetensorsOnly: boolean;
  creator: string;
  /** `free`, `paid`, or empty for either (Civitai). */
  price: string;
}

/** The narrowest and widest a card in the grid can be, in pixels. */
export const CARD_MIN = 100;
export const CARD_MAX = 300;

interface BrowseState extends BrowseFilters {
  /** The card width the grid aims for (the cards stretch to fill the row). */
  cardSize: number;
  setCardSize: (size: number) => void;
  selected: CivitaiModel | null;
  setFilter: <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => void;
  select: (model: CivitaiModel | null) => void;
}

export const useBrowse = create<BrowseState>()((set) => ({
  source: 'civitai',
  query: '',
  kind: 'LoRA',
  baseModel: 'all',
  sort: 'downloads',
  period: 'all',
  includeNsfw: false,
  licenses: [],
  checkpointType: '',
  safetensorsOnly: false,
  creator: '',
  price: '',
  cardSize: isPhoneLayout() ? 150 : 220,
  setCardSize: (cardSize) => set({ cardSize: Math.min(CARD_MAX, Math.max(CARD_MIN, cardSize)) }),
  selected: null,
  setFilter: (key, value) => set({ [key]: value } as Partial<BrowseState>),
  select: (selected) => set({ selected }),
}));
