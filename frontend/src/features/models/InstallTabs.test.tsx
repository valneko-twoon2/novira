// @vitest-environment jsdom
// The install tabs of the model manager (Hugging Face, scan a folder, starter models, URL) and the install queue.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ModelConfig, type ModelInstallJob, type StarterModel } from '@/backend';
import { asBrowserServer } from '@/backend/browserServer.testkit';
import { t } from '@/i18n';
import { usePacks } from '@/state/media/packs';
import { installModel } from '@/state/modelInstall';
import { useModels } from '@/state/models';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { InstallFromSource } from './InstallFromSource';
import { InstallHuggingFace } from './InstallHuggingFace';
import { InstallQueue } from './InstallQueue';
import { InstallScanFolder } from './InstallScanFolder';
import { InstallStarter } from './InstallStarter';

vi.mock('@/state/modelInstall', async (original) => ({ ...(await original<typeof import('@/state/modelInstall')>()), installModel: vi.fn().mockResolvedValue(true) }));

const initial = useModels.getState();
const installed = vi.mocked(installModel);
const ui = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);

beforeEach(() => {
  useModels.setState(initial, true);
  installed.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('InstallHuggingFace', () => {
  const files = ['turbo.safetensors', 'turbo.fp16.safetensors', 'sub/lora.ckpt'];

  it('looks up a repo, lists its files and installs the checked ones', async () => {
    const list = vi.spyOn(backend, 'listHuggingFaceFiles').mockResolvedValue(files);
    ui(<InstallHuggingFace />);
    const input = screen.getByPlaceholderText('stabilityai/sdxl-turbo');
    const lookup = screen.getByText(t('models.install.hfLookup')).closest('button')!;
    expect(lookup.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'not a repo' } });
    fireEvent.click(lookup);
    expect(screen.getByText(t('models.install.hfInvalid'))).toBeTruthy();
    expect(list).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'org/turbo' } });
    fireEvent.click(lookup);
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(3));
    expect(list).toHaveBeenCalledWith('org/turbo');
    expect(screen.queryByText(t('models.install.hfInvalid'))).toBeNull();
    const boxes = screen.getAllByRole('checkbox');
    const installSelected = () => screen.getByText(t('models.install.installSelected', { count: 2 })).closest('button')!;
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[1]!);
    fireEvent.click(boxes[1]!);
    fireEvent.click(boxes[2]!);
    fireEvent.click(installSelected());
    await waitFor(() => expect(installed).toHaveBeenCalledTimes(2));
    expect(installed.mock.calls.map((c) => c[0])).toEqual(['org/turbo::turbo.safetensors', 'org/turbo::sub/lora.ckpt']);
  });

  it('says why the file list could not be read, and lists nothing', async () => {
    vi.spyOn(backend, 'listHuggingFaceFiles').mockRejectedValue(new Error('No Hugging Face repository named org/none'));
    ui(<InstallHuggingFace />);
    fireEvent.change(screen.getByPlaceholderText('stabilityai/sdxl-turbo'), { target: { value: 'org/none' } });
    fireEvent.click(screen.getByText(t('models.install.hfLookup')).closest('button')!);
    await waitFor(() =>
      expect(screen.getByText(t('models.install.hfLookupFailed', { error: 'No Hugging Face repository named org/none' }))).toBeTruthy(),
    );
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('installs every listed file for the whole repo, and only after a lookup', async () => {
    vi.spyOn(backend, 'listHuggingFaceFiles').mockResolvedValue(files);
    ui(<InstallHuggingFace />);
    const repoButton = screen.getByText(t('models.install.hfInstallRepo')).closest('button')!;
    expect(repoButton.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('stabilityai/sdxl-turbo'), { target: { value: 'org/turbo' } });
    fireEvent.click(screen.getByText(t('models.install.hfLookup')).closest('button')!);
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(3));
    fireEvent.click(screen.getByText(t('models.install.hfInstallRepo')));
    expect(installed.mock.calls.map((c) => c[0])).toEqual(files.map((f) => `org/turbo::${f}`));
  });
});

