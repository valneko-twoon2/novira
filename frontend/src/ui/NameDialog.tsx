// Small dialog asking for a name (save a preset as new, rename one).
import { useState } from 'react';
import { t } from '@/i18n';
import { Button, TextInput } from './controls';
import { Modal } from './overlays';

export function NameDialog({
  title,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const valid = name.trim().length > 0;
  const submit = () => {
    if (!valid) return;
    onSubmit(name.trim());
    onClose();
  };
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button scheme="accent" disabled={!valid} onClick={submit} data-testid="name-dialog-ok">
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextInput
          autoFocus
          value={name}
          maxLength={60}
          placeholder={t('presets.namePlaceholder')}
          aria-label={t('common.name')}
          data-testid="name-dialog-input"
          onChange={(e) => setName(e.target.value)}
        />
      </form>
    </Modal>
  );
}
