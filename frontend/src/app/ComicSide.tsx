// The right column of the comic screen: the assistant and the gallery in two tabs
// on top, and below them, always shown, the Canvas layers panel on the open page's canvas store, narrowed to
// what a comic page holds, as the Image tab puts its layers under its gallery. The assistant is set into the column here
// instead of floating over the screen.
import { Stack } from '@phosphor-icons/react';
import { useEffect, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { AgentDock } from '@/features/agent/AgentDock';
import { LayersPanel } from '@/features/canvas/CanvasView';
import { GalleryPanel } from '@/features/gallery/GalleryPanel';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { entityLimitHit, type CanvasEntity, type CanvasStore, type EntityType } from '@/state/canvas';
import { CanvasStoreProvider } from '@/state/canvasStoreContext';
import { slotLabels } from '@/state/comic/layerName';
import { limitMessage, PAGE_LIMITS } from '@/state/comic/pageCanvas';
import { useComicSideTab, type ComicRightTab } from '@/state/comic/sideTab';
import { EmptyState, ErrorBoundary, Tab, TabList, TabPanel, Tabs } from '@/ui';

export function ComicSide({ pageStore }: { pageStore: CanvasStore | null }) {
  const tab = useComicSideTab((s) => s.right);
  const setTab = useComicSideTab((s) => s.setRight);
  // The assistant's question for leave to read (the permission prompt) lives in its chat: show the chat when one is asked.
  const asking = useAgent((s) => s.permission !== null);
  useEffect(() => {
    if (asking) setTab('assistant');
  }, [asking, setTab]);
  const host = useMemo(
    () => ({
      addable: ['raster' as const, 'inpaint' as const],
      hideGlobalRefs: true,
      slotLabels: slotLabels(),
      addBlocked: (entities: CanvasEntity[], type: EntityType) => {
        const hit = entityLimitHit(entities, type, PAGE_LIMITS);
        return hit ? limitMessage(hit) : null;
      },
    }),
    [],
  );
  return (
    <Group orientation="vertical" className="comic-side-group">
      <Panel id="comic-side-top" minSize={160} defaultSize="55">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ComicRightTab)} className="comic-side" aria-label={t('comic.side.label')} data-testid="comic-side">
          <TabList>
            <Tab value="assistant">
              <span data-testid="comic-side-tab-assistant">{t('comic.side.assistant')}</span>
            </Tab>
            <Tab value="gallery">
              <span data-testid="comic-side-tab-gallery">{t('comic.side.gallery')}</span>
            </Tab>
          </TabList>
          <TabPanel value="assistant" className="comic-side__panel comic-side__panel--chat">
            <ErrorBoundary area="comic assistant">
              <AgentDock />
            </ErrorBoundary>
          </TabPanel>
          <TabPanel value="gallery" className="comic-side__panel comic-side__panel--gallery">
            <ErrorBoundary area="gallery">
              <GalleryPanel tab="comic" />
            </ErrorBoundary>
          </TabPanel>
        </Tabs>
      </Panel>
      <Separator className="resize-handle resize-handle--h" />
      <Panel id="comic-side-layers" minSize={160}>
        <ErrorBoundary area="comic layers">
          {pageStore ? (
            <CanvasStoreProvider store={pageStore}>
              <LayersPanel host={host} />
            </CanvasStoreProvider>
          ) : (
            <div className="panel canvas-layers" data-testid="canvas-layers-empty">
              <div className="canvas-layers__header">
                <span className="canvas-layers__title">{t('canvas.layers.title')}</span>
              </div>
              <div className="panel__scroll canvas-layers__scroll">
                <EmptyState icon={<Stack size={28} />} title={t('canvas.layers.empty')} description={t('canvas.layers.emptyHint')} />
              </div>
            </div>
          )}
        </ErrorBoundary>
      </Panel>
    </Group>
  );
}
