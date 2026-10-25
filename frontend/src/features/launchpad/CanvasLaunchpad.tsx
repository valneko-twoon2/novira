// Launchpad of the Canvas tab.
import { Eraser, ImageSquare, PencilSimpleLine, Shapes } from '@phosphor-icons/react';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useCanvas, type CanvasImportTarget } from '@/state/canvas';
import { useUi } from '@/state/ui';
import { LaunchpadCard, LaunchpadPage, Tip } from './LaunchpadCard';

function importTo(target: CanvasImportTarget) {
  return (img: ImageDTO) => {
    useCanvas.getState().importImage(img, target);
    useUi.getState().setMainView('canvas', 'canvas');
  };
}

export function CanvasLaunchpad() {
  const openCanvas = () => useUi.getState().setMainView('canvas', 'canvas');
  return (
    <LaunchpadPage
      title={t('params.launchpad.canvas.title')}
      tips={<Tip>{t('params.launchpad.tips.canvasDrop')}</Tip>}
    >
      <LaunchpadCard
        icon={<PencilSimpleLine />}
        title={t('params.launchpad.canvas.drawTitle')}
        onClick={openCanvas}
        testId="lp-draw"
      />
      <LaunchpadCard
        icon={<ImageSquare />}
        title={t('params.launchpad.canvas.imageTitle')}
        description={t('params.launchpad.canvas.imageDesc')}
        onClick={openCanvas}
        onImage={importTo('newCanvasRaster')}
      />
      <LaunchpadCard
        icon={<Shapes />}
        title={t('params.launchpad.canvas.controlTitle')}
        description={t('params.launchpad.canvas.controlDesc')}
        onClick={openCanvas}
        onImage={importTo('newCanvasControl')}
      />
      <LaunchpadCard
        icon={<Eraser />}
        title={t('params.launchpad.canvas.inpaintTitle')}
        description={t('params.launchpad.canvas.inpaintDesc')}
        onClick={openCanvas}
        onImage={importTo('inpaint')}
      />
    </LaunchpadPage>
  );
}
