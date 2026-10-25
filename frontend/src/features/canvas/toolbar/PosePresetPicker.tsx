// The ready-made poses of the pose tool: a button that opens a dialog with the groups and categories on the left and a
// card for each pose on the right (the layout of the extension manager), each card showing the OpenPose figure.
import { PersonSimpleTaiChi } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { ErrorBoundary, IconButton, Modal, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { PosePresetGallery } from './PosePresetGallery';

export function PosePresetPicker() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('canvas.pose.presets')} icon={<PersonSimpleTaiChi />} isActive={open} onClick={() => setOpen(true)} data-testid="canvas-pose-presets" />
      <Modal open={open} onOpenChange={setOpen} size="xl" title={t('canvas.pose.presets')} closeLabel={t('common.close')}>
        <ErrorBoundary area="pose presets" variant="panel">
          <PosePresetGallery onApplied={() => setOpen(false)} />
        </ErrorBoundary>
      </Modal>
    </>
  );
}
