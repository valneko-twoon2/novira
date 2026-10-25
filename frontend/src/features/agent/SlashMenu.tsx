// The list of ready-made requests that opens above the chat box while it starts with "/" (see slashTemplates). Each row
// shows the command, its name and the start of its sentence; the arrow keys move the choice and Enter or Tab takes it.
import { Lightning } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { t } from '@/i18n';
import { cx } from '@/ui';
import type { SlashTemplate } from './slashTemplates';

export function SlashMenu({ items, active, onPick, onHover }: { items: SlashTemplate[]; active: number; onPick: (tpl: SlashTemplate) => void; onHover: (i: number) => void }) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);
  return (
    <div className="agent-slash" data-testid="agent-slash">
      <div className="agent-slash__head">{t('agent.template.title')}</div>
      {items.length === 0 ? (
        <p className="agent-slash__empty">{t('agent.template.none')}</p>
      ) : (
        <ul ref={list} className="agent-slash__list" role="listbox" aria-label={t('agent.template.title')} id="agent-slash-list">
          {items.map((tpl, i) => (
            <li
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
              <span className="agent-slash__main">
                <span className="agent-slash__label">{t(tpl.label)}</span>
                <span className="agent-slash__text">{t(tpl.text)}</span>
              </span>
              <span className="agent-slash__cmd">/{tpl.id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
