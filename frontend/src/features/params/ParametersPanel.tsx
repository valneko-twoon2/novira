// Left panel of the image tabs: preset bar, Generate row, model card, prompts, reference images and the parameter accordions.
// The comic screen puts its comic chooser above the model card (beforeModel) and the selected panel's settings right after
// the prompts (lead): the same header, prompts and parameters in the same places as on Generate. There the prompt boxes
// hold the selected panel's prompts (see state/comic/promptSync.ts).
import type { ReactNode } from 'react';
import type { TabName } from '@/state/ui';
import { ErrorBoundary } from '@/ui';
import './params.css';
import './header/header.css';
import './promptbook/promptbook.css';
import { PanelHeader } from './header/PanelHeader';
import { PromptBookDialog } from './promptbook/PromptBookDialog';
import { PromptBoxes } from './prompts/PromptBox';
import { RefImageList } from './refImages/RefImageList';
import { AdvancedSection } from './sections/AdvancedSection';
import { CompositingSection } from './sections/CompositingSection';
import { GenerationSection } from './sections/GenerationSection';
import { HiresSection } from './sections/HiresSection';
import { ImageSection } from './sections/ImageSection';
import { UpscaleSection } from './upscale/UpscaleSection';
import { WildcardsDialog } from './wildcards/WildcardsDialog';

export function ParametersPanel({ tab, lead, beforeModel }: { tab: TabName; lead?: ReactNode; beforeModel?: ReactNode }) {
  return (
    <div className="pp" data-testid="parameters-panel">
      <PanelHeader tab={tab} beforeModel={beforeModel} />
      <div className="pp-body">
        <PromptBoxes />
        {lead}
        {tab === 'upscaling' ? (
          <>
            <UpscaleSection />
            <GenerationSection />
            <AdvancedSection />
          </>
        ) : (
          <>
            <RefImageList />
            {tab !== 'comic' && <ImageSection tab={tab} />}
            <GenerationSection />
            {(tab === 'generate' || tab === 'comic') && <HiresSection />}
            {tab === 'canvas' && <CompositingSection />}
            <AdvancedSection />
          </>
        )}
      </div>
      <PromptBookDialog />
      <ErrorBoundary area="wildcards">
        <WildcardsDialog />
      </ErrorBoundary>
    </div>
  );
}
