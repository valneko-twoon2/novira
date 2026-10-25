// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useLogo } from '@/state/media/logo';
import { usePacks } from '@/state/media/packs';
import { useTextEditor } from '@/state/text/textEditor';
import { useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { registerLogoFeature } from './register';
import { LogoPanel, LogoResults } from './LogoView';

const initialForm = useLogo.getState().form;
const form = () => useLogo.getState().form;

const logo = (name: string, createdAt: number, extra: Partial<ImageDTO> = {}) =>
  ({
    name,
    url: `/img/${name}.png`,
    thumbnailUrl: `/img/${name}.png`,
    width: 1024,
    height: 512,
    createdAt,
    mediaType: 'image',
    isIntermediate: false,
    metadata: { generationMode: 'logo', positivePrompt: `logo ${name}`, seed: 5 },
    ...extra,
  }) as unknown as ImageDTO;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  registerLogoFeature();
  usePacks.getState().setPack('logo', { state: 'ready' });
  useLogo.setState({ form: { ...initialForm, text: '', style: '', size: 'square', count: 2, randomizeSeed: false, seed: 9 } });
  useGallery.setState({ images: [] });
  useUi.setState({ activeTab: 'generate', media: 'logo' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('logo panel', () => {
  it('shows the assets in the gallery while it is open', () => {
    act(() => useGallery.getState().setView('images'));
    render(<TooltipProvider><LogoPanel /></TooltipProvider>);
    expect(useGallery.getState().view).toBe('assets');
  });

  it('writes the words, style, size and number of candidates into the form', () => {
    render(<TooltipProvider><LogoPanel /></TooltipProvider>);
    fireEvent.change(screen.getByTestId('logo-text'), { target: { value: 'NOVA' } });
    fireEvent.change(screen.getByTestId('logo-style'), { target: { value: 'neon' } });
    fireEvent.click(screen.getByTestId('logo-size-wide'));
    const count = screen.getAllByLabelText(t('logo.countLabel')).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
    fireEvent.change(count, { target: { value: '3' } });
    fireEvent.blur(count);
    expect(form()).toMatchObject({ text: 'NOVA', style: 'neon', size: 'wide', count: 3 });
    expect(screen.getByTestId('logo-size-wide').getAttribute('aria-selected')).toBe('true');
  });

  it('grays out the seed box and the roll button while a new seed is drawn each time, and takes a seed otherwise', () => {
    render(<TooltipProvider><LogoPanel /></TooltipProvider>);
    const box = () => screen.getByLabelText(t('params.seed.label')) as HTMLInputElement;
    const roll = () => screen.getByRole('button', { name: t('params.seed.shuffle') }) as HTMLButtonElement;
    expect(form().randomizeSeed).toBe(false);
    expect([box().disabled, roll().disabled]).toEqual([false, false]);
    fireEvent.change(box(), { target: { value: '321' } });
    fireEvent.blur(box());
    expect(form().seed).toBe(321);
    fireEvent.click(roll());
    expect(form().seed).not.toBe(321);
    fireEvent.click(screen.getByTestId('seed-random'));
    expect(form().randomizeSeed).toBe(true);
    expect([box().disabled, roll().disabled]).toEqual([true, true]);
    fireEvent.click(screen.getByTestId('seed-fixed'));
    expect([box().disabled, roll().disabled]).toEqual([false, false]);
  });
});

describe('logo results', () => {
  it('shows an empty state until a logo exists', () => {
    render(<TooltipProvider><LogoResults /></TooltipProvider>);
    expect(screen.getByText(t('logo.empty.title'))).toBeTruthy();
    expect(screen.queryAllByTestId('logo-card')).toHaveLength(0);
  });

  it('lists only logos, newest first, with size and seed', () => {
    act(() => useGallery.getState().setImages([logo('old', 1), logo('new', 2), logo('photo', 3, { metadata: { generationMode: 'txt2img' } as ImageDTO['metadata'] })]));
    render(<TooltipProvider><LogoResults /></TooltipProvider>);
    const cards = screen.getAllByTestId('logo-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]!.querySelector('img')!.getAttribute('src')).toBe('/img/new.png');
    expect(cards[0]!.textContent).toContain('1024×512 · seed 5');
  });

  it('describes a logo to screen readers by its prompt', () => {
    act(() => useGallery.getState().setImages([logo('a', 1)]));
    render(<TooltipProvider><LogoResults /></TooltipProvider>);
    expect(screen.getByTestId('logo-card').querySelector('img')!.getAttribute('alt')).toBe('logo a');
  });

  it('takes a logo to the Text tab as its background', () => {
    act(() => useGallery.getState().setImages([logo('a', 1)]));
    render(<TooltipProvider><LogoResults /></TooltipProvider>);
    fireEvent.click(screen.getByTestId('logo-lay-text'));
    const scene = useTextEditor.getState().scene;
    expect(scene.background).toEqual({ kind: 'image', imageName: 'a' });
    expect([scene.width, scene.height]).toEqual([1024, 512]);
    expect(useUi.getState().media).toBe('text');
  });

  it('deletes a logo from the backend and the gallery', async () => {
    const del = vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined as never);
    act(() => useGallery.getState().setImages([logo('a', 1), logo('b', 2)]));
    render(<TooltipProvider><LogoResults /></TooltipProvider>);
    fireEvent.click(screen.getAllByRole('button', { name: t('logo.delete') })[0]!);
    expect(del).toHaveBeenCalledWith(['b']);
    await waitFor(() => expect(useGallery.getState().images.map((i) => i.name)).toEqual(['a']));
  });
});
