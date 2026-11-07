// Board list used by the "Change board" submenus.
import { Check } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { boardLabel, boardTree } from '@/state/boardTree';
import { useGallery, type BoardId } from '@/state/gallery';
import { ContextMenuItem } from '@/ui';

export function BoardMenuItems({ current, onPick }: { current: BoardId | null; onPick: (id: BoardId) => void }) {
  const boards = useGallery((s) => s.boards);
  const items: { id: BoardId; name: string }[] = [
    { id: 'none', name: t('gallery.boards.uncategorized') },
    ...boardTree(boards, (b) => !b.archived).map(({ board }) => ({ id: board.id, name: boardLabel(boards, board) })),
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
