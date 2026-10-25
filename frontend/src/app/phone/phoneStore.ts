// What the phone layout shows: which tab, and the picture open over it (a stored picture, or a job being drawn).
import { useMemo } from 'react';
import { create } from 'zustand';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { selectBoardImages, useGallery } from '@/state/gallery';

export const PHONE_TABS = ['generate', 'images', 'drafts', 'queue', 'models', 'browse'] as const;
export type PhoneTab = (typeof PHONE_TABS)[number];

/** The name of a tab, at its foot and in the title bar. */
const TAB_LABELS: Record<PhoneTab, () => string> = {
  generate: () => t('app.tabs.generate'),
  images: () => t('phone.gallery'),
  drafts: () => t('app.views.drafts'),
  queue: () => t('app.tabs.queue'),
  models: () => t('app.tabs.models'),
  browse: () => t('app.tabs.browse'),
};
export const tabLabel = (tab: PhoneTab) => TAB_LABELS[tab]();

/** The picture shown over the tabs, full screen. */
export type PhoneView = { kind: 'live'; itemId: number } | { kind: 'image'; name: string } | null;

interface PhoneState {
  tab: PhoneTab;
  view: PhoneView;
  setTab: (tab: PhoneTab) => void;
  show: (view: PhoneView) => void;
}

export const usePhone = create<PhoneState>()((set) => ({
  tab: 'generate',
  view: null,
  setTab: (tab) => set({ tab }),
  show: (view) => set({ view }),
}));

/**
 * The pictures of the selected board, in the gallery's order (starred first and the sort direction, as set on the
 * desktop). Always the images, without the desktop's search or date filter: the phone has neither.
 */
export function usePhoneImages(): ImageDTO[] {
  const images = useGallery((s) => s.images);
  const selectedBoardId = useGallery((s) => s.selectedBoardId);
  const settings = useGallery((s) => s.settings);
  return useMemo(() => selectBoardImages({ images, selectedBoardId, view: 'images', search: '', dateFilter: null, settings }), [images, selectedBoardId, settings]);
}
