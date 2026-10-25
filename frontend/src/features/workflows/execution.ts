// Live execution state of workflow queue items, read by nodes and edges.
import { useGallery } from '@/state/gallery';
import { useQueue } from '@/state/queue';

export function useWorkflowExecution() {
  const item = useQueue((s) => s.items.find((i) => i.status === 'in_progress' && i.origin === 'workflows') ?? null);
  const progress = useQueue((s) => s.progress);
  return { executing: !!item, progress: item && progress?.itemId === item.id ? progress : null };
}

/** Image URL of the most recent completed workflow run. */
export function useLastWorkflowImageUrl(): string | null {
  const name = useQueue((s) => {
    for (let i = s.items.length - 1; i >= 0; i--) {
      const it = s.items[i];
      if (it && it.origin === 'workflows' && it.status === 'completed' && it.imageName) return it.imageName;
    }
    return null;
  });
  return useGallery((s) => (name ? (s.images.find((i) => i.name === name)?.thumbnailUrl ?? null) : null));
}
