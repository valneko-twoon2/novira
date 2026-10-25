// Launchpad of the Generate tab.
import { ImageSquare, PaintBrush, Sparkle, TextT } from '@phosphor-icons/react';
import { addDefaultRefImage } from '@/features/params/refImages/RefImageList';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { useParams } from '@/state/params';
import { useUi } from '@/state/ui';
import { chordLabel, Kbd } from '@/ui';
import { LaunchpadCard, LaunchpadPage, Tip } from './LaunchpadCard';

export function GenerateLaunchpad() {
  const ui = useUi.getState;
  return (
    <LaunchpadPage
      title={t('params.launchpad.generate.title')}
      tips={
        <>
          <Tip>
            <Kbd>{chordLabel('mod+enter')}</Kbd> {t('params.launchpad.tips.invoke')}
          </Tip>
          <Tip>
            <Kbd>{chordLabel('alt+a')}</Kbd> {t('params.launchpad.tips.focusPrompt')}
          </Tip>
          <Tip>
            <code>{'{red|blue}'}</code> {t('params.launchpad.tips.dynamic')}
          </Tip>
        </>
      }
    >
      <LaunchpadCard
        icon={<TextT />}
        title={t('params.launchpad.generate.textTitle')}
        onClick={() => ui().focusPrompt()}
        testId="lp-text"
      />
      <LaunchpadCard
        icon={<Sparkle />}
        title={t('params.launchpad.generate.refTitle')}
        description={t('params.launchpad.generate.refDesc')}
        onClick={() => addDefaultRefImage()}
        onImage={(img) => {
          const id = addDefaultRefImage();
          useParams.getState().updateRefImage(id, { imageName: img.name, imageUrl: img.url });
        }}
        testId="lp-ref"
      />
      <LaunchpadCard
        icon={<ImageSquare />}
        title={t('params.launchpad.generate.startTitle')}
        description={t('params.launchpad.generate.startDesc')}
        onClick={() => {
          ui().setTab('canvas');
          ui().setMainView('canvas', 'launchpad');
        }}
        onImage={(img) => {
          useCanvas.getState().importImage(img, 'newCanvasRaster');
          ui().setTab('canvas');
          ui().setMainView('canvas', 'canvas');
        }}
      />
      <LaunchpadCard
        icon={<PaintBrush />}
        title={t('params.launchpad.generate.canvasTitle')}
        onClick={() => {
          ui().setTab('canvas');
          ui().setMainView('canvas', 'canvas');
        }}
      />
    </LaunchpadPage>
  );
}
