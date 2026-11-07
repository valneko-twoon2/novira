import { beforeEach, describe, expect, it } from 'vitest';
import { useTextEditor } from '../text/textEditor';
import { EMPTY_SCENE, newBubbleLayer, newTextLayer, type BubbleLayer, type Scene, type TextLayer } from '../text/textModel';
import { applyPreset, savePreset } from './presetStore';
import { scaleLayer, sceneFromTemplate, textScenePresets, useTextScenePresets } from './textScenePresets';

const reset = (scene: Scene) => {
  useTextEditor.setState({ scene, selectedId: null, past: [], future: [] });
  useTextScenePresets.setState({ presets: [], selectedId: null });
};
const textLayer = (scene: Pick<Scene, 'width' | 'height'>, text = 'A'): TextLayer => ({ ...newTextLayer(scene, text), x: 300, y: 200 });
const bubble = (scene: Pick<Scene, 'width' | 'height'>): BubbleLayer => {
  const b = newBubbleLayer(scene, 'round', 'hi');
  return { ...b, x: 500, y: 100, width: 400, height: 200, border: { color: '#000000', width: 10 }, tail: { enabled: true, x: 40, y: 150, curve: 0.2, width: 60 } };
};

describe('scaleLayer', () => {
  it('moves a text layer along each axis and scales its letters by the smaller factor', () => {
    const t = textLayer(EMPTY_SCENE);
    const scaled = scaleLayer(t, 2, 0.5) as TextLayer;
    expect(scaled.x).toBe(600);
    expect(scaled.y).toBe(100);
    expect(scaled.style.fontSize).toBe(Math.round(t.style.fontSize * 0.5));
    expect(scaled.text).toBe(t.text);
  });

  it('scales a bubble\'s size, border and tail by the smaller factor', () => {
    const scaled = scaleLayer(bubble(EMPTY_SCENE), 0.5, 1) as BubbleLayer;
    expect(scaled).toMatchObject({ x: 250, y: 100, width: 200, height: 100, border: { width: 5 }, tail: { x: 20, y: 75, width: 30 } });
  });

  it('never shrinks a bubble below its minimum or a tail below 1', () => {
    const scaled = scaleLayer(bubble(EMPTY_SCENE), 0.01, 0.01) as BubbleLayer;
    expect(scaled.width).toBe(40);
    expect(scaled.height).toBe(40);
    expect(scaled.tail.width).toBe(1);
    expect(scaled.style.fontSize).toBeGreaterThanOrEqual(1);
  });

  it('leaves the AI fill as it is, since it follows the font size', () => {
    const t = { ...textLayer(EMPTY_SCENE), rich: { imageName: 'a.png', candidates: ['a.png'], width: 300, height: 100, fontSize: 100, sourceKey: 'k' } };
    expect((scaleLayer(t, 2, 2) as TextLayer).rich).toEqual(t.rich);
  });

  it('keeps everything at a factor of 1', () => {
    const b = bubble(EMPTY_SCENE);
    expect(scaleLayer(b, 1, 1)).toMatchObject({ x: b.x, y: b.y, width: b.width, height: b.height, border: b.border, tail: b.tail });
  });
});

describe('sceneFromTemplate', () => {
  const data = { width: 1000, height: 1000, background: { color: '#112233' }, layers: [textLayer({ width: 1000, height: 1000 })] };

  it('takes the sheet of the template on a plain background', () => {
    const scene = sceneFromTemplate(data, { ...EMPTY_SCENE, width: 400, height: 300, background: { kind: 'color', color: null } });
    expect(scene).toMatchObject({ width: 1000, height: 1000, background: { kind: 'color', color: '#112233' } });
    expect(scene.layers[0]!.x).toBe(300);
  });

  it('keeps the picture and its size, and scales the layers to it', () => {
    const current: Scene = { ...EMPTY_SCENE, width: 500, height: 500, background: { kind: 'image', imageName: 'p.png' }, layers: [] };
    const scene = sceneFromTemplate(data, current);
    expect(scene).toMatchObject({ width: 500, height: 500, background: { kind: 'image', imageName: 'p.png' } });
    expect(scene.layers[0]).toMatchObject({ x: 150, y: 100 });
  });

  it('keeps the current plain background when the template was made on a picture', () => {
    const onPicture = { width: 1000, height: 1000, layers: data.layers };
    const current: Scene = { ...EMPTY_SCENE, width: 2000, height: 2000, background: { kind: 'color', color: '#ffffff' }, layers: [] };
    const scene = sceneFromTemplate(onPicture, current);
    expect(scene).toMatchObject({ width: 2000, height: 2000, background: { kind: 'color', color: '#ffffff' } });
    expect(scene.layers[0]).toMatchObject({ x: 600, y: 400 });
  });

  it('gives every layer a new id', () => {
    const scene = sceneFromTemplate(data, EMPTY_SCENE);
    expect(scene.layers[0]!.id).not.toBe(data.layers[0]!.id);
  });
});

describe('the template preset kind', () => {
  beforeEach(() => reset({ ...EMPTY_SCENE, layers: [] }));

  it('saves the layers and a plain background, not a picture, and without sharing objects with the editor', () => {
    const t = textLayer(EMPTY_SCENE);
    useTextEditor.setState({ scene: { ...EMPTY_SCENE, background: { kind: 'color', color: '#abcdef' }, layers: [t] } });
    const id = savePreset(textScenePresets, 'Title');
    const saved = useTextScenePresets.getState().presets.find((p) => p.id === id)!.data;
    expect(saved).toMatchObject({ width: 1024, height: 1024, background: { color: '#abcdef' } });
    expect(saved.layers[0]).toEqual(t);
    expect(saved.layers[0]).not.toBe(t);

    useTextEditor.setState({ scene: { ...EMPTY_SCENE, background: { kind: 'image', imageName: 'p.png' }, layers: [t] } });
    const onPicture = savePreset(textScenePresets, 'On picture');
    expect(useTextScenePresets.getState().presets.find((p) => p.id === onPicture)!.data.background).toBeUndefined();
  });

  it('applies as one undo step, replaces the layers and clears the selection', () => {
    const t = textLayer(EMPTY_SCENE, 'Saved');
    useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [t] } });
    const id = savePreset(textScenePresets, 'Title');
    const other = textLayer(EMPTY_SCENE, 'Other');
    useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [other, bubble(EMPTY_SCENE)] }, selectedId: other.id, past: [], future: [] });

    expect(applyPreset(textScenePresets, id)).toBe(true);
    const { scene, selectedId, past } = useTextEditor.getState();
    expect(scene.layers.map((l) => l.text)).toEqual(['Saved']);
    expect(selectedId).toBeNull();
    expect(past).toHaveLength(1);

    useTextEditor.getState().undo();
    expect(useTextEditor.getState().scene.layers).toHaveLength(2);
  });

  it('applies the same template twice to two separate sets of layers', () => {
    useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [textLayer(EMPTY_SCENE)] } });
    const id = savePreset(textScenePresets, 'Title');
    applyPreset(textScenePresets, id);
    const first = useTextEditor.getState().scene.layers[0]!.id;
    applyPreset(textScenePresets, id);
    expect(useTextEditor.getState().scene.layers[0]!.id).not.toBe(first);
  });
});
