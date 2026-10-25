// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useParams } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { RefImagePackNeeds } from './RefImagePackNeeds';

const URL = 'https://github.com/cubiq/ComfyUI_IPAdapter_plus';
const initialPacks = useNodePacks.getState();

function show() {
  return render(
    <TooltipProvider>
      <RefImagePackNeeds />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  useParams.setState({ refImages: [] });
  useNodePacks.setState({ ...initialPacks, packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false }, jobs: {} }, true);
});
afterEach(cleanup);

describe('reference image pack needs', () => {
  it('offers the install while the pack is missing, then the restart, then nothing', () => {
    useParams.getState().addRefImage({ imageName: 'r.png', imageUrl: 'http://novira-image.localhost/full/r.png', modelKey: 'ipa' });
    const install = vi.fn(async () => {});
    useNodePacks.setState({ install });
    show();
    expect(screen.getByText(t('params.refImage.needsPack', { pack: 'ComfyUI_IPAdapter_plus' }))).toBeTruthy();
    fireEvent.click(screen.getByTestId('ref-pack-install'));
    expect(install).toHaveBeenCalledWith(URL);

    act(() =>
      useNodePacks.setState({
        packs: { available: true, installed: [{ folder: 'ComfyUI_IPAdapter_plus', url: URL, version: null }], comfyVersion: null, restartNeeded: true },
        jobs: { [URL]: { state: 'ready' } },
      }),
    );
    expect(screen.queryByTestId('ref-pack-install')).toBeNull();
    expect(screen.getByText(t('params.refImage.restartEngine'))).toBeTruthy();

    act(() => useNodePacks.setState({ packs: { available: true, installed: [{ folder: 'ComfyUI_IPAdapter_plus', url: URL, version: null }], comfyVersion: null, restartNeeded: false } }));
    expect(screen.queryByTestId('ref-pack-needs')).toBeNull();
  });

  it('stays hidden without enabled reference images, and loads the pack list when one is added', () => {
    const load = vi.fn(async () => {});
    useNodePacks.setState({ packs: null, load });
    show();
    expect(screen.queryByTestId('ref-pack-needs')).toBeNull();
    expect(load).not.toHaveBeenCalled();
    act(() => void useParams.getState().addRefImage({ isEnabled: false }));
    expect(load).not.toHaveBeenCalled();
    act(() => void useParams.getState().addRefImage());
    expect(load).toHaveBeenCalledTimes(1);
    // Still unknown: nothing is claimed missing.
    expect(screen.queryByTestId('ref-pack-needs')).toBeNull();
  });
});
