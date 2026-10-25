// "Add node" dialog, laid out like the extension and model managers: a rail on the left (all, the built-in categories,
// ComfyUI's own nodes by group, each installed extension), a search box above a list of nodes, and the node under the cursor highlighted. It opens from
// the editor's shortcut (Shift+A, Space) and when a connection is dropped on empty space (then only the nodes
// that can be connected are listed).
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { t } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { Modal, TextInput, cx } from '@/ui';
import { useComfyWords } from './comfyWords';
import { typeColorVar } from './fieldTypes';
import { groupLabel, matchingTemplates, scopeOf, type PickerFilter } from './nodeCatalog';
import { NODE_CATEGORIES, nodeDesc, nodeTitle, type NodeTemplate } from './templates';

export type { PickerFilter };

const ALL = '*';

interface Scope {
  id: string;
  label: string;
  count: number;
}

/** The rail: how many of `list` each built-in category, each group of ComfyUI's own nodes and each extension holds (empty ones are left out). */
function railScopes(list: NodeTemplate[]): { builtin: Scope[]; core: Scope[]; packs: Scope[] } {
  const byScope = new Map<string, Scope>();
  for (const tpl of list) {
    const id = scopeOf(tpl);
    // The rail already sits under the ComfyUI heading, so a group is named by its own part.
    const entry = byScope.get(id) ?? { id, label: tpl.group ?? groupLabel(tpl), count: 0 };
    entry.count++;
    byScope.set(id, entry);
  }
  const all = [...byScope.values()];
  const rank = (s: Scope) => NODE_CATEGORIES.indexOf(s.id.slice(4) as NodeTemplate['category']);
  const byLabel = (a: Scope, b: Scope) => a.label.localeCompare(b.label);
  return {
    builtin: all.filter((s) => s.id.startsWith('cat:')).sort((a, b) => rank(a) - rank(b)),
    core: all.filter((s) => s.id.startsWith('core:')).sort(byLabel),
    packs: all.filter((s) => s.id.startsWith('pack:')).sort(byLabel),
  };
}

function RailItem({ count, label, active, onPick }: { count: number; label: string; active: boolean; onPick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={cx('ex-rail__item', active && 'is-active')} data-testid="wf-picker-scope" onClick={onPick}>
      <span className="ex-rail__label">{label}</span>
      <span className="ex-rail__count">{count}</span>
    </button>
  );
}

export function NodePicker({ filter, onPick, onClose }: { filter: PickerFilter | null; onPick: (template: NodeTemplate) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [scope, setScope] = useState<string>(ALL);
  const listRef = useRef<HTMLDivElement>(null);

  // Re-render (and re-list) when the nodes of custom node packs arrive.
  useComfyNodes((s) => s.defs);
  useComfyWords();
  const matching = matchingTemplates(query, filter);
  const rail = railScopes(matching);
  // A scope with nothing left (after a search) falls back to everything.
  const current = [...rail.builtin, ...rail.core, ...rail.packs].some((s) => s.id === scope) ? scope : ALL;
  const items = current === ALL ? matching : matching.filter((tpl) => scopeOf(tpl) === current);
  const choose = (id: string) => {
    setScope(id);
    setActive(0);
  };

  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  let lastGroup: string | null = null;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={t('workflows.picker.title')} size="xl" closeLabel={t('common.close')}>
      <div className="wf-picker" data-testid="wf-node-picker">
        <nav className="ex-rail wf-picker__rail" role="tablist" aria-label={t('workflows.picker.scopes')} data-testid="wf-picker-scopes">
          <RailItem count={matching.length} label={t('workflows.picker.all')} active={current === ALL} onPick={() => choose(ALL)} />
          {rail.builtin.length > 0 && <div className="ex-rail__group">{t('workflows.picker.builtin')}</div>}
          {rail.builtin.map((s) => (
            <RailItem key={s.id} count={s.count} label={s.label} active={current === s.id} onPick={() => choose(s.id)} />
          ))}
          {rail.core.length > 0 && <div className="ex-rail__group">{t('workflows.picker.core')}</div>}
          {rail.core.map((s) => (
            <RailItem key={s.id} count={s.count} label={s.label} active={current === s.id} onPick={() => choose(s.id)} />
          ))}
          {rail.packs.length > 0 && <div className="ex-rail__group">{t('workflows.picker.extensions')}</div>}
          {rail.packs.map((s) => (
            <RailItem key={s.id} count={s.count} label={s.label} active={current === s.id} onPick={() => choose(s.id)} />
          ))}
        </nav>
        <div className="wf-picker__main">
          <TextInput
            autoFocus
            value={query}
            placeholder={t('workflows.picker.placeholder')}
            aria-label={t('workflows.picker.placeholder')}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                const tpl = items[active];
                if (tpl) onPick(tpl);
              }
            }}
          />
          {filter && (
            <div className="wf-picker__filter">
              <span className="wf-typetip__swatch" style={{ '--wf-handle-color': typeColorVar(filter.type) } as CSSProperties} />
              {t('workflows.picker.compatibleWith', { type: filter.type })}
            </div>
          )}
          <div className="wf-picker__list" ref={listRef}>
            {items.length === 0 && <div className="wf-picker__empty">{t('workflows.picker.noResults')}</div>}
            {items.map((tpl, i) => {
              const group = scopeOf(tpl);
              const header = group !== lastGroup ? groupLabel(tpl) : null;
              lastGroup = group;
              return (
                <div key={tpl.type}>
                  {header && current === ALL && <div className="wf-picker__group">{header}</div>}
                  <button type="button" className={cx('wf-picker__item', i === active && 'is-active')} onMouseEnter={() => setActive(i)} onClick={() => onPick(tpl)}>
                    <span className="wf-picker__name">{nodeTitle(tpl.type)}</span>
                    <span className="wf-picker__desc">{nodeDesc(tpl.type)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
