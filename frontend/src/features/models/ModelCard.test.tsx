// @vitest-environment jsdom
// The model card's license tag: shown on the cover when the license is known, opens the license list without selecting the card.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useModelUpdates } from '@/state/modelUpdates';
import { ModelCard } from './ModelCard';

const model: ModelConfig = {
  key: 'm1',
  name: 'Sunny XL',
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: '',
  path: 'models/sunny.safetensors',
  size: 6 * 1024 ** 3,
  source: 'https://civitai.com/models/1',
};

const licensed: ModelConfig = {
  ...model,
  license: {
    site: 'civitai',
    commercial: 'limited',
    permissions: [
      { key: 'sellImages', allowed: false },
      { key: 'generationServices', allowed: true },
    ],
  },
};

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  // The mock cover pictures are drawn on a canvas.
  canvases = installRecordingCanvases();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  canvases.restore();
  vi.unstubAllGlobals();
});

function show(m: ModelConfig) {
  const onSelect = vi.fn();
  render(<ModelCard model={m} selected={false} favorite={false} onSelect={onSelect} onToggleFavorite={vi.fn()} onDelete={vi.fn()} />);
  return { onSelect };
}

describe('ModelCard format tag', { tags: [] }, () => {
  const tags = () => [...document.querySelectorAll('.mm-card-item__badges .mm-tag')].map((e) => e.textContent);

  it('tags a main model with its single-file format', { tags: ['equivalence'] }, () => {
    show(model);
    expect(tags()).toEqual(['SDXL', 'Checkpoint']);
  });

  it('leaves the plain single-file format off a diffusion model, so it is not read as a checkpoint', { tags: ['condition'] }, () => {
    show({ ...model, type: 'diffusion_model', base: 'anima' });
    expect(tags()).toEqual(['Anima']);
  });

  it('still tags a format that says something, on any type', { tags: ['condition'] }, () => {
    show({ ...model, type: 'diffusion_model', base: 'flux', format: 'gguf' });
    expect(tags()).toEqual(['FLUX', 'GGUF']);
  });
});

describe('ModelCard license tag', { tags: [] }, () => {
  it('shows the commercial-use tag on the cover, named for screen readers, when the license is known', { tags: ['equivalence'] }, () => {
    show(licensed);
    const tag = screen.getByTestId('commercial-tag');
    expect(tag.closest('.mm-card-item__media')).toBeTruthy();
    expect(tag.getAttribute('data-commercial')).toBe('limited');
    expect(tag.textContent).toBe(t('browse.commercial.limited'));
    expect(tag.getAttribute('aria-label')).toBe(t('models.card.license', { use: t('browse.commercial.limited') }));
  });

  it('shows no tag when the license is not known', { tags: ['condition'] }, () => {
    show(model);
    expect(screen.queryByTestId('commercial-tag')).toBeNull();
  });

  it('opens the list of what the license allows, without selecting the card', { tags: ['scenario'] }, () => {
    const { onSelect } = show(licensed);
    fireEvent.click(screen.getByTestId('commercial-tag'));
    const rows = [...document.querySelectorAll('[data-permission]')];
    expect(rows.map((r) => [r.getAttribute('data-permission'), r.getAttribute('data-allowed')])).toEqual([
      ['sellImages', 'no'],
      ['generationServices', 'yes'],
    ]);
    fireEvent.click(screen.getByTestId('commercial-permissions'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('is reached by the keyboard: Enter on the tag opens the list and does not select the card', { tags: ['scenario'] }, () => {
    const { onSelect } = show(licensed);
    const tag = screen.getByTestId('commercial-tag');
    tag.focus();
    expect(document.activeElement).toBe(tag);
    fireEvent.keyDown(tag, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
    // A button's Enter becomes a click in the browser.
    fireEvent.click(tag);
    expect(screen.getByTestId('commercial-permissions')).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('ModelCard structure', { tags: [] }, () => {
  it(
    'is a group named by the model with one select button, whose pressed state follows the selection',
    { tags: ['state-transition'] },
    () => {
      const onSelect = vi.fn();
      const { rerender } = render(<ModelCard model={model} selected={false} favorite={false} onSelect={onSelect} onToggleFavorite={vi.fn()} onDelete={vi.fn()} />);
      const card = screen.getByRole('group', { name: 'Sunny XL' });
      const select = card.querySelector('.mm-card-item__select') as HTMLButtonElement;
      expect(select.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(select);
      expect(onSelect).toHaveBeenCalledOnce();
      rerender(<ModelCard model={model} selected favorite={false} onSelect={onSelect} onToggleFavorite={vi.fn()} onDelete={vi.fn()} />);
      expect(select.getAttribute('aria-pressed')).toBe('true');
      expect(card.className).toContain('is-selected');
    },
  );

  it('keeps the star, the menu and the license tag out of the card select button', { tags: ['condition'] }, () => {
    const onSelect = vi.fn();
    const onToggleFavorite = vi.fn();
    render(<ModelCard model={licensed} selected={false} favorite={false} onSelect={onSelect} onToggleFavorite={onToggleFavorite} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: t('models.card.favorite') }));
    expect(onToggleFavorite).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId('commercial-tag'));
    expect(onSelect).not.toHaveBeenCalled();
    // No interactive element sits inside another one: the only button holding other things is none.
    const select = document.querySelector('.mm-card-item__select')!;
    expect(select.children).toHaveLength(0);
  });
});

describe('the update tag', { tags: [] }, () => {
  const update = { key: 'm1', modelId: '1', installedVersionId: '2', latestVersionId: '3', latestName: 'v3', publishedAt: 0, pageUrl: 'https://civitai.com/models/1?modelVersionId=3' };
  afterEach(() => useModelUpdates.setState({ updates: [] }));

  it('is shown on the card of a model that has a newer version, and on no other', { tags: ['condition'] }, () => {
    useModelUpdates.setState({ updates: [update] });
    const { rerender } = render(<ModelCard model={model} selected={false} favorite={false} onSelect={vi.fn()} onToggleFavorite={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId('mm-update-tag').textContent).toBe(t('models.updates.tag'));
    rerender(<ModelCard model={{ ...model, key: 'other' }} selected={false} favorite={false} onSelect={vi.fn()} onToggleFavorite={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByTestId('mm-update-tag')).toBeNull();
  });

  it('is not shown without an update', { tags: ['condition'] }, () => {
    render(<ModelCard model={model} selected={false} favorite={false} onSelect={vi.fn()} onToggleFavorite={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByTestId('mm-update-tag')).toBeNull();
  });
});
