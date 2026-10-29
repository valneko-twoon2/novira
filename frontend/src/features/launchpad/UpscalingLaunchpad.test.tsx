// @vitest-environment jsdom
// The Upscaling launchpad (drop the picture, open the settings and the models, the missing upscaler warning) and the
// switch that picks the launchpad page of each tab.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { IMAGE_MIME } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { TABS, useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { Launchpad } from './Launchpad';
import { UpscalingLaunchpad } from './UpscalingLaunchpad';

const initial = { models: useModels.getState(), params: useParams.getState(), gallery: useGallery.getState(), ui: useUi.getState() };
const picture = { name: 'pic', url: '/img/pic.png', thumbnailUrl: '/img/pic-t.png', width: 800, height: 600, createdAt: 1 } as unknown as ImageDTO;
const upscaler = { key: 'up1', name: 'Upscaler', type: 'spandrel_image_to_image', base: 'any' } as never;
const show = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);
const initialImage = () => useParams.getState().upscale.initialImage;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useModels.setState({ ...initial.models, models: [upscaler] }, true);
  useParams.setState(initial.params, true);
  useGallery.setState({ ...initial.gallery, images: [picture] }, true);
  useUi.setState({ ...initial.ui, activeTab: 'upscaling', leftPanelOpen: false }, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UpscalingLaunchpad', () => {
  it('asks for a picture, and offers no warning when an upscaler is installed', () => {
    show(<UpscalingLaunchpad />);
    expect(screen.getByText(t('params.launchpad.upscaling.dropTitle'))).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes a dropped gallery picture and then shows its size', async () => {
    show(<UpscalingLaunchpad />);
    const zone = screen.getByText(t('params.launchpad.upscaling.dropTitle')).closest('.ui-dropzone')!;
    const data: Record<string, string> = { [IMAGE_MIME]: JSON.stringify(['pic']) };
    fireEvent.drop(zone, { dataTransfer: { types: [IMAGE_MIME], getData: (k: string) => data[k] ?? '', files: [] } });
    await waitFor(() => expect(initialImage()).toMatchObject({ name: 'pic' }));
    expect(screen.getByText(t('params.launchpad.upscaling.readyTitle', { width: 800, height: 600 }))).toBeTruthy();
    expect(screen.getByTestId('lp-upscale-drop').querySelector('img')?.getAttribute('src')).toBe('/img/pic-t.png');
  });

  it('opens the settings panel and the models tab from its cards', () => {
    show(<UpscalingLaunchpad />);
    fireEvent.click(screen.getByText(t('params.launchpad.upscaling.settingsTitle')));
    expect(useUi.getState().leftPanelOpen).toBe(true);
    fireEvent.click(screen.getByText(t('params.launchpad.upscaling.modelsTitle')));
    expect(useUi.getState().activeTab).toBe('models');
  });

  it('warns when no upscaler is installed, and the button opens the models tab', () => {
    useModels.setState({ models: [{ key: 'm', name: 'M', type: 'main', base: 'sdxl' } as never] });
    show(<UpscalingLaunchpad />);
    expect(screen.getByRole('alert').textContent).toContain(t('params.upscale.missingUpscaler'));
    fireEvent.click(screen.getByRole('button', { name: t('params.upscale.openModels') }));
    expect(useUi.getState().activeTab).toBe('models');
  });
});

describe('Launchpad', () => {
  it('gives each tab with its own launchpad that page', () => {
    for (const [tab, testId] of [
      ['canvas', 'lp-draw'],
      ['upscaling', 'lp-upscale-drop'],
      ['workflows', 'lp-new-workflow'],
      ['generate', 'lp-text'],
    ] as const) {
      const { unmount } = show(<Launchpad tab={tab} />);
      expect(screen.getByTestId(testId)).toBeTruthy();
      unmount();
    }
  });

  it('gives the Generate page to every tab that has no launchpad of its own', () => {
    const own = new Set(['canvas', 'upscaling', 'workflows']);
    const others = TABS.filter((tab) => !own.has(tab));
    expect(others.length).toBeGreaterThan(0);
    for (const tab of others) {
      const { unmount } = show(<Launchpad tab={tab} />);
      expect(screen.getByTestId('lp-text')).toBeTruthy();
      unmount();
    }
  });
});
