// Dialogs: confirm discarding unsaved changes, and "Save As" asking for a name.
import { useState } from 'react';
import { t } from '@/i18n';
import { useWorkflows } from '@/state/workflows/workflows';
import { Button, Field, Modal, TextInput } from '@/ui';
import { saveWorkflowAs } from './actions';
import { useDialogs } from './dialogs';
import { ImportNeedsPacks } from './ImportNeedsPacks';

export function WorkflowDialogs() {
  return (
    <>
      <ConfirmDiscardDialog />
      <SaveAsDialog />
      <ImportNeedsPacks />
    </>
  );
}

function ConfirmDiscardDialog() {
  const pending = useDialogs((s) => s.pending);
  const resolve = useDialogs((s) => s.resolve);
  return (
    <Modal
      open={!!pending}
      onOpenChange={(o) => !o && resolve(false)}
      title={t('workflows.confirm.title')}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={() => resolve(false)}>
            {t('common.cancel')}
          </Button>
          <Button scheme="danger" onClick={() => resolve(true)} data-testid="wf-confirm-discard">
            {t('workflows.confirm.discard')}
          </Button>
        </>
      }
    >
      <p className="wf-dialog__text">{t('workflows.confirm.message')}</p>
    </Modal>
  );
}

function SaveAsDialog() {
  const open = useDialogs((s) => s.saveAsOpen);
  const setOpen = useDialogs((s) => s.setSaveAsOpen);
  return open ? <SaveAsForm onClose={() => setOpen(false)} /> : null;
}

function SaveAsForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState(() => {
    const current = useWorkflows.getState().meta;
    return current.category === 'default' ? t('workflows.library.copyName', { name: current.name }) : current.name;
  });
  const submit = () => {
    void saveWorkflowAs(name);
    onClose();
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('workflows.saveAs.title')}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button scheme="accent" onClick={submit} disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Field label={t('workflows.details.name')} orientation="vertical">
        <TextInput
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && submit()}
          aria-label={t('workflows.details.name')}
          placeholder={t('workflows.untitled')}
        />
      </Field>
    </Modal>
  );
}
