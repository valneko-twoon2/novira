// Launchpad of the Upscaling tab: drop the image to upscale, tips, missing model hints.
import { ArrowsOut, Cube, Sliders, Warning } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { modelsOfType, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useUi } from '@/state/ui';
import { Button } from '@/ui';
import { LaunchpadCard, LaunchpadPage, Tip } from './LaunchpadCard';

export function UpscalingLaunchpad() {
  const image = useParams((s) => s.upscale.initialImage);
  const setUpscale = useParams((s) => s.setUpscale);
  const hasUpscaler = useModels((s) => modelsOfType(s.models, 'spandrel_image_to_image').length > 0);
  return (
    <LaunchpadPage
      title={t('params.launchpad.upscaling.title')}
      tips={
        <>
          <Tip>{t('params.launchpad.tips.creativity')}</Tip>
          <Tip>{t('params.launchpad.tips.structure')}</Tip>
          <Tip>{t('params.launchpad.tips.upscaleSize')}</Tip>
        </>
      }
    >
      <LaunchpadCard
        icon={image ? <img className="lp-card__thumb" src={image.thumbnailUrl} alt="" /> : <ArrowsOut />}
        title={image ? t('params.launchpad.upscaling.readyTitle', { width: image.width, height: image.height }) : t('params.launchpad.upscaling.dropTitle')}
        onImage={(img) => setUpscale({ initialImage: img })}
        testId="lp-upscale-drop"
      />
      <LaunchpadCard
        icon={<Sliders />}
        title={t('params.launchpad.upscaling.settingsTitle')}
        onClick={() => useUi.getState().setLeftPanelOpen(true)}
      />
      <LaunchpadCard
        icon={<Cube />}
        title={t('params.launchpad.upscaling.modelsTitle')}
        description={t('params.launchpad.upscaling.modelsDesc')}
        onClick={() => useUi.getState().setTab('models')}
      />
      {!hasUpscaler && (
        <div className="lp-warning" role="alert">
          <Warning size={16} weight="fill" />
          <span>{t('params.upscale.missingUpscaler')}</span>
          <Button size="xs" scheme="accent" onClick={() => useUi.getState().setTab('models')}>
            {t('params.upscale.openModels')}
          </Button>
        </div>
      )}
    </LaunchpadPage>
  );
}
