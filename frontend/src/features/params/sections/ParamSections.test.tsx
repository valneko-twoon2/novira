// @vitest-environment jsdom
// Two accordions of the Generate settings: Compositing (coherence, mask blur, infill) and Upscale.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import type { ModelConfig } from '@/backend';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { UpscaleSection } from '../upscale/UpscaleSection';
import { CompositingSection } from './CompositingSection';

const initial = { params: useParams.getState(), models: useModels.getState(), ui: useUi.getState() };
const state = () => useParams.getState();
const show = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);
const num = (label: string) => screen.getAllByLabelText(label).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
const setNum = (label: string, value: number) => {
  fireEvent.change(num(label), { target: { value: String(value) } });
  fireEvent.blur(num(label));
};
const model = (key: string, type: ModelConfig['type'], base: ModelConfig['base'] = 'sdxl'): ModelConfig =>
  ({ key, name: key, type, base, format: 'diffusers', description: '', path: '', size: 0, source: '' }) as ModelConfig;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useParams.setState(initial.params, true);
  useModels.setState(initial.models, true);
  useUi.setState(initial.ui, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CompositingSection', () => {
  const showOpen = () => {
    show(<CompositingSection />);
    fireEvent.click(screen.getByText(t('params.compositing.title')));
  };

  it('edits the coherence pass and the mask blur', () => {
    showOpen();
    setNum(t('params.compositing.edgeSize'), 64);
    setNum(t('params.compositing.minDenoise'), 0.25);
    setNum(t('params.compositing.maskBlur'), 12.4);
    expect(state()).toMatchObject({ coherenceEdgeSize: 64, coherenceMinDenoise: 0.25, maskBlur: 12 });
  });

  it('shows the tile size only for the tile infill, and the colour choices only for the colour infill', () => {
    showOpen();
    expect(screen.queryByLabelText(t('params.compositing.tileSize'))).toBeNull();
    act(() => state().set({ infillMethod: 'tile' }));
    setNum(t('params.compositing.tileSize'), 40);
    expect(state().infillTileSize).toBe(40);
    act(() => state().set({ infillMethod: 'color' }));
    expect(screen.queryByLabelText(t('params.compositing.tileSize'))).toBeNull();
    fireEvent.click(screen.getByLabelText(t('params.compositing.colorWhite')));
    expect(state().infillColor).toBe('white');
    fireEvent.click(screen.getByLabelText(t('params.compositing.colorBlack')));
    fireEvent.click(screen.getByLabelText(t('params.compositing.colorGray')));
    expect(state().infillColor).toBe('gray');
    const field = screen.getAllByLabelText(t('params.compositing.color')).find((e) => e.tagName === 'INPUT') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '#123456' } });
    expect(state().infillColor).toBe('#123456');
  });
});

describe('UpscaleSection', () => {
  it('warns about missing upscale models and tile ControlNets', () => {
    useModels.setState({ models: [model('main1', 'main')] });
    useParams.setState({ modelKey: 'main1' });
    show(<UpscaleSection />);
    expect(screen.getAllByText(t('params.upscale.noModels')).length).toBeGreaterThan(0);
    expect(screen.getByText(t('params.upscale.missingTile'))).toBeTruthy();
    // Structure is the tile ControlNet's strength, so it has nothing to change without one.
    expect((screen.getAllByLabelText(t('params.upscale.structure')).find((e) => e.tagName === 'INPUT') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByText(t('params.upscale.openModels')));
    expect(useUi.getState().activeTab).toBe('models');
  });

  it('picks the scale and edits creativity and structure', () => {
    useModels.setState({ models: [model('main1', 'main'), model('tile1', 'controlnet')] });
    useParams.setState({ modelKey: 'main1' });
    useParams.getState().setUpscale({ tileControlnetModelKey: 'tile1' });
    show(<UpscaleSection />);
    const group = screen.getByRole('radiogroup', { name: t('params.upscale.scale') });
    fireEvent.click(within(group).getByText('8x'));
    expect(state().upscale.scale).toBe(8);
    fireEvent.click(within(group).getByText('2x'));
    expect(state().upscale.scale).toBe(2);
    setNum(t('params.upscale.creativity'), 3.4);
    setNum(t('params.upscale.structure'), -4);
    expect(state().upscale).toMatchObject({ creativity: 3, structure: -4 });
  });

  it('shows the output size of the picture, and warns when it gets too large', () => {
    useParams.getState().setUpscale({ scale: 4, initialImage: { name: 'a.png', url: 'u', width: 1100, height: 500 } as never });
    show(<UpscaleSection />);
    expect(screen.getByText(t('params.upscale.output', { width: 4400, height: 2000 }))).toBeTruthy();
    expect(screen.queryByText(t('params.upscale.tooLarge', { max: 8192 }))).toBeNull();
    act(() => state().setUpscale({ scale: 8 }));
    expect(screen.getByText(t('params.upscale.tooLarge', { max: 8192 }))).toBeTruthy();
  });

  it('asks to select an upscaler when some exist but none is chosen', () => {
    useModels.setState({ models: [model('main1', 'main'), model('up1', 'spandrel_image_to_image'), model('tile1', 'controlnet')] });
    useParams.setState({ modelKey: 'main1' });
    useParams.getState().setUpscale({ upscaleModelKey: null });
    show(<UpscaleSection />);
    expect(screen.getByText(t('params.upscale.selectUpscaler'))).toBeTruthy();
    expect(screen.queryByText(t('params.upscale.missingTile'))).toBeNull();
    expect(screen.queryByText(t('params.upscale.noModels'))).toBeNull();
  });
});
