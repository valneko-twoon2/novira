// The comic page's inpaint controls in its paint toolbar: the button that queues an inpaint of the generation box, and the
// staging bar of the page's store (the results waiting to be accepted into a new raster layer, kept, or discarded).
import { MagicWand } from '@phosphor-icons/react';
import { useState } from 'react';
import { StagingToolbar } from '@/features/canvas/overlays/StagingToolbar';
import { t } from '@/i18n';
import { IconButton, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { queuePageInpaint } from './pageInpaint';

export function PageInpaintBar({ pageId }: { pageId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <IconButton
        size={TOOLBAR_BUTTON_SIZE}
        label={t('comic.inpaint.run')}
        icon={<MagicWand />}
        scheme="invoke"
        variant="solid"
        disabled={busy}
        data-testid="comic-inpaint-run"
        onClick={() => {
          setBusy(true);
          void queuePageInpaint(pageId).finally(() => setBusy(false));
        }}
      />
      <StagingToolbar inline />
    </>
  );
}
