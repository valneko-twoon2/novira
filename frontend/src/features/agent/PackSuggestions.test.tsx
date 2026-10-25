// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { backend } from '@/backend';
import { runMockAgent } from '@/backend/mock/agent';
import { fakeTools } from '@/backend/mock/agentScript.testkit';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useRegistry } from '@/state/comfy/registry';
import { agentPacks } from '@/state/comfy/packCatalog';
import { PackSuggestions } from './PackSuggestions';

beforeAll(() => {
  backend.setStepDelay(0);
  backend.subscribe((e) => {
    if (e.type === 'node_pack') useNodePacks.getState().setJob(e.url, e.status);
  });
});
afterEach(cleanup);

/** The packs the mock recommends with recommend_packs, given the catalog as search_extensions lists it. */
async function recommended(message: string, installed: { folder: string; url: string | null }[] = []) {
  const tools = fakeTools({ search_extensions: { packs: agentPacks(installed), extensions: [] }, list_models: { models: [] } });
  await runMockAgent({ message, locale: 'ja' }, tools.call);
  return tools.args('recommend_packs')?.ids;
}

describe('pack recommendations', () => {
  it('suggests the packs for what the user wants, and only the ones not installed yet', async () => {
    expect(await recommended('背景を消したい')).toEqual(['rmbg', 'sam2']);
    expect(await recommended('背景を消したい', [{ folder: 'ComfyUI-RMBG', url: null }])).toEqual(['sam2']);
    expect(await recommended('背景を消したい', [{ folder: 'ComfyUI-RMBG', url: null }, { folder: 'ComfyUI-segment-anything-2', url: null }])).toBeUndefined();
  });

  it('does not recommend packs for a picture to draw', async () => {
    expect(await recommended('笑顔の女の子の背景は夕焼け')).toBeUndefined();
  });

  it('shows a card per pack with an install button, and skips ids it does not know', async () => {
    await useNodePacks.getState().load();
    render(<PackSuggestions ids={['rmbg', 'nope', 'sam2']} />);
    const cards = screen.getAllByTestId('agent-pack');
    expect(cards.map((c) => c.getAttribute('data-pack'))).toEqual(['rmbg', 'sam2']);
    fireEvent.click(cards[1]!.querySelector('[data-testid="agent-pack-install"]')!);
    await waitFor(() => expect(useNodePacks.getState().packs?.installed.some((p) => p.folder === 'ComfyUI-segment-anything-2')).toBe(true), { timeout: 3000 });
    await waitFor(() => expect(screen.getAllByTestId('agent-pack')[1]!.querySelector('[data-testid="agent-pack-install"]')).toBeNull());
  });
});

describe('recommendations of extensions from the registry', () => {
  const reg = { id: 'foo', name: 'ComfyUI-Foo', description: 'Draws foo shapes', publisher: 'someone', repository: 'https://github.com/someone/ComfyUI-Foo', icon: null, downloads: 1, stars: 1, version: '1.0.0', updated: null, license: null };
  afterEach(() => useRegistry.setState({ nodes: null }));

  it('shows a card for an ext: id with the registry text and an install button, and skips one the registry does not list', async () => {
    await useNodePacks.getState().load();
    useRegistry.setState({ nodes: [reg] });
    render(<PackSuggestions ids={['ext:ComfyUI-Foo', 'ext:Made-Up', 'rmbg']} />);
    const cards = screen.getAllByTestId('agent-pack');
    expect(cards.map((c) => c.getAttribute('data-pack'))).toEqual(['ext:ComfyUI-Foo', 'rmbg']);
    expect(cards[0]!.textContent).toContain('ComfyUI-Foo');
    expect(cards[0]!.textContent).toContain('Draws foo shapes');
    expect(cards[0]!.querySelector('[data-testid="agent-pack-install"]')).not.toBeNull();
  });
});
