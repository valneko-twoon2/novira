// "Upscaling needs a model" as a choice: the upscaling models novira can install, with the recommended one marked.
// Shown while no upscaling model is installed.
import { useEffect, useState } from 'react';
import { backend, type StarterModel } from '@/backend';
import { t } from '@/i18n';
import { Button, InstallSlot } from '@/ui';
import { installModel } from '@/state/modelInstall';
import { ModelChoice, type ChoiceItem } from '../../media/ModelChoice';

/** The upscaler to start with: sharp on most pictures. */
const RECOMMENDED = 'starter-4x-ultrasharp';

export function UpscalerChoice() {
  const [starters, setStarters] = useState<StarterModel[] | null>(null);

  useEffect(() => {
    let alive = true;
    void backend.listStarterModels().then((list) => alive && setStarters(list.filter((s) => s.type === 'spandrel_image_to_image')));
    return () => {
      alive = false;
    };
  }, []);

  if (!starters || starters.length === 0) return null;
  const items: ChoiceItem[] = [...starters]
    .sort((a, b) => Number(b.id === RECOMMENDED) - Number(a.id === RECOMMENDED))
    .map((s) => {
      return {
        id: s.id,
        name: s.name,
        note: s.description,
        recommended: s.id === RECOMMENDED,
        action: (
          <InstallSlot source={s.source}>
            <Button size="xs" variant="solid" scheme="invoke" onClick={() => void installModel(s.source, s.name)}>
              {t('models.install.install')}
            </Button>
          </InstallSlot>
        ),
      };
    });
  return <ModelChoice title={t('media.choice.pickUpscaler')} items={items} testId="upscaler-choice" showGpu={false} />;
}
