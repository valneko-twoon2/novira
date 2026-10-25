// The Workflows tab's counterpart of the preset card above the Generate button on the other tabs: the open workflow's
// name under the caption "Library", opening the workflow library dialog. It is not a preset list: the library keeps its
// own dialog (LibraryModal).
import { CaretDown } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { cx } from '@/ui';
import './workflows.css';

export function WorkflowLibraryCard() {
  const name = useWorkflows((s) => s.meta.name);
  const touched = useWorkflows((s) => s.isTouched);
  const openModal = useUi((s) => s.openModal);
  return (
    <div className="wf-libcard">
      <button type="button" className="ui-preset__card" aria-label={t('workflows.library.button')} data-testid="wf-open-library" onClick={() => openModal('workflowLibrary')}>
        <span className="ui-preset__text">
          <span className="ui-preset__caption">{t('workflows.library.button')}</span>
          <span className={cx('ui-preset__name', !name && 'is-placeholder')} data-testid="wf-library-name">
            {name || t('workflows.untitled')}
          </span>
        </span>
        {touched && <span className="wf-dot" title={t('workflows.unsaved')} data-testid="wf-library-unsaved" />}
        <CaretDown size={12} />
      </button>
    </div>
  );
}
