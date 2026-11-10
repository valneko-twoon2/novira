// @vitest-environment jsdom
// The prompt boxes of the Generate panel: typing, the recommended prompts, the prompt book, describing a picture and presets.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { usePromptBook } from '@/state/prompts/promptBook';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { PromptBoxes } from './PromptBox';

vi.mock('@/state/imageTools/actions', () => ({ quickRunTool: vi.fn() }));
import { quickRunTool } from '@/state/imageTools/actions';

const initial = {
  params: useParams.getState(),
  gallery: useGallery.getState(),
  models: useModels.getState(),
  book: usePromptBook.getState(),
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
  vi.mocked(quickRunTool).mockClear();
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

  it('adds the recommended words to the prompt whose button is pressed, and says so', () => {
    fireEvent.click(screen.getByTestId('negative-recommended'));
    expect(useParams.getState().negativePrompt).not.toBe('');
    expect(useParams.getState().positivePrompt).toBe('');
    expect(useToasts.getState().toasts.at(-1)?.title).toBe(t('params.prompt.recommendedApplied'));
    fireEvent.click(screen.getByTestId('positive-recommended'));
    expect(useParams.getState().positivePrompt).not.toBe('');
  });

  it('keeps the section header to its title: the buttons sit in each prompt\'s own heading', () => {
    const header = screen.getByTestId('prompts').querySelector('.ui-section__header')!;
    expect(header.querySelectorAll('button')).toHaveLength(1);
    for (const kind of ['positive', 'negative']) {
      const head = screen.getByTestId(`${kind}-prompt`).closest('.pp-prompt')!.querySelector('.pp-prompt__head')!;
      expect(head.querySelector(`[data-testid="${kind}-recommended"]`)).toBeTruthy();
      expect(head.querySelector(`[data-testid="${kind}-expand"]`)).toBeNull();
      expect(screen.getByTestId(`${kind}-prompt`).closest('.pp-prompt__body')!.querySelector(`[data-testid="${kind}-expand"]`)).toBeTruthy();
    }
  });

  it('edits both prompts in the big editor, and closes it', async () => {
    fireEvent.click(screen.getByTestId('positive-expand'));
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
  it('describes the picture selected in the gallery at once, or asks for a file when none or a video is selected', () => {
    const fileInput = screen.getByTestId('prompt-caption-file') as HTMLInputElement;
    const pick = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByTestId('prompt-caption'));
    expect(pick).toHaveBeenCalledTimes(1);
    act(() => useGallery.setState({ selection: ['a.png'] }));
    fireEvent.click(screen.getByTestId('prompt-caption'));
    expect(quickRunTool).toHaveBeenLastCalledWith('caption', 'a.png');
    act(() => useGallery.setState({ selection: ['v.mp4'] }));
    fireEvent.click(screen.getByTestId('prompt-caption'));
    expect(pick).toHaveBeenCalledTimes(2);
    expect(quickRunTool).toHaveBeenCalledTimes(1);
  });

  it('describes a picture dropped on the button, and uploads a dropped or picked file first', async () => {
    const zone = screen.getByTestId('prompt-caption').closest('.pp-prompt__caption')!;
    fireEvent.drop(zone, { dataTransfer: { types: ['application/x-novira-images'], files: [], getData: () => JSON.stringify(['a.png']) } });
    await waitFor(() => expect(quickRunTool).toHaveBeenLastCalledWith('caption', 'a.png'));
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(picture('up.png'));
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file], getData: () => '' } });
    await waitFor(() => expect(quickRunTool).toHaveBeenLastCalledWith('caption', 'up.png'));
    expect(upload).toHaveBeenCalled();
    expect(useGallery.getState().images.some((i) => i.name === 'up.png')).toBe(true);
    upload.mockResolvedValue(picture('picked.png'));
    const input = screen.getByTestId('prompt-caption-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(quickRunTool).toHaveBeenLastCalledWith('caption', 'picked.png'));
  });

  it('says so when the file cannot be uploaded, and describes nothing', async () => {
    vi.spyOn(backend, 'uploadImage').mockRejectedValue(new Error('too large'));
    const input = screen.getByTestId('prompt-caption-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'x.png', { type: 'image/png' })], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'error', title: t('gallery.tools.uploadFailed'), description: 'too large' }));
    expect(quickRunTool).not.toHaveBeenCalled();
  });
});
