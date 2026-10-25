// Images of the selected board/view, derived once per relevant store change.
import { useMemo } from 'react';
import type { ImageDTO } from '@/backend';
import { dayCounts, type DayKey } from '@/state/dateFilter';
import { filterBoardImages, selectBoardImages, useGallery } from '@/state/gallery';

export function useBoardImages(): ImageDTO[] {
  const images = useGallery((s) => s.images);
  const selectedBoardId = useGallery((s) => s.selectedBoardId);
  const view = useGallery((s) => s.view);
  const search = useGallery((s) => s.search);
  const dateFilter = useGallery((s) => s.dateFilter);
  const settings = useGallery((s) => s.settings);
  return useMemo(
    () => selectBoardImages({ images, selectedBoardId, view, search, dateFilter, settings }),
    [images, selectedBoardId, view, search, dateFilter, settings],
  );
}

/** How many images of the selected board/view (search applied, date filter not) fall on each local day. */
export function useBoardDayCounts(): Map<DayKey, number> {
  const images = useGallery((s) => s.images);
  const selectedBoardId = useGallery((s) => s.selectedBoardId);
  const view = useGallery((s) => s.view);
  const search = useGallery((s) => s.search);
  return useMemo(() => dayCounts(filterBoardImages({ images, selectedBoardId, view, search })), [images, selectedBoardId, view, search]);
}

/** Image by name, re-rendering only when that image object changes. */
export function useImage(name: string | null): ImageDTO | undefined {
  return useGallery((s) => (name ? s.images.find((i) => i.name === name) : undefined));
}
