// Searchable chooser: a trigger that opens a popover with a search box, a grouped list and an optional footer.
// The model / LoRA picker and the preset picker are built on it.
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { isPhoneLayout } from '@/state/layout';
import { TextInput, cx } from './controls';
import { Popover, PopoverContent, PopoverTrigger } from './overlays';

export interface PickerGroupDef {
  key: string;
  label: ReactNode;
}

export interface SearchPickerProps<T> {
  /** The element that opens the list (rendered as the popover trigger, so it must accept a ref). */
  trigger: ReactNode;
  items: T[];
  itemKey: (item: T) => string;
  /** Text the search matches against (case-insensitive). */
  textOf: (item: T) => string;
  /** Group of an item; items of groups missing from `groups` are not shown. Without it, one unlabelled list. */
  groupOf?: (item: T) => string;
  groups?: PickerGroupDef[];
  /** Group headings: always, or only when more than one group has items. */
  groupLabels?: 'always' | 'multiple';
  sort?: (a: T, b: T) => number;
  /** One row; `close` closes the popover. */
  renderItem: (item: T, close: () => void) => ReactNode;
  searchLabel: string;
  /** Shown when the list has no items at all. */
  emptyText: ReactNode;
  /** Shown when the search matches nothing. */
  noMatchText: ReactNode;
  /** Above the search box. */
  header?: ReactNode;
  footer?: (close: () => void) => ReactNode;
  className?: string;
  listTestId?: string;
}

export function SearchPicker<T>({
  trigger,
  items,
  itemKey,
  textOf,
  groupOf,
  groups,
  groupLabels = 'always',
  sort,
  renderItem,
  searchLabel,
  emptyText,
  noMatchText,
  header,
  footer,
  className,
  listTestId,
}: SearchPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const shownGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = items.filter((i) => !q || textOf(i).toLowerCase().includes(q));
    const sorted = (list: T[]) => (sort ? [...list].sort(sort) : list);
    if (!groupOf || !groups) return [{ key: '', label: null as ReactNode, items: sorted(shown) }].filter((g) => g.items.length > 0);
    return groups.map((g) => ({ ...g, items: sorted(shown.filter((i) => groupOf(i) === g.key)) })).filter((g) => g.items.length > 0);
  }, [items, query, textOf, groupOf, groups, sort]);
  const labelled = groupLabels === 'always' || shownGroups.length > 1;

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side="bottom" align="start" className={cx('pp-picker', className)}>
        {header}
        <label className="pp-picker__search">
          <MagnifyingGlass size={14} />
          <TextInput value={query} autoFocus={!isPhoneLayout()} placeholder={searchLabel} aria-label={searchLabel} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="pp-picker__list" data-testid={listTestId}>
          {shownGroups.length === 0 && <p className="pp-picker__empty">{items.length === 0 ? emptyText : noMatchText}</p>}
          {shownGroups.map((g) => (
            <section key={g.key}>
              {labelled && g.label && <h4 className="pp-picker__group">{g.label}</h4>}
              {g.items.map((item) => (
                <Fragment key={itemKey(item)}>{renderItem(item, close)}</Fragment>
              ))}
            </section>
          ))}
        </div>
        {footer && <footer className="pp-picker__foot">{footer(close)}</footer>}
      </PopoverContent>
    </Popover>
  );
}
