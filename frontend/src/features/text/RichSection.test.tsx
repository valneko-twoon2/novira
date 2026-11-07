// @vitest-environment jsdom
// The "finish with AI" section: looks, the notes about what is missing, and the candidates of a layer.
import { cleanup, fireEvent, render as renderBare, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
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

  it('shows no candidates for a plain layer and the list for one with an AI fill', () => {
    const { unmount } = render(<RichSection layer={layer(false)} />);
    expect(screen.queryAllByTestId('text-rich-candidate')).toHaveLength(0);
    expect(screen.queryByTestId('text-rich-clear')).toBeNull();
    unmount();
    render(<RichSection layer={layer(true)} />);
    const items = screen.getAllByTestId('text-rich-candidate');
    expect(items).toHaveLength(2);
    expect(items[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(items[1]!.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByTestId('text-rich-stale')).toBeNull();
  });

  it('offers a new run when the lettering changed since the picture was made', () => {
    render(<RichSection layer={{ ...layer(true), text: 'changed' }} />);
    expect(screen.getByTestId('text-rich-stale')).toBeTruthy();
    expect(screen.getByTestId('text-rich-redo')).toBeTruthy();
  });

  it('shows the running state with a cancel button', () => {
    const l = layer(false);
    useRichRun.setState({ running: { [l.id]: { done: 0, total: 2 } } });
    render(<RichSection layer={l} />);
    expect(screen.getByTestId('text-rich-cancel')).toBeTruthy();
    expect((screen.getByTestId('text-rich-run') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the chosen model only while it is installed', () => {
    useRichForm.setState({ form: { ...RICH_FORM_DEFAULTS, modelKey: 'gone' } });
    render(<RichSection layer={layer(false)} />);
    expect(screen.getByRole('combobox', { name: 'モデル' }).textContent).toContain('おまかせ');
  });
});
