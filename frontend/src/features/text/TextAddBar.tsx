// Adding layers: a text layer, or a speech bubble of one of the shapes. Sits in the canvas toolbar, next to what it adds to.
import type { ReactNode } from 'react';
import { ChatCircle, Plus, TextT } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useTextEditor } from '@/state/text/textEditor';
import { BUBBLE_SHAPES } from '@/state/text/textModel';
import { IconButton, Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui';
import { SHAPE_LABELS } from './LayerProperties';

/** A layer's icon with a small plus: the same flat icon buttons as undo and zoom beside them, named by the tooltip and the accessible name. */
function AddIcon({ children }: { children: ReactNode }) {
  return (
    <span className="tx-addicon" aria-hidden>
      {children}
      <Plus className="tx-addicon__plus" weight="bold" />
    </span>
  );
}

export function TextAddBar() {
  const addText = useTextEditor((s) => s.addText);
  const addBubble = useTextEditor((s) => s.addBubble);
  return (
    <>
      <IconButton label={t('text.add.text')} icon={<AddIcon><TextT weight="bold" /></AddIcon>} onClick={() => addText(t('text.defaultText'))} data-testid="text-add-text" />
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={t('text.add.bubble')} icon={<AddIcon><ChatCircle weight="bold" /></AddIcon>} data-testid="text-add-bubble" />
        </MenuTrigger>
        <MenuContent>
          {BUBBLE_SHAPES.map((shape) => (
            <MenuItem key={shape} onSelect={() => addBubble(shape, t('text.defaultBubble'))}>
              {t(SHAPE_LABELS[shape])}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </>
  );
}
