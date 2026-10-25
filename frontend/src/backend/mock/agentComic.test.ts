// The mock assistant on the comic screen: it reads the page with get_comic_page, and words about the page become comic
// operations sent with edit_comic; other screens and other words are left to the ordinary mock.
import { describe, expect, it } from 'vitest';
import type { AgentRequest } from '../types';
import { runMockAgent } from './agent';
import { comicAgentReply, comicOps } from './agentComic';
import { fakeTools } from './agentScript.testkit';

const page = { panels: [{ panel: 1 }, { panel: 2 }], layoutTemplates: ['slants'] };
const request = (message: string, over: Partial<AgentRequest> = {}): AgentRequest => ({ message, locale: 'ja', screen: 'comic', ...over });
const opsOf = (message: string) => comicOps(message, page, true).ops.map((o) => (o as { op: string }).op);

describe('comicOps', () => {
  it('turns a slanted layout, dialogue and shots into comic operations', () => {
    expect(opsOf('斜めのコマ割りにして')).toEqual(['template']);
    expect(opsOf('漫画らしいコマ割りにして')).toEqual(['mangaLayout']);
    expect(opsOf('コマを追加して')).toEqual(['addPanel']);
    expect(opsOf('セリフを入れて')).toEqual(['addBubble', 'addBubble']);
    expect(opsOf('構図を考えて')).toEqual(['panel', 'panel']);
    expect(opsOf('ト書きを書いて')).toEqual(['panel', 'panel']);
    expect(comicOps('セリフを入れて', {}, true).ops).toEqual([]);
  });
});

describe('comicOps on layers', () => {
  const layered = { layers: [{ layer: 1, kind: 'panels' }, { layer: 2, kind: 'balloons' }, { layer: 3, kind: 'raster' }] };

  it('adds a layer, and blends or moves the new one by its number on top of the layers of the page', () => {
    expect(comicOps('レイヤーを足して', layered, true).ops).toEqual([{ op: 'addLayer', name: '効果線' }]);
    expect(comicOps('乗算のレイヤーをコマの下に足して', layered, true).ops).toEqual([
      { op: 'addLayer', name: '効果線' },
      { op: 'layer', layer: 4, blend: 'multiply' },
      { op: 'layer', layer: 4, move: 'bottom' },
    ]);
  });

  it('deletes the top raster of the user that is not locked, and adds nothing when there is none', () => {
    expect(comicOps('レイヤーを削除して', layered, true).ops).toEqual([{ op: 'deleteLayer', layer: 3 }]);
    expect(comicOps('レイヤーを削除して', { layers: [{ layer: 3, kind: 'raster', locked: true }] }, true).ops).toEqual([{ op: 'addLayer', name: '効果線' }]);
  });
});

describe('comicAgentReply', () => {
  it('reads the page, then edits it', async () => {
    const tools = fakeTools({ get_comic_page: page });
    const reply = await comicAgentReply(request('斜めのコマ割りにして'), tools.call);
    expect(tools.tools()).toEqual(['get_comic_page', 'edit_comic']);
    expect(tools.args('edit_comic')).toEqual({ ops: [{ op: 'template', id: 'slants' }] });
    expect(reply?.text).toContain('斜めのコマ割り');
  });

  it('leaves other screens and unrelated words to the ordinary mock', async () => {
    const tools = fakeTools({ get_comic_page: page });
    expect(await comicAgentReply(request('セリフを入れて', { screen: 'generate' }), tools.call)).toBeNull();
    expect(tools.calls).toEqual([]);
    expect(await comicAgentReply(request('猫'), tools.call)).toBeNull();
    expect(tools.tools()).toEqual(['get_comic_page']);
    const all = fakeTools({ get_comic_page: page });
    await runMockAgent(request('斜めのコマ割りにして'), all.call);
    expect(all.tools()).toContain('edit_comic');
  });
});
