// What `/help` opens above the chat box: how the "/" commands work and, per feature, each command with the sentence it
// sends. It stays on the PC: nothing goes to the assistant.
import { X } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { IconButton } from '@/ui';
import { visibleGroups } from './slashTemplates';

export function SlashHelp({ onClose }: { onClose: () => void }) {
  return (
    // As in the list, a press here must not take the focus from the box: Escape and typing go on working there.
    <div className="agent-slash agent-slash--help" data-testid="agent-slash-help-panel" onMouseDown={(e) => e.preventDefault()}>
      <div className="agent-slash__head agent-slash__head--help">
        <span>{t('agent.template.help.title')}</span>
        <IconButton type="button" label={t('common.close')} icon={<X />} onClick={onClose} data-testid="agent-slash-help-close" />
      </div>
      <div className="agent-slash__list">
        <p className="agent-slash__usage">{t('agent.template.help.usage')}</p>
        {visibleGroups().map((group) => (
          <section key={group.id}>
            <div className="agent-slash__group">{t(group.name)}</div>
            {group.templates.map((tpl) => (
              <div key={tpl.id} className="agent-slash__help-row">
                <span className="agent-slash__cmd">/{tpl.id}</span>
                <span className="agent-slash__help-main">
                  <span className="agent-slash__label">{t(tpl.label)}</span>
                  {tpl.text && <span className="agent-slash__text">{t(tpl.text)}</span>}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
