// The comic screen: the drawing form (as on the Generate tab, with the comic chooser above the model) down the left;
// the page in the middle, with its pages in a row under it; and the assistant and the gallery
// down the right, with the page's layers below them. The page is painted on with the Canvas's parts on the page's own canvas store: they are put
// together here, since the comic feature does not import the canvas feature.
import { useEffect, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useStore } from 'zustand';
import { CanvasHotkeys } from '@/features/canvas/CanvasHotkeys';
import { EmbeddedStage, EmbeddedStageContent } from '@/features/canvas/stage/EmbeddedStage';
import { PaintToolbar, PAINT_TOOLS } from '@/features/canvas/toolbar/PaintToolbar';
import { ComicEditor, ComicProjectPicker } from '@/features/comic';
import { MediaTabs } from '@/features/media/MediaTabs';
import { ComicDrawExtras } from '@/features/params/ComicParams';
import { ParametersPanel } from '@/features/params/ParametersPanel';
import { useCanvas, type CanvasStore } from '@/state/canvas';
import { CanvasStoreProvider } from '@/state/canvasStoreContext';
import { pagePixels } from '@/state/comic/document';
import { useActivePageCanvas } from '@/state/comic/pageCanvas';
import { limitPageBbox } from '@/state/comic/pageInpaint';
import { followLayerChoice, isPaintableRaster } from '@/state/comic/paintMode';
import { activePage, useComic } from '@/state/comic/store';
import { useUi } from '@/state/ui';
import { ErrorBoundary } from '@/ui';
import { ComicSide } from './ComicSide';
import { PageInpaintBar } from './PageInpaintBar';
import './comicWorkspace.css';

/** The raster layer of the user chosen in a page store, the one being painted on; null without a store or such a choice. */
function usePaintedLayerId(store: CanvasStore | null): string | null {
  // Without a page store the Image tab's store is read, and nothing of it is used.
  return useStore(store ?? useCanvas, (s) => {
    if (!store) return null;
    const chosen = s.entities.find((e) => e.id === s.selectedEntityId);
    return isPaintableRaster(chosen) ? (chosen?.id ?? null) : null;
  });
}

/** The Canvas parts that paint on the open page, given to the comic editor while a page store is there. */
function usePaintParts(store: CanvasStore | null) {
  const size = useComic((s) => {
    const page = activePage(s);
    return page ? page.size : null;
  });
  const pageId = useComic((s) => activePage(s)?.id ?? null);
  const paintLayerId = usePaintedLayerId(store);
  return useMemo(() => {
    if (!store || !size || !pageId) return {};
    const { width, height } = pagePixels({ size });
    return {
      paintLayerId,
      paintLayer: (
        <CanvasStoreProvider store={store}>
          <EmbeddedStageContent />
        </CanvasStoreProvider>
      ),
      paintSurface: (
        <CanvasStoreProvider store={store}>
          <EmbeddedStage docWidth={width} docHeight={height} limitBbox={(box) => limitPageBbox(box, { width, height })} />
          <CanvasHotkeys tools={PAINT_TOOLS} viewKeys={false} refImages={false} />
        </CanvasStoreProvider>
      ),
      paintToolbar: (
        <CanvasStoreProvider store={store}>
          <PaintToolbar />
          <PageInpaintBar pageId={pageId} />
        </CanvasStoreProvider>
      ),
    };
  }, [store, size, pageId, paintLayerId]);
}

export function ComicWorkspace() {
  const pageId = useComic((s) => activePage(s)?.id ?? null);
  // The open page's canvas store, made whenever a page is open: its layers are always shown.
  const pageStore = useActivePageCanvas();
  const paint = usePaintParts(pageStore);
  // Choosing a raster layer of the user in the layers panel starts painting on it; choosing a slot goes back to the page.
  useEffect(() => {
    if (!pageStore || !pageId) return;
    return pageStore.subscribe((s, prev) => {
      if (s.selectedEntityId !== prev.selectedEntityId) followLayerChoice(pageId, s.selectedEntityId);
    });
  }, [pageStore, pageId]);
  const { left: leftWidth, right: rightWidth } = useUi.getState().panelWidths;
  return (
    <div className="comic-ws" data-testid="comic-workspace">
      <Group orientation="horizontal" className="comic-ws__body">
        <Panel id="comic-left" defaultSize={leftWidth} minSize={320} maxSize={640} className="comic-ws__col">
          <div className="panel">
            <MediaTabs />
            <div className="panel__scroll">
              <ErrorBoundary area="comic draw form">
                <ParametersPanel tab="comic" beforeModel={<ErrorBoundary area="comic chooser"><ComicProjectPicker /></ErrorBoundary>} lead={<ComicDrawExtras />} />
              </ErrorBoundary>
            </div>
          </div>
        </Panel>
        <Separator className="resize-handle" />
        <Panel id="comic-center" minSize={360} className="comic-ws__col">
          <div className="panel comic-ws__surface">
            <ErrorBoundary area="comic page">
              <ComicEditor canPaint {...paint} />
            </ErrorBoundary>
          </div>
        </Panel>
        <Separator className="resize-handle" />
        <Panel id="comic-right" defaultSize={rightWidth} minSize={300} maxSize={720} className="comic-ws__col">
          <div className="panel">
            <ComicSide pageStore={pageStore} />
          </div>
        </Panel>
      </Group>
    </div>
  );
}
