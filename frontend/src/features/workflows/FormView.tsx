// Linear view: node fields exposed to the form, rendered as controls bound to the node values.
import { ArrowDown, ArrowUp, PencilSimple, Trash, TreeStructure } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useWorkflows, type FormField } from '@/state/workflows/workflows';
import { EmptyState, IconButton, cx } from '@/ui';
import { FieldControl } from './FieldControl';
import { isInputConnected } from './graph';
import { nodeTitle } from './invokeBuilder';
import { useComfyWords } from './comfyWords';
import { fieldLabel, getInput } from './templates';

export function FormView() {
  const form = useWorkflows((s) => s.form);
  const mode = useWorkflows((s) => s.mode);
  const setMode = useWorkflows((s) => s.setMode);
  const description = useWorkflows((s) => s.meta.description);
  return (
    <div className="wf-form" data-testid="wf-form">
      <div className="wf-form__bar">
        {description ? <div className="wf-form__desc">{description}</div> : <span />}
        <IconButton
          label={mode === 'edit' ? t('workflows.form.doneEditing') : t('workflows.form.editForm')}
          icon={<PencilSimple size={14} />}
          size="xs"
          isActive={mode === 'edit'}
          onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
        />
      </div>
      {form.length === 0 ? (
        <EmptyState icon={<TreeStructure size={28} />} title={t('workflows.form.emptyTitle')} description={t('workflows.form.emptyDesc')} />
      ) : (
        form.map((f, i) => <FormRow key={`${f.nodeId}.${f.fieldName}`} field={f} index={i} count={form.length} editing={mode === 'edit'} />)
      )}
    </div>
  );
}

function FormRow({ field, index, count, editing }: { field: FormField; index: number; count: number; editing: boolean }) {
  const node = useWorkflows((s) => s.nodes.find((n) => n.id === field.nodeId));
  const connected = useWorkflows((s) => isInputConnected(s.edges, field.nodeId, field.fieldName));
  const move = useWorkflows((s) => s.moveFormField);
  const remove = useWorkflows((s) => s.removeFormField);
  useComfyWords();
  const input = node ? getInput(node.data.type, field.fieldName) : undefined;
  if (!node || !input) return null;
  const label = fieldLabel(node.data.type, input.name);
  return (
    <div className={cx('wf-form__row', editing && 'is-editing')}>
      <div className="wf-form__head">
        <span className="wf-form__label">{label}</span>
        <span className="wf-form__node">{nodeTitle(node)}</span>
        <span className="wf-form__spacer" />
        <div className="wf-form__actions">
          <IconButton label={t('workflows.form.moveUp')} icon={<ArrowUp size={12} />} size="xs" disabled={index === 0} onClick={() => move(index, -1)} />
          <IconButton label={t('workflows.form.moveDown')} icon={<ArrowDown size={12} />} size="xs" disabled={index === count - 1} onClick={() => move(index, 1)} />
          <IconButton label={t('workflows.form.remove')} icon={<Trash size={12} />} size="xs" onClick={() => remove(field)} />
        </div>
      </div>
      {connected ? (
        <div className="wf-form__connected">{t('workflows.form.connected')}</div>
      ) : (
        <FieldControl nodeId={node.id} input={input} value={node.data.inputs[input.name]} label={label} />
      )}
    </div>
  );
}
