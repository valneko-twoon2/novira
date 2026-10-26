// @vitest-environment jsdom
// The prompt boxes of the Generate panel: typing, the recommended prompts, the prompt book, describing a picture and presets.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useCaptionDialog } from '@/state/dialogs/caption';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { usePromptBook } from '@/state/prompts/promptBook';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { PromptBoxes } from './PromptBox';

const initial = {
  params: useParams.getState(),
  gallery: useGallery.getState(),
  models: useModels.getState(),
  book: usePromptBook.getState(),
  caption: useCaptionDialog.getState(),
  toasts: useToasts.getState(),
  ui: useUi.getState(),
};
const picture = (name: string, mediaType: 'image' | 'video' = 'image') => ({ name, mediaType, url: `blob:${name}`, thumbnailUrl: `blob:${name}`, width: 1, height: 1 }) as never;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useParams.setState({ ...initial.params, positivePrompt: '', negativePrompt: '' }, true);
  useGallery.setState({ ...initial.gallery, images: [picture('a.png'), picture('v.mp4', 'video')], selection: [] }, true);
  useModels.setState(initial.models, true);
  usePromptBook.setState({ ...initial.book, open: false }, true);
  useCaptionDialog.setState(initial.caption, true);
  useToasts.setState(initial.toasts, true);
  useUi.setState(initial.ui, true);
  render(
    <TooltipProvider>
      <PromptBoxes />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the prompt boxes', () => {
  it('writes what is typed into each prompt', () => {
    fireEvent.change(screen.getByTestId('positive-prompt'), { target: { value: 'a cat' } });
    fireEvent.change(screen.getByTestId('negative-prompt'), { target: { value: 'blurry' } });
    expect(useParams.getState()).toMatchObject({ positivePrompt: 'a cat', negativePrompt: 'blurry' });
  });

  it('focuses the positive prompt when asked from elsewhere', () => {
    expect(document.activeElement).not.toBe(screen.getByTestId('positive-prompt'));
    act(() => useUi.setState({ focusPromptNonce: 5 }));
    expect(document.activeElement).toBe(screen.getByTestId('positive-prompt'));
  });

  it('applies the recommended prompts and says so', () => {
    fireEvent.click(screen.getByTestId('prompt-recommended'));
    expect(useToasts.getState().toasts.at(-1)?.title).toBe(t('params.prompt.recommendedApplied'));
  });

  it('edits both prompts in the big editor, and closes it', async () => {
    fireEvent.click(screen.getByTestId('prompt-expand'));
    fireEvent.change(screen.getByTestId('big-positive'), { target: { value: 'long positive' } });
    fireEvent.change(screen.getByTestId('big-negative'), { target: { value: 'long negative' } });
    expect(useParams.getState()).toMatchObject({ positivePrompt: 'long positive', negativePrompt: 'long negative' });
    fireEvent.click(screen.getByLabelText(t('common.close')));
    await waitFor(() => expect(screen.queryByTestId('big-positive')).toBeNull());
  });

  it('switches each prompt between its text and its tags with two buttons, the active one marked', () => {
    for (const kind of ['positive', 'negative'] as const) {
      const text = screen.getByTestId(`${kind}-text-view`);
      const tags = screen.getByTestId(`${kind}-tag-view`);
      expect([text.getAttribute('aria-pressed'), tags.getAttribute('aria-pressed')]).toEqual(['true', 'false']);
      fireEvent.click(tags);
      expect(screen.getByTestId(`${kind}-tags`)).toBeTruthy();
      expect([text.getAttribute('aria-pressed'), tags.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
      fireEvent.click(text);
      expect(screen.queryByTestId(`${kind}-tags`)).toBeNull();
    }
  });

  it('has the dynamic prompts button on the negative prompt too, lit when it uses the syntax', () => {
    expect(screen.getByTestId('dynamic-prompts')).toBeTruthy();
    const negative = screen.getByTestId('dynamic-prompts-negative');
    expect(negative.getAttribute('data-active')).not.toBe('true');
    act(() => useParams.setState({ negativePrompt: 'bad {hands|feet}' }));
    expect(screen.getByTestId('dynamic-prompts-negative').className).toMatch(/active/);
  });

  it('opens the prompt book for either prompt', () => {
    fireEvent.click(screen.getByTestId('negative-open-book'));
    expect(usePromptBook.getState()).toMatchObject({ open: true, target: 'negative' });
    fireEvent.click(screen.getByTestId('positive-open-book'));
    expect(usePromptBook.getState().target).toBe('positive');
  });
});

describe('describing a picture', () => {
  it('opens on the picture selected in the gallery, but not on a video or several', () => {
    fireEvent.click(screen.getByTestId('prompt-caption'));
    expect(useCaptionDialog.getState().imageName).toBeNull();
    act(() => useGallery.setState({ selection: ['a.png'] }));
    fireEvent.click(screen.getByTestId('prompt-caption'));
    expect(useCaptionDialog.getState().imageName).toBe('a.png');
    act(() => useCaptionDialog.getState().close());
    act(() => useGallery.setState({ selection: ['v.mp4'] }));
    fireEvent.click(screen.getByTestId('prompt-caption'));
    expect(useCaptionDialog.getState().imageName).toBeNull();
  });

  it('opens on a picture dropped on the button, and uploads a dropped file first', async () => {
    const zone = screen.getByTestId('prompt-caption').closest('.pp-prompt__caption')!;
    fireEvent.drop(zone, { dataTransfer: { types: ['application/x-novira-images'], files: [], getData: () => JSON.stringify(['a.png']) } });
    await waitFor(() => expect(useCaptionDialog.getState().imageName).toBe('a.png'));
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(picture('up.png'));
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file], getData: () => '' } });
    await waitFor(() => expect(useCaptionDialog.getState().imageName).toBe('up.png'));
    expect(upload).toHaveBeenCalled();
    expect(useGallery.getState().images.some((i) => i.name === 'up.png')).toBe(true);
  });
});
