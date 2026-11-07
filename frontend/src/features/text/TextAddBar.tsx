// Adding layers: a text layer, or a speech bubble of one of the shapes. Sits in the canvas toolbar, next to what it adds to.
import { CaretDown, ChatCircle, TextT } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useTextEditor } from '@/state/text/textEditor';
import { BUBBLE_SHAPES } from '@/state/text/textModel';
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui';
import { SHAPE_LABELS } from './LayerProperties';

export function TextAddBar() {
  const addText = useTextEditor((s) => s.addText);
  const addBubble = useTextEditor((s) => s.addBubble);
  return (
    <>
      <Button size="sm" leftIcon={<TextT weight="bold" />} onClick={() => addText(t('text.defaultText'))} data-testid="text-add-text">
        {t('text.add.text')}
      </Button>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" leftIcon={<ChatCircle weight="bold" />} rightIcon={<CaretDown size={12} />} data-testid="text-add-bubble">
            {t('text.add.bubble')}
          </Button>
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
