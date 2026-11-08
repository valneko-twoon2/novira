// @vitest-environment jsdom
// The "finish with AI" form in the left column: looks, the notes about what is missing, the run row and the folded details.
import { cleanup, fireEvent, render as renderBare, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { RICH_FORM_DEFAULTS, useRichForm } from '@/state/text/richForm';
import { newTextLayer, richSourceKey, type TextLayer } from '@/state/text/textModel';
import { TooltipProvider } from '@/ui';
import { RichSection } from './RichSection';
import { useRichRun } from './richRun';

const model = (key: string, type: ModelConfig['type'], base: ModelConfig['base'], name = key): ModelConfig => ({ key, name, base, type, format: 'checkpoint', description: '', path: `${name}.safetensors`, size: 1, source: '' });

function layer(rich: boolean, text = 'NOVIRA'): TextLayer {
  const base = newTextLayer({ width: 400, height: 300 }, 'NOVIRA');
  return {
    ...base,
    text,
    ...(rich ? { rich: { imageName: 'a.png', candidates: ['a.png', 'b.png'], width: 300, height: 100, fontSize: base.style.fontSize, sourceKey: richSourceKey(base) } } : {}),
  };
}

const render = (ui: ReactElement) => renderBare(<TooltipProvider>{ui}</TooltipProvider>);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useRichForm.setState({ form: RICH_FORM_DEFAULTS });
  useRichRun.setState({ running: {} });
  useGallery.setState({ images: [{ name: 'a.png', url: 'http://x/a.png' }, { name: 'b.png', url: 'http://x/b.png' }] as never });
  useModels.setState({ models: [model('wai', 'main', 'sdxl', 'wai'), model('cn', 'controlnet', 'sdxl', 'union-promax')] });
});

describe('RichSection', () => {
  it('shows the seed row of the Generate screen and keeps its choices in the form', () => {
    render(<RichSection layer={layer(false)} />);
    expect(screen.getByText(t('params.seed.label'))).toBeTruthy();
    expect(useRichForm.getState().form.randomSeed).toBe(true);
    fireEvent.click(screen.getByTestId('seed-fixed'));
    expect(useRichForm.getState().form.randomSeed).toBe(false);
    const box = screen.getByRole('spinbutton', { name: t('params.seed.label') });
    fireEvent.change(box, { target: { value: '1234' } });
    fireEvent.blur(box);
    expect(useRichForm.getState().form.seed).toBe(1234);
  });

  it('names the run button as the Generate screen does', () => {
    render(<RichSection layer={layer(false)} />);
    expect(screen.getByTestId('text-rich-run').textContent).toBe(t('params.invoke.invoke'));
  });

  it('chooses a look and unchooses it by pressing it again', () => {
    render(<RichSection layer={layer(false)} />);
    fireEvent.click(screen.getByTestId('text-rich-look-fire'));
    expect(useRichForm.getState().form.look).toBe('fire');
    expect(screen.getByTestId('text-rich-look-fire').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('text-rich-look-fire'));
    expect(useRichForm.getState().form.look).toBeNull();
  });

  it('says nothing about missing parts when a model and a line ControlNet are there', () => {
    render(<RichSection layer={layer(false)} />);
    expect(screen.queryByTestId('text-rich-nomodel')).toBeNull();
    expect(screen.queryByTestId('text-rich-nocontrol')).toBeNull();
    expect((screen.getByTestId('text-rich-run') as HTMLButtonElement).disabled).toBe(false);
  });

  it('notes the missing ControlNet and keeps the button usable', () => {
    useModels.setState({ models: [model('wai', 'main', 'sdxl')] });
    render(<RichSection layer={layer(false)} />);
    expect(screen.getByTestId('text-rich-nocontrol')).toBeTruthy();
    expect((screen.getByTestId('text-rich-run') as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables the button and says why when no model can draw, and for an empty text', () => {
    useModels.setState({ models: [] });
    const { unmount } = render(<RichSection layer={layer(false)} />);
    expect(screen.getByTestId('text-rich-nomodel')).toBeTruthy();
    expect((screen.getByTestId('text-rich-run') as HTMLButtonElement).disabled).toBe(true);
    unmount();
    useModels.setState({ models: [model('wai', 'main', 'sdxl')] });
    render(<RichSection layer={layer(false, '  ')} />);
    expect((screen.getByTestId('text-rich-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the cancel button off until a run is going, then enables it', () => {
    const l = layer(false);
    const { unmount } = render(<RichSection layer={l} />);
    expect((screen.getByTestId('text-rich-cancel') as HTMLButtonElement).disabled).toBe(true);
    unmount();
    useRichRun.setState({ running: { [l.id]: { done: 0, total: 2 } } });
    render(<RichSection layer={l} />);
    expect((screen.getByTestId('text-rich-cancel') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('text-rich-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('waits for a text layer: the form stays, the run is off and the note says what to select', () => {
    render(<RichSection layer={null} />);
    expect((screen.getByTestId('text-rich-run') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(t('text.rich.select'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('text-rich-look-ice'));
    expect(useRichForm.getState().form.look).toBe('ice');
  });

  it('folds the strength and the spill into the details and sets the count', () => {
    render(<RichSection layer={layer(false)} />);
    expect(screen.queryByLabelText(t('text.rich.strength'))).toBeNull();
    fireEvent.click(screen.getByText(t('text.rich.details')));
    expect(screen.getAllByLabelText(t('text.rich.strength')).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(t('text.rich.spill')).length).toBeGreaterThan(0);
    const count = screen.getByLabelText(t('text.rich.count')) as HTMLInputElement;
    fireEvent.change(count, { target: { value: '3' } });
    fireEvent.blur(count);
    expect(useRichForm.getState().form.count).toBe(3);
  });

  it('keeps the chosen model only while it is installed', () => {
    useRichForm.setState({ form: { ...RICH_FORM_DEFAULTS, modelKey: 'gone' } });
    render(<RichSection layer={layer(false)} />);
    expect(screen.getByRole('combobox', { name: 'モデル' }).textContent).toContain('おまかせ');
  });
});
