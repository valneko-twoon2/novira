// @vitest-environment jsdom
// The gallery context menus: every entry of the single-image menu and of the multi-image menu runs its command.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { t, tCount } from '@/i18n';
import { useBatch } from '@/state/dialogs/batch';
import { useCaptionDialog } from '@/state/dialogs/caption';
import { useCharacterDialog } from '@/state/dialogs/character';
import { useCutout } from '@/state/dialogs/cutout';
import { useDeriveDialog } from '@/state/dialogs/derive';
import { useFaceFixDialog } from '@/state/dialogs/facefix';
import { useSegment } from '@/state/dialogs/segment';
import { useShareDialog } from '@/state/dialogs/share';
import { useGallery } from '@/state/gallery';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger, TooltipProvider } from '@/ui';
import * as actions from '../actions';
import { requestDeleteImages } from '../deleteRequest';
import { MultiImageMenu } from './MultiImageMenu';
import { SingleImageMenu } from './SingleImageMenu';

vi.mock('../actions', () => ({
  addAsReference: vi.fn(),
  copyImage: vi.fn(),
  downloadImages: vi.fn(),
  canLoadImageWorkflow: vi.fn(() => true),
  canOpenInNewTab: vi.fn(() => true),
  loadImageWorkflow: vi.fn(),
  moveImagesToBoard: vi.fn(),
  openInNewTab: vi.fn(),
  recall: vi.fn(),
  sendToCanvas: vi.fn(),
  sendToText: vi.fn(),
  sendToUpscale: vi.fn(),
  sendToVideo: vi.fn(),
  sendToWorkflow: vi.fn(),
  setStarred: vi.fn(),
}));
vi.mock('../deleteRequest', () => ({ requestDeleteImages: vi.fn() }));
vi.mock('@/state/trim', () => ({ trimTransparent: vi.fn() }));
vi.mock('@/state/derive', async (original) => ({ ...(await original<typeof import('@/state/derive')>()), deriveFrom: vi.fn() }));

import { deriveFrom } from '@/state/derive';
import { trimTransparent } from '@/state/trim';

const initial = useGallery.getState();
const image = (over: Partial<ImageDTO> = {}): ImageDTO =>
  ({ name: 'a.png', url: 'u', thumbnailUrl: 't', width: 10, height: 10, metadata: {}, boardId: null, starred: false, mediaType: 'image', ...over }) as ImageDTO;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useGallery.setState({ ...initial, images: [image(), image({ name: 'b.png' })], boards: [{ id: 'b1', name: 'Alpha', archived: false, createdAt: 1 }, { id: 'b2', name: 'Hidden', archived: true, createdAt: 2 }] }, true);
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function showMenu(menu: React.ReactNode) {
  render(
    <TooltipProvider>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="target">image</div>
        </ContextMenuTrigger>
        <ContextMenuContent>{menu}</ContextMenuContent>
      </ContextMenu>
    </TooltipProvider>,
  );
  fireEvent.contextMenu(screen.getByTestId('target'));
}
/** Opens the menu again and clicks the entry with this label. */
async function choose(label: string) {
  const menu = (await screen.findAllByRole('menu'))[0]!;
  fireEvent.click(within(menu).getByText(label));
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  fireEvent.contextMenu(screen.getByTestId('target'));
}
async function chooseInSub(sub: string, label: string) {
  const menu = (await screen.findAllByRole('menu'))[0]!;
  fireEvent.keyDown(within(menu).getByText(sub).closest('[role=menuitem]')!, { key: 'ArrowRight' });
  const subMenu = (await screen.findAllByRole('menu')).at(-1)!;
  fireEvent.click(within(subMenu).getByText(label));
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  fireEvent.contextMenu(screen.getByTestId('target'));
}

