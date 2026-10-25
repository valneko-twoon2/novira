// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { backend } from '@/backend';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { TooltipProvider } from '@/ui';
import { t } from '@/i18n';
import { PACK_CATALOG, PACK_GOALS, packFolder, packsForGoal } from '@/state/comfy/packCatalog';
import { PacksView } from './PacksView';

beforeAll(() => {
  backend.setStepDelay(0);
  backend.subscribe((e) => {
    if (e.type === 'node_pack') useNodePacks.getState().setJob(e.url, e.status);
  });
});
afterEach(cleanup);

const view = () =>
  render(
    <TooltipProvider>
      <PacksView />
    </TooltipProvider>,
  );

describe('extensions tab', () => {
  it('starts from what the user wants, opens a goal, installs a pack and restarts ComfyUI to load it', async () => {
    view();
    await waitFor(() => expect(screen.getAllByTestId('wf-goal')).toHaveLength(PACK_GOALS.length));
    // Packs that are not suggested are listed with their folder name.
    expect(await screen.findByText('comfyui-mock-preview')).toBeTruthy();

    fireEvent.click(screen.getByText(t('workflows.packs.goal.background.title')));
    const cards = screen.getAllByTestId('wf-pack');
    expect(cards.map((c) => c.getAttribute('data-pack'))).toEqual(packsForGoal('background').map((p) => p.id));
    const first = packsForGoal('background')[0]!;
    fireEvent.click(cards[0]!.querySelector('[data-testid="wf-pack-install"]')!);
    await waitFor(() => expect(useNodePacks.getState().packs?.installed.some((p) => p.folder === packFolder(first.url))).toBe(true), { timeout: 3000 });
    const restart = await screen.findByTestId('wf-packs-restart');
    await act(async () => {
      fireEvent.click(restart.querySelector('button')!);
    });
    await waitFor(() => expect(screen.queryByTestId('wf-packs-restart')).toBeNull(), { timeout: 3000 });
    fireEvent.click(screen.getByTestId('wf-goal-back'));
    expect(screen.getAllByTestId('wf-goal')).toHaveLength(PACK_GOALS.length);
  });

  it('shows the goal tiles first and the packs of a goal sorted by how much they are for it', () => {
    expect(PACK_GOALS.every((g) => packsForGoal(g).length > 0)).toBe(true);
    expect(PACK_CATALOG.length).toBeGreaterThanOrEqual(20);
    expect(new Set(PACK_CATALOG.map((p) => p.id)).size).toBe(PACK_CATALOG.length);
    expect(new Set(PACK_CATALOG.map((p) => p.url)).size).toBe(PACK_CATALOG.length);
    expect(packsForGoal('face')[0]!.goals[0]).toBe('face');
  });

  it('installs any GitHub pack by its address and shows why an install failed', async () => {
    view();
    const input = await screen.findByTestId('wf-pack-url');
    const button = screen.getByTestId('wf-pack-url-install') as HTMLButtonElement;
    fireEvent.change(input, { target: { value: 'https://gitlab.com/a/b' } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'https://github.com/someone/will-fail' } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await screen.findByText(/libraries failed/, undefined, { timeout: 3000 });
  });

  it('removes a pack only after a second click', async () => {
    view();
    await screen.findByText('comfyui-mock-preview');
    const row = screen.getByText('comfyui-mock-preview').parentElement!;
    const remove = row.querySelector('button')!;
    fireEvent.click(remove);
    expect(useNodePacks.getState().packs?.installed.some((p) => p.folder === 'comfyui-mock-preview')).toBe(true);
    await act(async () => {
      fireEvent.click(remove);
    });
    await waitFor(() => expect(screen.queryByText('comfyui-mock-preview')).toBeNull());
    expect(useNodePacks.getState().packs?.restartNeeded).toBe(true);
  });
});
