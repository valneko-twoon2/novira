// Board list used by the "Change board" submenus.
import { Check } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useGallery, type BoardId } from '@/state/gallery';
import { ContextMenuItem } from '@/ui';

export function BoardMenuItems({ current, onPick }: { current: BoardId | null; onPick: (id: BoardId) => void }) {
  const boards = useGallery((s) => s.boards);
  const items: { id: BoardId; name: string }[] = [
    { id: 'none', name: t('gallery.boards.uncategorized') },
    ...boards.filter((b) => !b.archived).map((b) => ({ id: b.id, name: b.name })),
  ];
  return (
    <>
      {items.map((b) => (
        <ContextMenuItem key={b.id} icon={b.id === current ? <Check /> : undefined} disabled={b.id === current} onSelect={() => onPick(b.id)}>
          {b.name}
        </ContextMenuItem>
      ))}
    </>
  );
}
