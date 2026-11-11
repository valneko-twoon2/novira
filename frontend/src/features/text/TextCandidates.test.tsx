// @vitest-environment jsdom
// The candidates strip under the canvas: the list of the selected text layer, the pick, the stale notice and the way back to the plain fill.
import { cleanup, fireEvent, render as renderBare, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { RICH_FORM_DEFAULTS, useRichForm } from '@/state/text/richForm';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE, newBubbleLayer, newTextLayer, richSourceKey, type Layer, type TextLayer } from '@/state/text/textModel';
import { TooltipProvider } from '@/ui';
import { TextCandidates } from './TextCandidates';
import { useRichRun } from './richRun';

const model = (key: string, type: ModelConfig['type'], base: ModelConfig['base']): ModelConfig => ({ key, name: key, base, type, format: 'checkpoint', description: '', path: `${key}.safetensors`, size: 1, source: '' });

function layer(rich: boolean, text = 'NOVIRA'): TextLayer {
  const base = newTextLayer({ width: 400, height: 300 }, 'NOVIRA');
  return {
    ...base,
    text,
    ...(rich ? { rich: { imageName: 'a.png', candidates: ['a.png', 'b.png'], width: 300, height: 100, fontSize: base.style.fontSize, sourceKey: richSourceKey(base) } } : {}),
  };
}

/** Puts the layer in the editor, selected. */
function select(l: Layer) {
  useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [l] }, selectedId: l.id });
}

const render = (ui: ReactElement) => renderBare(<TooltipProvider>{ui}</TooltipProvider>);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  useRichForm.setState({ form: RICH_FORM_DEFAULTS });
  useRichRun.setState({ running: {} });
  useGallery.setState({ images: [{ name: 'a.png', url: 'http://x/a.png' }, { name: 'b.png', url: 'http://x/b.png' }] as never });
  useModels.setState({ models: [model('wai', 'main', 'sdxl'), model('cn', 'controlnet', 'sdxl')] });
  useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [] }, selectedId: null, past: [], future: [] });
});

describe('TextCandidates', () => {
  it('shows nothing for nothing selected, a plain layer and a bubble', { tags: ['equivalence'] }, () => {
    expect(render(<TextCandidates />).container.firstChild).toBeNull();
    cleanup();
    select(layer(false));
    expect(render(<TextCandidates />).container.firstChild).toBeNull();
    cleanup();
    select(newBubbleLayer({ width: 400, height: 300 }, 'round', 'hi'));
    expect(render(<TextCandidates />).container.firstChild).toBeNull();
  });

  it('lists the candidates of the selected layer with the chosen one pressed', { tags: ['scenario'] }, () => {
    select(layer(true));
    render(<TextCandidates />);
    const items = screen.getAllByTestId('text-rich-candidate');
    expect(items).toHaveLength(2);
    expect(items[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(items[1]!.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByTestId('text-rich-stale')).toBeNull();
  });

  it('shows each candidate by its thumbnail, and by its picture when it has none', { tags: ['condition'] }, () => {
    useGallery.setState({ images: [{ name: 'a.png', url: 'http://x/a.png', thumbnailUrl: 'http://x/thumb/a.png' }, { name: 'b.png', url: 'http://x/b.png', thumbnailUrl: '' }] as never });
    select(layer(true));
    render(<TextCandidates />);
    const srcs = screen.getAllByTestId('text-rich-candidate').map((b) => b.querySelector('img')?.getAttribute('src'));
    expect(srcs).toEqual(['http://x/thumb/a.png', 'http://x/b.png']);
  });

  it('offers a new run when the lettering changed since the picture was made', { tags: ['condition'] }, () => {
    select({ ...layer(true), text: 'changed' });
    render(<TextCandidates />);
    expect(screen.getByTestId('text-rich-stale')).toBeTruthy();
    expect((screen.getByTestId('text-rich-redo') as HTMLButtonElement).disabled).toBe(false);
  });

  it('turns the redo off for an empty text and while a run is going', { tags: ['decision-table'] }, () => {
    select({ ...layer(true), text: '  ' });
    render(<TextCandidates />);
    expect((screen.getByTestId('text-rich-redo') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const changed = { ...layer(true), text: 'changed' };
    select(changed);
    useRichRun.setState({ running: { [changed.id]: { done: 0, total: 2 } } });
    render(<TextCandidates />);
    expect((screen.getByTestId('text-rich-redo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('goes back to the plain fill and removes the strip', { tags: ['scenario'] }, () => {
    select(layer(true));
    const { container } = render(<TextCandidates />);
    fireEvent.click(screen.getByTestId('text-rich-clear'));
    expect((useTextEditor.getState().scene.layers[0] as TextLayer).rich).toBeUndefined();
    expect(container.firstChild).toBeNull();
  });
});
