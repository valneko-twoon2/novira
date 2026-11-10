// The list of ready-made requests that opens above the chat box while it starts with "/" (see slashTemplates): one row
// per command under the heading of its feature. The arrow keys move the choice through all the groups; Enter or Tab takes it.
import { Lightning } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { t } from '@/i18n';
import { cx } from '@/ui';
import { groupTemplates, type SlashTemplate } from './slashTemplates';

export function SlashMenu({ items, active, onPick, onHover }: { items: SlashTemplate[]; active: number; onPick: (tpl: SlashTemplate) => void; onHover: (i: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Back at the first row, its group's heading comes into view with it.
    if (active === 0 && list.current) list.current.scrollTop = 0;
    else list.current?.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);
  return (
    <div className="agent-slash" data-testid="agent-slash">
      <div className="agent-slash__head">{t('agent.template.title')}</div>
      {items.length === 0 ? (
        <p className="agent-slash__empty">{t('agent.template.none')}</p>
      ) : (
        <div ref={list} className="agent-slash__list" role="listbox" aria-label={t('agent.template.title')} id="agent-slash-list">
          {groupTemplates(items).map((group) => (
            <div key={group.id} role="group" aria-labelledby={`agent-slash-group-${group.id}`}>
              <div className="agent-slash__group" id={`agent-slash-group-${group.id}`}>
                {t(group.name)}
              </div>
              {group.templates.map((tpl) => {
                const i = items.indexOf(tpl);
                return (
                  <div
                    key={tpl.id}
                    id={`agent-slash-${tpl.id}`}
                    role="option"
                    aria-selected={i === active}
                    className={cx('agent-slash__item', i === active && 'is-active')}
                    data-testid={`agent-slash-${tpl.id}`}
                    // The press must not take the focus from the box, so the typing goes on there.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick(tpl)}
                    onMouseEnter={() => onHover(i)}
                  >
                    <Lightning size={14} className="agent-slash__icon" />
                    <span className="agent-slash__label">{t(tpl.label)}</span>
                    <span className="agent-slash__cmd">/{tpl.id}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
