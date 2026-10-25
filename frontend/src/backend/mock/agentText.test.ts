import { describe, expect, it } from 'vitest';
import { applyTextOps, textContext } from '@/features/text/aiOps';
import { EMPTY_SCENE, newTextLayer, type Scene, type TextLayer } from '@/state/text/textModel';
import { runMockAgent } from './agent';
import { fakeTools } from './agentScript.testkit';

const layer = { ...newTextLayer(EMPTY_SCENE, 'LOGO'), id: 'l1' };
const scene: Scene = { ...EMPTY_SCENE, layers: [layer] };

/** Asks on the text screen; the scene comes from get_text_scene, the operations go out with edit_text. */
async function ask(message: string, selected: string | null = 'l1', on: Scene = scene) {
  const tools = fakeTools({ get_text_scene: textContext(on, selected) });
  const reply = await runMockAgent({ message, locale: 'ja', screen: 'text' }, tools.call);
  return { reply, ops: (tools.args('edit_text')?.ops as unknown[]) ?? [], tools };
}

describe('mock assistant on the text screen', () => {
  it('reads the scene, changes the selected layer and the result applies cleanly', async () => {
    const { ops, tools } = await ask('赤くして、もっと大きく');
    expect(tools.tools()).toEqual(['get_text_scene', 'edit_text']);
    const out = applyTextOps(scene, ops, 'l1').scene.layers[0] as TextLayer;
    expect(out.style.fill).toEqual({ kind: 'solid', color: '#e5252a' });
    expect(out.style.fontSize).toBe(Math.round(layer.style.fontSize * 1.3));
  });

  it('changes the wording when the new text is quoted', async () => {
    const out = applyTextOps(scene, (await ask('文字を「ありがとう」に変えて')).ops, 'l1').scene.layers[0] as TextLayer;
    expect(out.text).toBe('ありがとう');
  });

  it('adds a styled logo and a speech bubble', async () => {
    const logo = applyTextOps(EMPTY_SCENE, (await ask('ポップなロゴを作って', null, EMPTY_SCENE)).ops);
    expect((logo.scene.layers[0] as TextLayer).style.fontFamily).toBe('Dela Gothic One');
    const bubble = applyTextOps(EMPTY_SCENE, (await ask('叫びの吹き出しを追加「やった！」', null, EMPTY_SCENE)).ops);
    const b = bubble.scene.layers[0]!;
    expect(b.type === 'bubble' && b.shape).toBe('burst');
    expect(b.text).toBe('やった！');
  });

  it('removes the layer on request and asks, changing nothing, when it does not understand', async () => {
    expect(applyTextOps(scene, (await ask('消して')).ops, 'l1').scene.layers).toHaveLength(0);
    const unclear = await ask('うーん');
    expect(unclear.tools.tools()).toEqual(['get_text_scene']);
    expect(unclear.reply.text.length).toBeGreaterThan(0);
  });
});
