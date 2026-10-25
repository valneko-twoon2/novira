// Controls that act on their second press, for what cannot be undone (a delete): the first press arms the control and says so
// in its label, and the second press acts. Leaving the control disarms it, and so does closing its menu, since the menu
// item is only mounted while the menu is open. They take the place of a confirmation dialog, which would stop the flow.
import { useState, type ReactNode } from 'react';
import { Button, IconButton, type ButtonProps, type IconButtonProps } from './controls';
import { MenuItem, type MenuItemProps } from './overlays';

/** A menu item that acts on its second press. The first press keeps the menu open, so the second one can be made. */
export function PressAgainMenuItem({
  label,
  againLabel,
  onConfirm,
  ...item
}: Omit<MenuItemProps, 'children' | 'onSelect'> & { label: ReactNode; againLabel: ReactNode; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <MenuItem
      {...item}
      onSelect={(event) => {
        if (!armed) {
          event.preventDefault();
          setArmed(true);
          return;
        }
        onConfirm();
      }}
    >
      {armed ? againLabel : label}
    </MenuItem>
  );
}

/** A button that acts on its second press. Leaving it disarms it. */
export function PressAgainButton({ againLabel, onConfirm, children, ...button }: ButtonProps & { againLabel: ReactNode; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      {...button}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? againLabel : children}
    </Button>
  );
}

/** An icon button that acts on its second press: armed, its label says so and it is drawn solid. */
export function PressAgainIconButton({
  label,
  againLabel,
  onConfirm,
  ...button
}: Omit<IconButtonProps, 'label'> & { label: string; againLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <IconButton
      {...button}
      label={armed ? againLabel : label}
      variant={armed ? 'solid' : button.variant}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      onBlur={() => setArmed(false)}
    />
  );
}
