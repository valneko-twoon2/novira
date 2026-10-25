// "Back to default" in the page's toolbar: a menu of the parts that can be put back one by one (a panel's turn or shape, its
// picture's turn, size, place and mirroring) and an item that puts back all of them.
import { ArrowsCounterClockwise } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, TOOLBAR_BUTTON_SIZE } from '@/ui';

export interface ResetItem {
  id: string;
  label: string;
  run: () => void;
}

export function ResetMenu({ items, testId }: { items: ResetItem[]; testId: string }) {
  if (items.length === 0) return null;
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('comic.reset.title')} icon={<ArrowsCounterClockwise />} data-testid={testId} />
      </MenuTrigger>
      <MenuContent>
        {items.map((item) => (
          <MenuItem key={item.id} onSelect={item.run}>
            {item.label}
          </MenuItem>
        ))}
        {items.length > 1 && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={() => items.forEach((item) => item.run())}>{t('comic.reset.all')}</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

/** The menu items for a picture's view: the parts of it that can be put back. */
export function pictureResetItems(reset: (parts: ('rotation' | 'scale' | 'position' | 'flip')[]) => void): ResetItem[] {
  return [
    { id: 'image-rotation', label: t('comic.reset.imageRotation'), run: () => reset(['rotation']) },
    { id: 'image-scale', label: t('comic.reset.imageScale'), run: () => reset(['scale']) },
    { id: 'image-position', label: t('comic.reset.imagePosition'), run: () => reset(['position']) },
    { id: 'image-flip', label: t('comic.reset.imageFlip'), run: () => reset(['flip']) },
  ];
}
