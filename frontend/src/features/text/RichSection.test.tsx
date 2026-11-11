// @vitest-environment jsdom
// The AI form of the Text screen with the Generate screen's parts: the seed row, the Generate bar with its queue controls, the model card and the folded details.
import { act, cleanup, fireEvent, render as renderBare, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { RICH_FORM_DEFAULTS, useRichForm } from '@/state/text/richForm';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE, newBubbleLayer, newTextLayer } from '@/state/text/textModel';
import { TooltipProvider } from '@/ui';
import { registerTextFeature } from './register';
import { RichDetails, RichHeader } from './RichSection';
import { useRichRun } from './richRun';

registerTextFeature();

const model = (key: string, type: ModelConfig['type'], base: ModelConfig['base'], name = key): ModelConfig => ({ key, name, base, type, format: 'checkpoint', description: '', path: `${name}.safetensors`, size: 1, source: '' });

const size = { width: 400, height: 300 };

function selectText(text = 'NOVIRA') {
  const layer = { ...newTextLayer(size, 'NOVIRA'), text };
  useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [layer] }, selectedId: layer.id, past: [], future: [] });
}

const render = (ui: ReactElement) => renderBare(<TooltipProvider>{ui}</TooltipProvider>);
const invokeButton = () => screen.getByTestId('invoke-button') as HTMLButtonElement;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useRichForm.setState({ form: RICH_FORM_DEFAULTS });
  useRichRun.setState({ running: {} });
  useGallery.setState({ images: [] as never });
  useModels.setState({ models: [model('wai', 'main', 'sdxl', 'wai'), model('cn', 'controlnet', 'sdxl', 'union-promax')] });
  selectText();
});

describe('RichHeader', () => {
  it('shows the seed row of the Generate screen and keeps its choices in the form', { tags: ['scenario'] }, () => {
    render(<RichHeader />);
    expect(screen.getByText(t('params.seed.label'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('seed-fixed'));
    expect(useRichForm.getState().form.randomSeed).toBe(false);
    const box = screen.getByRole('spinbutton', { name: t('params.seed.label') });
    fireEvent.change(box, { target: { value: '1234' } });
    fireEvent.blur(box);
    expect(useRichForm.getState().form.seed).toBe(1234);
  });

  it('has the Generate bar of the Generate screen: the caret, the count and the queue controls', { tags: ['scenario'] }, () => {
    render(<RichHeader />);
    expect(invokeButton().textContent).toContain(t('params.invoke.invoke'));
    expect(screen.getByLabelText(t('params.invoke.moreOptions'))).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: t('params.invoke.iterations') })).toBeTruthy();
    expect(screen.getByLabelText(t('params.invoke.queueMenu'))).toBeTruthy();
    expect(screen.getByLabelText(t('params.invoke.cancelCurrent'))).toBeTruthy();
  });

  it('adds no note when a line ControlNet is missing, and the button stays usable', { tags: ['error-guessing'] }, () => {
    useModels.setState({ models: [model('wai', 'main', 'sdxl')] });
    render(<RichHeader />);
    expect(screen.queryByTestId('text-rich-nomodel')).toBeNull();
    expect(invokeButton().disabled).toBe(false);
  });

  it('says why when no model can draw', { tags: ['condition'] }, () => {
    useModels.setState({ models: [] });
    render(<RichHeader />);
    expect(screen.getByTestId('text-rich-nomodel')).toBeTruthy();
    expect(invokeButton().disabled).toBe(true);
  });

  it.each([
    ['an empty text', () => selectText('  ')],
    ['no selection', () => useTextEditor.setState({ selectedId: null })],
    ['a bubble', () => {
      const bubble = newBubbleLayer(size, 'round', '');
      useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [bubble] }, selectedId: bubble.id });
    }],
  ])('waits for a text layer with words, with no note on the panel: %s', { tags: ['equivalence'] }, (_name, arrange) => {
    arrange();
    render(<RichHeader />);
    expect(invokeButton().disabled).toBe(true);
    expect(screen.queryByText(t('text.rich.select'))).toBeNull();
  });

  it('turns the button on when a text layer gets selected', { tags: ['scenario'] }, () => {
    useTextEditor.setState({ selectedId: null });
    render(<RichHeader />);
    expect(invokeButton().disabled).toBe(true);
    act(() => selectText());
    expect(invokeButton().disabled).toBe(false);
  });

  it('keeps the chosen model only while it is installed', { tags: ['condition'] }, () => {
    useRichForm.setState({ form: { ...RICH_FORM_DEFAULTS, modelKey: 'gone' } });
    render(<RichHeader />);
    expect(screen.getByTestId('text-rich-model').textContent).toContain(t('text.rich.model.auto'));
  });

  it('picks the model with the card and picker of the Generate screen, and goes back to automatic', { tags: ['scenario'] }, () => {
    useModels.setState({ models: [model('wai', 'main', 'sdxl', 'wai'), model('nova', 'main', 'sdxl', 'nova'), model('cn', 'controlnet', 'sdxl', 'union-promax')] });
    render(<RichHeader />);
    const card = screen.getByTestId('text-rich-model-card');
    expect(card.classList.contains('pp-model')).toBe(true);
    expect(card.querySelector('.pp-model__row .pp-cover')).not.toBeNull();
    fireEvent.click(screen.getByTestId('text-rich-model'));
    const list = screen.getByRole('dialog');
    fireEvent.click(within(list).getByText('nova'));
    expect(useRichForm.getState().form.modelKey).toBe('nova');
    fireEvent.click(screen.getByTestId('text-rich-model'));
    fireEvent.click(screen.getByTestId('text-rich-model-auto'));
    expect(useRichForm.getState().form.modelKey).toBeNull();
  });
});

describe('RichDetails', () => {
  it('folds the strength and the spill', { tags: ['scenario'] }, () => {
    render(<RichDetails />);
    expect(screen.queryByLabelText(t('text.rich.strength'))).toBeNull();
    fireEvent.click(screen.getByText(t('text.rich.details')));
    expect(screen.getAllByLabelText(t('text.rich.strength')).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(t('text.rich.spill')).length).toBeGreaterThan(0);
  });
});
