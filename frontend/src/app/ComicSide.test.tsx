// @vitest-environment jsdom
// The comic screen's side column: the assistant's question for leave to read is shown in its chat, whichever tab is open.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { useAgent } from '@/state/agent';
import { pageCanvasStore, resetPageCanvases } from '@/state/comic/pageCanvas';
import { newProject } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { t } from '@/i18n';
import { ComicSide } from './ComicSide';

const ready = { provider: 'claude' as const, installed: true, loggedIn: true, models: [] };

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterAll(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  vi.unstubAllGlobals();
});
let canvases: ReturnType<typeof installRecordingCanvases>;

beforeEach(() => {
  canvases = installRecordingCanvases();
  vi.spyOn(backend, 'agentStatus').mockResolvedValue(ready);
  useAgent.setState({ status: ready, permission: null, busy: false });
});
afterEach(() => {
  cleanup();
  canvases.restore();
  resetPageCanvases();
  vi.restoreAllMocks();
  useAgent.setState({ permission: null });
});

describe('the comic side column', () => {
  it('shows the assistant when it asks leave to read, even from the gallery tab', () => {
    render(
      <TooltipProvider>
        <ComicSide pageStore={null} />
      </TooltipProvider>,
    );
    const galleryTab = screen.getByTestId('comic-side-tab-gallery').closest('[role="tab"]')!;
    fireEvent.mouseDown(galleryTab, { button: 0 });
    expect(galleryTab.getAttribute('aria-selected')).toBe('true');
    act(() => useAgent.setState({ permission: { tool: 'view_comic_page' } as never }));
    expect(screen.getByTestId('comic-side-tab-assistant').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('true');
  });

  it('always shows the layers panel of the open page below the tabs, with no tab of its own', () => {
    useComic.getState().setProjects([newProject('Side')]);
    const page = useComic.getState().projects[0]!.pages[0]!;
    render(
      <TooltipProvider>
        <ComicSide pageStore={pageCanvasStore(page.id)} />
      </TooltipProvider>,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    const layers = screen.getByTestId('canvas-layers');
    expect(within(layers).getAllByTestId('canvas-entity')).toHaveLength(2);
    // Still there on the gallery tab.
    fireEvent.mouseDown(screen.getByTestId('comic-side-tab-gallery').closest('[role="tab"]')!, { button: 0 });
    expect(screen.getByTestId('canvas-layers')).toBeTruthy();
  });

  it('shows the empty layers state when no page is open', () => {
    render(
      <TooltipProvider>
        <ComicSide pageStore={null} />
      </TooltipProvider>,
    );
    expect(screen.queryByTestId('canvas-layers')).toBeNull();
    expect(screen.getByTestId('canvas-layers-empty').textContent).toContain(t('canvas.layers.empty'));
  });
});
