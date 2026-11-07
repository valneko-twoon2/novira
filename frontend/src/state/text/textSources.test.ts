import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_SCENE, newTextLayer, type Scene } from './textModel';
import { TEXT_SOURCES_MAX, useTextSources } from './textSources';

const sceneWith = (text: string): Scene => ({ ...EMPTY_SCENE, layers: [newTextLayer(EMPTY_SCENE, text)] });

beforeEach(() => useTextSources.setState({ sources: [] }));

describe('useTextSources', () => {
  it('gives the scene back for a picture it remembers, and null for another', () => {
    useTextSources.getState().remember('a.png', sceneWith('A'));
    expect(useTextSources.getState().sceneOf('a.png')?.layers[0]).toMatchObject({ text: 'A' });
    expect(useTextSources.getState().sceneOf('b.png')).toBeNull();
  });

  it('keeps its own copy: editing the scene put in or taken out does not change what is kept', () => {
    const scene = sceneWith('A');
    useTextSources.getState().remember('a.png', scene);
    scene.layers[0]!.text = 'changed after saving';
    const out = useTextSources.getState().sceneOf('a.png')!;
    expect(out.layers[0]).toMatchObject({ text: 'A' });
    out.layers[0]!.text = 'changed after reading';
    expect(useTextSources.getState().sceneOf('a.png')?.layers[0]).toMatchObject({ text: 'A' });
  });

  it('replaces the scene of a picture saved again, and moves it to the newest place', () => {
    const { remember } = useTextSources.getState();
    remember('a.png', sceneWith('first'));
    remember('b.png', sceneWith('B'));
    remember('a.png', sceneWith('second'));
    expect(useTextSources.getState().sources.map((s) => s.imageName)).toEqual(['b.png', 'a.png']);
    expect(useTextSources.getState().sceneOf('a.png')?.layers[0]).toMatchObject({ text: 'second' });
  });

  it('drops the oldest scenes past the limit', () => {
    const { remember } = useTextSources.getState();
    for (let i = 0; i < TEXT_SOURCES_MAX + 3; i += 1) remember(`p${i}.png`, sceneWith(String(i)));
    const names = useTextSources.getState().sources.map((s) => s.imageName);
    expect(names).toHaveLength(TEXT_SOURCES_MAX);
    expect(names[0]).toBe('p3.png');
    expect(useTextSources.getState().sceneOf('p0.png')).toBeNull();
    expect(useTextSources.getState().sceneOf(`p${TEXT_SOURCES_MAX + 2}.png`)).not.toBeNull();
  });
});
