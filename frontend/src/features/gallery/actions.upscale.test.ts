// @vitest-environment jsdom
// The gallery's "Upscale" where the Upscaling tab is hidden (the app build): it opens the batch dialog on that picture
// with the model-only enlargement, instead of a screen that cannot open.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useBatch } from '@/state/dialogs/batch';
import { useParams } from '@/state/params';
import { useUi } from '@/state/ui';
import { sendToUpscale } from './actions';

const initial = { ui: useUi.getState(), params: useParams.getState() };
const image = { name: 'a.png', url: 'blob:a', thumbnailUrl: 'blob:t', width: 640, height: 480, workflow: null, metadata: null } as unknown as ImageDTO;

beforeEach(() => {
  useUi.setState(initial.ui, true);
  useParams.setState(initial.params, true);
  useBatch.setState({ names: null, op: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('the gallery upscale', { tags: [] }, () => {
  it('opens the model-only enlargement on that picture when the Upscaling tab is hidden', { tags: ['decision-table'] }, () => {
    vi.stubEnv('MODE', 'production');
    sendToUpscale(image);
    expect(useBatch.getState()).toMatchObject({ names: ['a.png'], op: 'upscale' });
    expect(useUi.getState().activeTab).not.toBe('upscaling');
    expect(useParams.getState().upscale.initialImage).toBeNull();
  });

  it('sends the picture to the Upscaling tab where it is shown', { tags: ['decision-table'] }, () => {
    sendToUpscale(image);
    expect(useUi.getState().activeTab).toBe('upscaling');
    expect(useParams.getState().upscale.initialImage?.name).toBe('a.png');
    expect(useBatch.getState().names).toBeNull();
  });

  it('does nothing for a video or a sound, in the app or with the Upscaling tab: no dialog with nothing to enlarge', { tags: ['equivalence', 'regression'] }, () => {
    for (const mediaType of ['video', 'audio'] as const) {
      const media = { ...image, name: `m.${mediaType}`, mediaType } as ImageDTO;
      vi.stubEnv('MODE', 'production');
      sendToUpscale(media);
      expect(useBatch.getState().names, mediaType).toBeNull();
      vi.unstubAllEnvs();
      sendToUpscale(media);
      expect(useUi.getState().activeTab, mediaType).not.toBe('upscaling');
      expect(useParams.getState().upscale.initialImage, mediaType).toBeNull();
    }
  });

  it('opens the batch dialog for no particular operation unless told one', { tags: ['equivalence'] }, () => {
    useBatch.getState().open(['a.png'], 'upscale');
    useBatch.getState().close();
    useBatch.getState().open(['b.png']);
    expect(useBatch.getState()).toMatchObject({ names: ['b.png'], op: null });
  });
});
