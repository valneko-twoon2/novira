// Launchpad of the Generate tab.
import { ImageSquare, PaintBrush, Sparkle, TextT } from '@phosphor-icons/react';
import { useRef } from 'react';
import type { ImageDTO } from '@/backend';
import { optimalDimension } from '@/features/params/labels';
import { useMainModel } from '@/features/params/model/useMainModel';
import { addDefaultRefImage } from '@/features/params/refImages/RefImageList';
import { uploadFirst } from '@/features/params/refImages/useImageDrop';
import { t } from '@/i18n';
import { useParams } from '@/state/params';
import { useUi } from '@/state/ui';
import { chordLabel, Kbd } from '@/ui';
import { LaunchpadCard, LaunchpadPage, Tip } from './LaunchpadCard';

export function GenerateLaunchpad() {
  const ui = useUi.getState;
  const file = useRef<HTMLInputElement>(null);
  // A picture to start from goes to the image to image section of this tab, sized to its shape.
  const base = optimalDimension(useMainModel()?.base);
  const drawOver = (img: ImageDTO | null | undefined) => {
    if (img) useParams.getState().setInitImage(img, base);
  };
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
        onClick={() => file.current?.click()}
        onImage={drawOver}
        testId="lp-start"
      />
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        data-testid="lp-start-file"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          void uploadFirst(files).then(drawOver);
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