describe('SingleImageMenu', () => {
  it('opens in the viewer, in a new tab, downloads, copies and compares', async () => {
    showMenu(<SingleImageMenu image={image()} />);
    // Comparing is off for the picture that is open in the viewer, so it comes before opening it.
    await choose(t('gallery.menu.compare'));
    expect(useGallery.getState().compareImageName).toBe('a.png');
    await choose(t('gallery.menu.openInViewer'));
    expect(useGallery.getState().selection).toEqual(['a.png']);
    await choose(t('gallery.menu.openInNewTab'));
    expect(actions.openInNewTab).toHaveBeenCalled();
    await choose(t('common.download'));
    expect(actions.downloadImages).toHaveBeenCalledWith([expect.objectContaining({ name: 'a.png' })]);
    await choose(t('common.copy'));
    expect(actions.copyImage).toHaveBeenCalled();
    await choose(t('share.menu'));
    expect(useShareDialog.getState().names).toEqual(['a.png']);
  });

  it('recalls the settings of the picture', async () => {
    showMenu(<SingleImageMenu image={image()} />);
    for (const [label, mode] of [
      ['gallery.menu.remix', 'remix'],
      ['gallery.menu.usePrompt', 'prompt'],
      ['gallery.menu.useSeed', 'seed'],
      ['gallery.menu.useAll', 'all'],
      ['gallery.menu.useSize', 'size'],
    ] as const) {
      await choose(t(label));
      expect(actions.recall).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'a.png' }), mode);
    }
    await choose(t('gallery.menu.loadWorkflow'));
    expect(actions.loadImageWorkflow).toHaveBeenCalled();
  });

  it('sends the picture to the other tabs', async () => {
    showMenu(<SingleImageMenu image={image()} />);
    await choose(t('gallery.menu.useAsReference'));
    expect(actions.addAsReference).toHaveBeenCalled();
    await choose(t('gallery.menu.sendToVideo'));
    expect(actions.sendToVideo).toHaveBeenCalled();
    await choose(t('gallery.menu.sendToWorkflow'));
    expect(actions.sendToWorkflow).toHaveBeenCalled();
    await choose(t('gallery.menu.sendToText'));
    expect(actions.sendToText).toHaveBeenCalled();
    await choose(t('gallery.menu.upscale'));
    expect(actions.sendToUpscale).toHaveBeenCalled();
    await chooseInSub(t('gallery.menu.sendToCanvas'), t('gallery.canvas.control'));
    expect(actions.sendToCanvas).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.png' }), 'control');
  });

  it('opens the editing dialogs for the picture', async () => {
    showMenu(<SingleImageMenu image={image()} />);
    await choose(t('gallery.menu.segment'));
    expect(useSegment.getState().imageName).toBe('a.png');
    await choose(t('cutout.menu'));
    expect(useCutout.getState().imageName).toBe('a.png');
    await choose(t('facefix.menu'));
    expect(useFaceFixDialog.getState().imageName).toBe('a.png');
    await choose(t('caption.menu'));
    expect(useCaptionDialog.getState().imageName).toBe('a.png');
    await choose(t('character.menu'));
    expect(useCharacterDialog.getState().open).toBeTruthy();
    await choose(t('gallery.menu.trim'));
    expect(trimTransparent).toHaveBeenCalled();
  });

  it('derives new pictures from it', async () => {
    showMenu(<SingleImageMenu image={image({ metadata: { modelKey: 'm', generationMode: 'txt2img' } as never })} />);
    await chooseInSub(t('gallery.derive.menu'), t('gallery.derive.custom'));
    expect(useDeriveDialog.getState().imageName).toBe('a.png');
    await chooseInSub(t('gallery.derive.menu'), t('gallery.derive.variation', { count: 1 }));
    expect(deriveFrom).toHaveBeenCalled();
  });

  it('moves, stars and deletes', async () => {
    showMenu(<SingleImageMenu image={image()} />);
    await chooseInSub(t('gallery.menu.changeBoard'), 'Alpha');
    expect(actions.moveImagesToBoard).toHaveBeenCalledWith(['a.png'], 'b1');
    await choose(t('gallery.menu.star'));
    expect(actions.setStarred).toHaveBeenCalledWith(['a.png'], true);
    await choose(t('gallery.menu.delete'));
    expect(requestDeleteImages).toHaveBeenCalledWith(['a.png']);
  });

  it('offers to unstar, and turns off what does not apply to videos or pictures without settings', async () => {
    vi.mocked(actions.canOpenInNewTab).mockReturnValue(false);
    vi.mocked(actions.canLoadImageWorkflow).mockReturnValue(false);
    showMenu(<SingleImageMenu image={image({ starred: true, metadata: null, mediaType: 'video' })} />);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText(t('gallery.menu.unstar'))).toBeTruthy();
    expect(within(menu).queryByText(t('gallery.menu.openInNewTab'))).toBeNull();
    for (const label of [t('share.menu'), t('gallery.menu.remix'), t('gallery.menu.loadWorkflow'), t('gallery.menu.sendToVideo'), t('cutout.menu'), t('caption.menu')]) {
      expect(within(menu).getByText(label).closest('[role=menuitem]')!.getAttribute('aria-disabled')).toBe('true');
    }
    vi.mocked(actions.canOpenInNewTab).mockReturnValue(true);
    vi.mocked(actions.canLoadImageWorkflow).mockReturnValue(true);
  });
});

describe('MultiImageMenu', () => {
  it('stars, downloads, shares, batches, moves and deletes the selection', async () => {
    showMenu(<MultiImageMenu names={['a.png', 'b.png']} />);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText(tCount('gallery.menu.selectedCount', 2))).toBeTruthy();
    await choose(t('gallery.menu.starAll'));
    expect(actions.setStarred).toHaveBeenLastCalledWith(['a.png', 'b.png'], true);
    await choose(t('gallery.menu.unstarAll'));
    expect(actions.setStarred).toHaveBeenLastCalledWith(['a.png', 'b.png'], false);
    await choose(t('common.download'));
    expect(actions.downloadImages).toHaveBeenCalledWith([expect.objectContaining({ name: 'a.png' }), expect.objectContaining({ name: 'b.png' })]);
    await choose(t('share.menu'));
    expect(useShareDialog.getState().names).toEqual(['a.png', 'b.png']);
    await choose(t('gallery.menu.batch'));
    expect(useBatch.getState().names).toEqual(['a.png', 'b.png']);
    await chooseInSub(t('gallery.menu.changeBoard'), t('gallery.boards.uncategorized'));
    expect(actions.moveImagesToBoard).toHaveBeenCalledWith(['a.png', 'b.png'], 'none');
    await choose(tCount('gallery.menu.deleteCount', 2));
    expect(requestDeleteImages).toHaveBeenCalledWith(['a.png', 'b.png']);
  });
});