describe('InstallScanFolder', () => {
  const found = [
    { path: 'D:\\m\\a.safetensors', installed: false },
    { path: 'D:\\m\\b.safetensors', installed: true },
    { path: 'D:\\m\\c.safetensors', installed: false },
  ];

  it('scans a folder, filters the files and installs the ones not installed yet', async () => {
    vi.spyOn(backend, 'scanFolder').mockResolvedValue(found);
    useModels.setState({ installJobs: [{ id: 'j', source: 'D:\\m\\c.safetensors', name: 'c', status: 'downloading', bytes: 0, totalBytes: 1 }] });
    ui(<InstallScanFolder />);
    // There is no text box for a path: the folder is chosen in the shell's own dialog.
    expect(screen.queryByTestId('mm-scan-input')).toBeNull();
    fireEvent.click(screen.getByTestId('mm-scan-button'));
    await waitFor(() => expect(screen.getByText(t('models.install.scanResults', { count: 3 }))).toBeTruthy());
    expect(backend.scanFolder).toHaveBeenCalledWith();
    expect(screen.getByText(t('models.install.installed'))).toBeTruthy();
    // The file being downloaded shows its progress (nothing is known of its size yet: 0 %).
    expect(screen.getByTestId('install-state-progress')).toBeTruthy();

    fireEvent.click(screen.getByText(t('models.install.install')));
    expect(installed).toHaveBeenLastCalledWith('D:\\m\\a.safetensors');
    fireEvent.click(screen.getByText(t('models.install.installAll')));
    expect(installed).toHaveBeenCalledTimes(2);

    fireEvent.change(screen.getByLabelText(t('common.search')), { target: { value: 'b.' } });
    expect(screen.queryByText('D:\\m\\a.safetensors')).toBeNull();
    expect((screen.getByText(t('models.install.installAll')).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('says why a scan failed and lists nothing', async () => {
    vi.spyOn(backend, 'scanFolder').mockRejectedValue(new Error('the folder cannot be read'));
    ui(<InstallScanFolder />);
    fireEvent.click(screen.getByTestId('mm-scan-button'));
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'error', title: t('models.install.scanFailed'), description: 'the folder cannot be read' }));
    expect(screen.queryByText(t('models.install.scanResults', { count: 0 }))).toBeNull();
  });

  it('says a folder is scanned in the desktop app when the page is on the browser server', () => {
    asBrowserServer();
    const scan = vi.spyOn(backend, 'scanFolder');
    ui(<InstallScanFolder />);
    expect(screen.getByTestId('mm-scan-desktop-only').textContent).toBe(t('common.desktopOnly'));
    expect(screen.queryByTestId('mm-scan-button')).toBeNull();
    expect(scan).not.toHaveBeenCalled();
  });
});

describe('InstallStarter', () => {
  beforeEach(() => {
    const missing = { state: 'missing', totalBytes: 1e9 } as const;
    usePacks.setState({ packs: { video: missing, turbo: missing, music: missing, voice: missing, inpaint: missing, logo: missing } });
    vi.spyOn(backend, 'installPack').mockResolvedValue(undefined);
  });

  const starters: StarterModel[] = [
    { id: 's1', name: 'Base One', base: 'sd-1', type: 'main', description: 'first', source: 'src/one' },
    { id: 's2', name: 'Fast XL', base: 'sdxl', type: 'main', description: 'quick', source: 'src/two', dependencies: ['VAE A', 'VAE B'] },
    { id: 's3', name: 'Done XL', base: 'sdxl', type: 'vae', description: 'ready', source: 'src/three' },
  ];
  const model = (source: string): ModelConfig => ({ key: source, name: source, base: 'sdxl', type: 'vae', format: 'diffusers', description: '', path: '', size: 0, source });

  it('lists the starter models with their dependencies and installs one, or a whole bundle', async () => {
    vi.spyOn(backend, 'listStarterModels').mockResolvedValue(starters);
    useModels.setState({ models: [model('src/three')] });
    ui(<InstallStarter />);
    await waitFor(() => expect(screen.getAllByTestId('mm-starter')).toHaveLength(3));
    expect(screen.getByText(t('models.starter.dependencies', { list: 'VAE A, VAE B' }))).toBeTruthy();
    expect(screen.getByText(t('models.install.installed'))).toBeTruthy();

    fireEvent.click(within(screen.getAllByTestId('mm-starter')[0]!).getByText(t('models.install.install')));
    expect(installed).toHaveBeenLastCalledWith('src/one', 'Base One');
    // A bundle is offered for the family picked on the left.
    expect(screen.queryByText(t('models.starter.bundle', { base: 'SDXL' }))).toBeNull();
    fireEvent.click(screen.getByTestId('mm-starter-family-sdxl'));
    expect(screen.getAllByTestId('mm-starter')).toHaveLength(2);
    fireEvent.click(screen.getByText(t('models.starter.bundle', { base: 'SDXL' })));
    expect(installed).toHaveBeenLastCalledWith('src/two', 'Fast XL');
    // Nothing is left to install for SD1.X once its one model is installing.
    useModels.setState({ models: [model('src/three'), model('src/one')] });
    fireEvent.click(screen.getByTestId('mm-starter-family-sd-1'));
    expect((screen.getByText(t('models.starter.bundle', { base: 'SD1.X' })).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('sorts the models and the model packs by purpose and family, and counts each choice', async () => {
    const list: StarterModel[] = [
      { id: 'anima', name: 'Anima Base', base: 'anima', type: 'diffusion_model', description: '', source: 'a', dependencies: ['enc'] },
      { id: 'enc', name: 'qwen encoder', base: 'any', type: 'text_encoder', description: '', source: 'e' },
      { id: 'up', name: '4x-UltraSharp', base: 'any', type: 'spandrel_image_to_image', description: '', source: 'u' },
      { id: 'wan', name: 'Wan 2.1', base: 'wan', type: 'diffusion_model', description: '', source: 'w' },
    ];
    vi.spyOn(backend, 'listStarterModels').mockResolvedValue(list);
    usePacks.setState({ packs: { ...usePacks.getState().packs, logo: { state: 'missing', totalBytes: 6e9 }, video: { state: 'ready' } } });
    ui(<InstallStarter />);
    await waitFor(() => expect(screen.getAllByTestId('mm-starter')).toHaveLength(4));
    // Every pack is listed beside the models: an installed one says so, a missing one offers its install.
    expect(screen.getAllByTestId('mm-starter-pack')).toHaveLength(6);
    expect(within(screen.getByTestId('mm-starter-purpose-logo')).getByText('1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mm-starter-purpose-logo'));
    expect(screen.queryAllByTestId('mm-starter')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('mm-starter-pack-install-logo'));
    expect(backend.installPack).toHaveBeenCalledWith('logo');
    // Video: the Wan model and the two video packs.
    fireEvent.click(screen.getByTestId('mm-starter-purpose-video'));
    expect(screen.getAllByTestId('mm-starter')).toHaveLength(1);
    expect(screen.getAllByTestId('mm-starter-pack')).toHaveLength(2);
    expect(within(screen.getAllByTestId('mm-starter-pack')[0]!).getByTestId('install-state-installed')).toBeTruthy();
    // Anima: its model and the encoder it needs; the upscaler belongs to no family.
    fireEvent.click(screen.getByTestId('mm-starter-purpose-all'));
    fireEvent.click(screen.getByTestId('mm-starter-family-anima'));
    expect(screen.getAllByTestId('mm-starter').map((r) => r.querySelector('.mm-item__name')?.textContent)).toEqual(['Anima Base', 'qwen encoder']);
    expect(screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual([t('models.starter.purpose.picture'), t('models.starter.purpose.parts')]);
    // A purpose with nothing in the family is left out.
    expect(screen.queryByTestId('mm-starter-purpose-upscale')).toBeNull();
    expect(screen.getByTestId('mm-starter-purpose-parts')).toBeTruthy();
  });

  it('searches by name, description, base and type, and says when nothing matches', async () => {
    vi.spyOn(backend, 'listStarterModels').mockResolvedValue(starters);
    ui(<InstallStarter />);
    await waitFor(() => expect(screen.getAllByTestId('mm-starter')).toHaveLength(3));
    const search = screen.getByLabelText(t('models.starter.search'));
    fireEvent.change(search, { target: { value: 'quick' } });
    expect(screen.getAllByTestId('mm-starter')).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'vae' } });
    expect(screen.getAllByTestId('mm-starter')).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText(t('models.noMatch'))).toBeTruthy();
  });

  it('shows a spinner while the list loads', () => {
    vi.spyOn(backend, 'listStarterModels').mockReturnValue(new Promise(() => {}));
    ui(<InstallStarter />);
    expect(document.querySelector('.mm-loading')).toBeTruthy();
  });
});

describe('InstallFromSource', () => {
  it('installs what was typed and clears the box; empty input does nothing', async () => {
    ui(<InstallFromSource />);
    const input = screen.getByTestId('mm-source-input') as HTMLInputElement;
    fireEvent.submit(input.closest('form')!);
    expect(installed).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'https://example.com/m.safetensors' } });
    fireEvent.click(screen.getByTestId('mm-source-install'));
    await waitFor(() => expect(input.value).toBe(''));
    expect(installed).toHaveBeenCalledWith('https://example.com/m.safetensors');
  });

  it('keeps the text when the install did not start', async () => {
    installed.mockResolvedValueOnce(false);
    ui(<InstallFromSource />);
    const input = screen.getByTestId('mm-source-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://example.com/typo.safetensors' } });
    fireEvent.click(screen.getByTestId('mm-source-install'));
    await waitFor(() => expect(installed).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((screen.getByTestId('mm-source-install') as HTMLButtonElement).disabled).toBe(false));
    expect(input.value).toBe('https://example.com/typo.safetensors');
  });

  it('points a path on this PC to Scan Folder instead of sending it', () => {
    ui(<InstallFromSource />);
    const input = screen.getByTestId('mm-source-input') as HTMLInputElement;
    for (const path of ['C:\\models\\m.safetensors', 'd:/m.safetensors', '\\\\nas\\models\\m.safetensors', '/home/me/m.safetensors']) {
      fireEvent.change(input, { target: { value: path } });
      expect(screen.getByTestId('mm-source-local').textContent, path).toBe(t('models.install.localPath'));
      expect((screen.getByTestId('mm-source-install') as HTMLButtonElement).disabled).toBe(true);
      fireEvent.submit(input.closest('form')!);
    }
    expect(installed).not.toHaveBeenCalled();
    // Addresses and the backend's own references are not paths.
    for (const source of ['https://example.com/m.safetensors', 'org/repo::m.safetensors', 'C:model']) {
      fireEvent.change(input, { target: { value: source } });
      expect(screen.queryByTestId('mm-source-local'), source).toBeNull();
    }
  });
});

