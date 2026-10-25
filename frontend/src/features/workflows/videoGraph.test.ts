import { beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import { usePacks } from '@/state/media/packs';
import { buildDefaultGraph } from './defaultGraphs';
import { invalidEdges } from './graph';
import { buildRequest, readinessReasons } from './invokeBuilder';
import { NODE_TEMPLATES } from './templates';

const meta = { name: '', description: '', author: '', tags: [] as string[] };
const graphOf = (id: string) => buildDefaultGraph({ id, ...meta }, [])!;
const still = { name: 'a.png', url: 'http://x/full/a.png', thumbnailUrl: '', width: 640, height: 384, mediaType: 'image' } as ImageDTO;

beforeEach(() => {
  usePacks.getState().setPack('video', { state: 'ready' });
  useGallery.setState({ images: [still] });
});

describe('video graphs', () => {
  it('the built-in video graphs are valid and ready to invoke when the models are installed', () => {
    for (const id of ['default-video-t2v']) {
      const g = graphOf(id);
      expect(invalidEdges(g.nodes, g.edges), id).toEqual([]);
      expect(readinessReasons(g), id).toEqual([]);
    }
    expect(graphOf('default-video-i2v')).not.toBeNull();
  });

  it('asks for the video models before invoking', () => {
    usePacks.getState().setPack('video', { state: 'missing', totalBytes: 1 });
    expect(readinessReasons(graphOf('default-video-t2v')).length).toBe(1);
  });

  it('text to video becomes a video request without a source image', () => {
    const g = graphOf('default-video-t2v');
    const req = buildRequest(g, {}, { prepend: false });
    expect(req.params.generationMode).toBe('video');
    expect(req.params).toMatchObject({ videoFrames: 49, videoFps: 24, width: 832, height: 480 });
    expect(req.params.positivePrompt).toContain('Waves');
    expect(req.initImageUrl).toBeNull();
  });

  it('image to video sends the chosen image and takes the size from it', () => {
    const g = graphOf('default-video-i2v');
    const imageNode = g.nodes.find((n) => n.data.type === 'image')!;
    imageNode.data.inputs.image = 'a.png';
    const req = buildRequest(g, {}, { prepend: false });
    expect(req.params.generationMode).toBe('video');
    expect(req.initImageUrl).toBe(still.url);
    expect(req.params).toMatchObject({ width: 640, height: 384 });
  });

  it('the Generate Video node is an output node in its own category', () => {
    const t = NODE_TEMPLATES.find((n) => n.type === 'video_generate');
    expect(t).toMatchObject({ category: 'video', isOutput: true });
  });
});
