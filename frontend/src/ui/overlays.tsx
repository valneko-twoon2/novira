// Overlay components: select, menus, context menus, popovers, modals, tabs, collapsible sections.
import * as RadixContextMenu from '@radix-ui/react-context-menu';
import * as RadixDialog from '@radix-ui/react-dialog';
import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import * as RadixPopover from '@radix-ui/react-popover';
import * as RadixSelect from '@radix-ui/react-select';
import * as RadixTabs from '@radix-ui/react-tabs';
import { CaretDown, CaretRight, Check, X } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { isPhoneLayout } from '@/state/layout';
import { cx } from './controls';

// Select -------------------------------------------------------------------

export interface SelectOption<V extends string = string> {
  value: V;
  label: ReactNode;
  group?: string;
  disabled?: boolean;
  description?: ReactNode;
  /** Leading visual (e.g. a thumbnail) shown in the dropdown list. */
  icon?: ReactNode;
}

const NONE = '__none__';

export function Select<V extends string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: {
  value: V | null;
  onChange: (v: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}) {
  const groups = new Map<string, SelectOption<V>[]>();
  for (const o of options) {
    const g = o.group ?? '';
    groups.set(g, [...(groups.get(g) ?? []), o]);
  }
  // The list exists only while it is open: a screen holds dozens of selects, and Radix otherwise renders every closed
  // list off screen (and again once its trigger is attached), which made each screen switch slower. The trigger shows
  // the chosen label itself, so it needs no list.
  const [open, setOpen] = useState(false);
  return (
    <RadixSelect.Root open={open} onOpenChange={setOpen} value={value ?? NONE} onValueChange={(v) => v !== NONE && onChange(v as V)} disabled={disabled}>
      <RadixSelect.Trigger className={cx('ui-select', className)} aria-label={ariaLabel} data-testid={testId}>
        <span className="ui-select__value">
          <RadixSelect.Value placeholder={placeholder}>
            {value === null ? <span className="ui-select__placeholder">{placeholder}</span> : options.find((o) => o.value === value)?.label}
          </RadixSelect.Value>
        </span>
        <RadixSelect.Icon>
          <CaretDown size={12} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      {open && (
        <RadixSelect.Portal>
          <RadixSelect.Content className="ui-menu ui-select__content" position="popper" sideOffset={4}>
            <RadixSelect.Viewport>
              {value === null && <RadixSelect.Item value={NONE} className="ui-hidden" />}
              {[...groups.entries()].map(([group, opts]) => (
                <RadixSelect.Group key={group}>
                  {group && <RadixSelect.Label className="ui-menu__label">{group}</RadixSelect.Label>}
                  {opts.map((o) => (
                    <RadixSelect.Item key={o.value} value={o.value} disabled={o.disabled} className="ui-menu__item">
                      {o.icon}
                      <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                      {o.description && <span className="ui-menu__desc">{o.description}</span>}
                      <RadixSelect.ItemIndicator className="ui-menu__check">
                        <Check size={12} />
                      </RadixSelect.ItemIndicator>
                    </RadixSelect.Item>
                  ))}
                </RadixSelect.Group>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      )}
    </RadixSelect.Root>
  );
}

// Dropdown menu -----------------------------------------------------------

export const Menu = RadixMenu.Root;
export const MenuTrigger = RadixMenu.Trigger;

export function MenuContent({ children, align = 'start', side = 'bottom' }: { children: ReactNode; align?: 'start' | 'center' | 'end'; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content className="ui-menu" align={align} side={side} sideOffset={4}>
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

export interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  /** Gets the event of the selection: calling its preventDefault keeps the menu open. */
  onSelect?: (event: Event) => void;
  disabled?: boolean;
  danger?: boolean;
  shortcut?: ReactNode;
}

export function MenuItem({ icon, children, onSelect, disabled, danger, shortcut }: MenuItemProps) {
  return (
    <RadixMenu.Item className={cx('ui-menu__item', danger && 'is-danger')} onSelect={onSelect} disabled={disabled}>
      <span className="ui-menu__icon">{icon}</span>
      <span className="ui-menu__text">{children}</span>
      {shortcut && <span className="ui-menu__shortcut">{shortcut}</span>}
    </RadixMenu.Item>
  );
}

export function MenuCheckItem({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <RadixMenu.CheckboxItem className="ui-menu__item" checked={checked} onCheckedChange={onChange} onSelect={(e) => e.preventDefault()}>
      <span className="ui-menu__icon">{checked && <Check size={12} />}</span>
      <span className="ui-menu__text">{children}</span>
    </RadixMenu.CheckboxItem>
  );
}

export function MenuSeparator() {
  return <RadixMenu.Separator className="ui-menu__sep" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <RadixMenu.Label className="ui-menu__label">{children}</RadixMenu.Label>;
}

// Context menu -------------------------------------------------------------

export const ContextMenu = RadixContextMenu.Root;
export const ContextMenuTrigger = RadixContextMenu.Trigger;

export function ContextMenuContent({ children }: { children: ReactNode }) {
  return (
    <RadixContextMenu.Portal>
      <RadixContextMenu.Content className="ui-menu">{children}</RadixContextMenu.Content>
    </RadixContextMenu.Portal>
  );
}

export function ContextMenuItem({ icon, children, onSelect, disabled, danger, shortcut }: MenuItemProps) {
  return (
    <RadixContextMenu.Item className={cx('ui-menu__item', danger && 'is-danger')} onSelect={onSelect} disabled={disabled}>
      <span className="ui-menu__icon">{icon}</span>
      <span className="ui-menu__text">{children}</span>
      {shortcut && <span className="ui-menu__shortcut">{shortcut}</span>}
    </RadixContextMenu.Item>
  );
}

export function ContextMenuSeparator() {
  return <RadixContextMenu.Separator className="ui-menu__sep" />;
}

export function ContextMenuLabel({ children }: { children: ReactNode }) {
  return <RadixContextMenu.Label className="ui-menu__label">{children}</RadixContextMenu.Label>;
}

export function ContextSubMenu({ icon, label, children }: { icon?: ReactNode; label: ReactNode; children: ReactNode }) {
  return (
    <RadixContextMenu.Sub>
      <RadixContextMenu.SubTrigger className="ui-menu__item">
        <span className="ui-menu__icon">{icon}</span>
        <span className="ui-menu__text">{label}</span>
        <CaretRight size={12} />
      </RadixContextMenu.SubTrigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.SubContent className="ui-menu" sideOffset={4}>
          {children}
        </RadixContextMenu.SubContent>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Sub>
  );
}

// Popover ------------------------------------------------------------------

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

/**
 * Opening a popover moves focus to its first control, often a search box. On a phone that raises the keyboard (and makes
 * iOS Safari zoom the page), so there focus stays put until the person taps a field.
 */
function keepKeyboardDown(e: Event) {
  if (isPhoneLayout()) e.preventDefault();
}

export function PopoverContent({
  children,
  side = 'bottom',
  align = 'center',
  className,
  onCloseAutoFocus,
  onEscapeKeyDown,
}: {
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
  /** Called before focus returns to the trigger on close; `preventDefault()` keeps focus where it is. */
  onCloseAutoFocus?: (e: Event) => void;
  /** Called when Escape is pressed inside it, before it closes; `stopPropagation()` keeps the key from reaching the window's hotkeys. */
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
}) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content className={cx('ui-popover', className)} side={side} align={align} sideOffset={6} collisionPadding={8} onOpenAutoFocus={keepKeyboardDown} onCloseAutoFocus={onCloseAutoFocus} onEscapeKeyDown={onEscapeKeyDown}>
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}

// Modal --------------------------------------------------------------------

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  footer,
  size = 'md',
  closeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeLabel: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ui-modal__overlay" />
        <RadixDialog.Content className={cx('ui-modal', `ui-modal--${size}`)} aria-describedby={undefined}>
          <div className="ui-modal__header">
            <RadixDialog.Title className="ui-modal__title">{title}</RadixDialog.Title>
            <RadixDialog.Close className="ui-btn ui-iconbtn ui-btn--base ui-btn--ghost ui-btn--sm" aria-label={closeLabel}>
              <X size={16} />
            </RadixDialog.Close>
          </div>
          <div className="ui-modal__body">{children}</div>
          {footer && <div className="ui-modal__footer">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

// Tabs ---------------------------------------------------------------------

export const Tabs = RadixTabs.Root;

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return <RadixTabs.List className={cx('ui-tabs__list', className)}>{children}</RadixTabs.List>;
}

export function Tab({ value, children, disabled }: { value: string; children: ReactNode; disabled?: boolean }) {
  return (
    <RadixTabs.Trigger value={value} className="ui-tabs__tab" disabled={disabled}>
      {children}
    </RadixTabs.Trigger>
  );
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <RadixTabs.Content value={value} className={cx('ui-tabs__panel', className)}>
      {children}
    </RadixTabs.Content>
  );
}

// Collapsible section (InvokeAI accordion) ---------------------------------

export function Section({
  title,
  badges,
  defaultOpen = true,
  children,
  actions,
}: {
  title: ReactNode;
  badges?: ReactNode[];
  defaultOpen?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cx('ui-section', open && 'is-open')}>
      <div className="ui-section__header">
        <button type="button" className="ui-section__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="ui-section__title">{title}</span>
          {badges?.filter(Boolean).map((b, i) => (
            <span key={i} className="ui-badge ui-badge--base">
              {b}
            </span>
          ))}
          <span className="ui-section__spacer" />
          <CaretDown size={14} className="ui-section__caret" />
        </button>
        {actions}
      </div>
      {open && <div className="ui-section__body">{children}</div>}
    </section>
  );
}