describe('InstallQueue', () => {
  const job = (over: Partial<ModelInstallJob>): ModelInstallJob => ({ id: 'j1', source: 'src', name: 'Model', status: 'downloading', bytes: 512, totalBytes: 1024, ...over });

  it('says when the queue is empty', () => {
    ui(<InstallQueue />);
    expect(screen.getByText(t('models.queue.empty'))).toBeTruthy();
    expect((screen.getByText(t('models.queue.prune')).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists each job with its progress and error, cancels active ones and prunes finished ones', () => {
    const cancel = vi.spyOn(backend, 'cancelInstall').mockResolvedValue(undefined);
    useModels.setState({
      installJobs: [
        job({}),
        job({ id: 'j2', status: 'waiting' }),
        job({ id: 'j3', status: 'completed' }),
        job({ id: 'j4', status: 'error', error: 'disk full', bytes: 0 }),
        job({ id: 'j5', status: 'cancelled', totalBytes: 0 }),
        job({ id: 'j6', status: 'running' }),
      ],
    });
    ui(<InstallQueue />);
    expect(screen.getByText('disk full')).toBeTruthy();
    const buttons = screen.getAllByLabelText(t('models.queue.cancel')) as HTMLButtonElement[];
    expect(buttons.map((b) => b.disabled)).toEqual([false, false, true, true, true, false]);
    fireEvent.click(buttons[0]!);
    expect(cancel).toHaveBeenCalledWith('j1');
    fireEvent.click(screen.getByText(t('models.queue.prune')));
    expect(useModels.getState().installJobs.map((j) => j.id)).toEqual(['j1', 'j2', 'j6']);
  });
});
