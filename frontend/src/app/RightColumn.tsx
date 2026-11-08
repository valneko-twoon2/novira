// The right column of the image screens: the gallery and the assistant in two tabs, gallery first. The assistant is set
// into the column here instead of floating over the screen; the tab shown is the assistant's `open`, so whatever opens
// the assistant (its permission question, a question from another screen) shows its tab. The Canvas tab keeps its
// layers under them, always shown; the Text screen keeps its layers there too.
import { Group, Panel, Separator } from 'react-resizable-panels';
import { AgentDock } from '@/features/agent/AgentDock';
import { LayersPanel } from '@/features/canvas/CanvasView';
import { GalleryPanel } from '@/features/gallery/GalleryPanel';
import { TextLayersPanel } from '@/features/text/TextLayersPanel';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { useUi, type TabName } from '@/state/ui';
import { ErrorBoundary, Tab, TabList, TabPanel, Tabs } from '@/ui';

// The column is opened whenever the assistant is, so a collapsed column does not hide a question waiting for an answer.
useAgent.subscribe((s, before) => {
  if (s.open && !before.open) useUi.getState().setRightPanelOpen(true);
});

export function RightColumn({ tab }: { tab: TabName }) {
  const media = useUi((s) => s.media);
  const textLayers = tab === 'generate' && media === 'text';
  const layers = tab === 'canvas' || textLayers;
  if (tab !== 'canvas' && tab !== 'generate') return <GalleryAndAssistant tab={tab} />;
  // On the Generate tab the column is the same tree whether it has layers (Text) or not (Image), so the gallery, which is
  // the heaviest part of a switch between the two, stays mounted instead of being built again.
  return (
    <Group orientation="vertical">
      <Panel id="gallery" minSize={layers ? 160 : 0} defaultSize={layers ? '55' : '100'}>
        <GalleryAndAssistant tab={tab} />
      </Panel>
      {layers && (
        <>
          <Separator className="resize-handle resize-handle--h" />
          <Panel id="layers" minSize={160}>
            <ErrorBoundary area="layers">
              {textLayers ? <TextLayersPanel /> : <LayersPanel tab={tab} />}
            </ErrorBoundary>
          </Panel>
        </>
      )}
    </Group>
  );
}

function GalleryAndAssistant({ tab }: { tab: TabName }) {
  const assistant = useAgent((s) => s.open);
  const setOpen = useAgent((s) => s.setOpen);
  return (
    <Tabs value={assistant ? 'assistant' : 'gallery'} onValueChange={(v) => setOpen(v === 'assistant')} className="right-side" aria-label={t('app.right.label')}>
      <TabList>
        <Tab value="gallery">
          <span data-testid="right-tab-gallery">{t('app.right.gallery')}</span>
        </Tab>
        <Tab value="assistant">
          <span data-testid="agent-open">{t('app.right.assistant')}</span>
        </Tab>
      </TabList>
      <TabPanel value="gallery" className="right-side__panel">
        <ErrorBoundary area="gallery">
          <GalleryPanel tab={tab} />
        </ErrorBoundary>
      </TabPanel>
      <TabPanel value="assistant" className="right-side__panel">
        <ErrorBoundary area="assistant">
          <AgentDock />
        </ErrorBoundary>
      </TabPanel>
    </Tabs>
  );
}
