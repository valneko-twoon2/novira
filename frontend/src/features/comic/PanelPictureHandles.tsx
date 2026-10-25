// The handles of the selected panel's picture. The outline can be dragged to move the picture, even when the picture lies
// wholly outside its panel (where nothing of it is left to press). The panel keeps priority: a press on the part inside the
// panel's shape carries the panel, and Alt takes the picture instead.
import type { ComponentProps } from 'react';
import { pageShapes } from '@/state/comic/layout';
import type { ComicPage } from '@/state/comic/document';
import { PictureHandles } from './PictureHandles';
import { useCarry } from './useCarry';

type Props = Omit<ComponentProps<typeof PictureHandles>, 'movable' | 'carry'> & { page: ComicPage; index: number };

export function PanelPictureHandles({ page, index, ...rest }: Props) {
  const handlers = useCarry(page.id, index);
  const shape = pageShapes(page)[index];
  return <PictureHandles {...rest} movable carry={shape ? { shape, handlers } : undefined} />;
}
