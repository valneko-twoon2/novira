// Start-up with a gallery of summaries: what listens to the gallery can already ask for the details of those pictures.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO, type Packs } from '@/backend';
import { useGallery } from './gallery';
import { isSummary } from './galleryDetails';
import { startBackend } from './wiring';

type BootstrapData = Awaited<ReturnType<typeof backend.bootstrap>>;

afterEach(() => vi.restoreAllMocks());

describe('startBackend with summaries', () => {
  it('marks the pictures as summaries before the gallery tells its listeners', { tags: ['state-transition'] }, async () => {
    const image = { name: 'a.png', metadata: null } as ImageDTO;
    vi.spyOn(backend, 'bootstrap').mockResolvedValue({ models: [], boards: [], images: [image], imagesSummary: true, workflows: [], engine: { state: 'ready' } as BootstrapData['engine'], packs: {} as Packs });
    const seen: boolean[] = [];
    const off = useGallery.subscribe((s, prev) => {
      if (s.images !== prev.images && s.images.length > 0) seen.push(isSummary('a.png'));
    });
    await startBackend();
    off();
    expect(seen[0]).toBe(true);
  });
});
