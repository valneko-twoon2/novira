// Mock of the assistant on the comic screen: it reads the page (get_comic_page), and a few words about it turn into comic
// operations (a ready-made layout, a manga-like cut, one more panel, balloons with lines, a raster layer, prompts with
// shots, stage directions, and the layer operations: add, blend, move under the panels, delete) sent with edit_comic. Deterministic, like the other mocks.
import type { AgentReply, AgentRequest } from '../types';
import { data, type MockToolCall } from './agentScript';

interface ComicContext {
  panels?: { panel: number; prompt?: string }[];
  layoutTemplates?: string[];
  layers?: { layer: number; kind: string; locked?: boolean }[];
}

/** The operations a message asks for on a page; empty when it is not about the page. */
export function comicOps(message: string, comic: ComicContext, ja: boolean): { ops: unknown[]; done: string[] } {
  const panels = comic.panels ?? [];
  const ops: unknown[] = [];
  const done: string[] = [];
  if (/斜め|ななめ|迫力|アクション|slant|diagonal|action/i.test(message) && comic.layoutTemplates?.includes('slants')) {
    ops.push({ op: 'template', id: 'slants' });
    done.push(ja ? '斜めのコマ割り' : 'a slanted layout');
  } else if (/コマ割り|コマわり|manga layout|panel layout/i.test(message)) {
    ops.push({ op: 'mangaLayout', panelCount: 5, mood: 'dramatic', focus: 5, seed: 7 });
    done.push(ja ? '漫画らしいコマ割り' : 'a manga-like panel layout');
  } else if (/コマ.*(追加|増や)|add.*panel|more panel/i.test(message)) {
    ops.push({ op: 'addPanel', panel: null });
    done.push(ja ? 'コマを1つ追加' : 'one more panel');
  }
  if (/セリフ|台詞|吹き出し|dialog|balloon|speech/i.test(message) && panels.length) {
    panels.slice(0, 3).forEach((p, i) =>
      ops.push({ op: 'addBubble', panel: p.panel, kind: 'speech', text: ja ? ['おはよう！', 'え、もう朝？', '急がなきゃ！'][i] : ['Morning!', 'Already?', 'We must hurry!'][i], x: 0.6, y: 0.08, vertical: ja }),
    );
    done.push(ja ? 'セリフの吹き出し' : 'speech balloons');
  }
  if (/レイヤー|layer/i.test(message)) {
    const layers = comic.layers ?? [];
    const top = [...layers].reverse().find((l) => l.kind === 'raster' && !l.locked);
    if (/削除|消して|delete|remove/i.test(message) && top) {
      ops.push({ op: 'deleteLayer', layer: top.layer });
      done.push(ja ? 'いちばん上のラスターレイヤーの削除' : 'removing the top raster layer');
    } else {
      ops.push({ op: 'addLayer', name: ja ? '効果線' : 'Speed lines' });
      // The new layer is on top, so its number follows the layers the page has now.
      const mine = layers.length + 1;
      if (/乗算|multiply/i.test(message)) ops.push({ op: 'layer', layer: mine, blend: 'multiply' });
      if (/コマの下|under the panels|below the panels/i.test(message)) ops.push({ op: 'layer', layer: mine, move: 'bottom' });
      done.push(ja ? 'ラスターレイヤー' : 'a raster layer');
    }
  }
  if (/構図|ショット|プロンプト|ネーム|composition|shot|prompt|script/i.test(message) && panels.length) {
    const shots = ['establishing wide shot', 'cowboy shot', 'close-up', 'from below, full body'];
    panels.forEach((p, i) => ops.push({ op: 'panel', panel: p.panel, prompt: `1girl, school uniform, ${shots[i % shots.length]}` }));
    done.push(ja ? '各コマの構図つきプロンプト' : 'prompts with a shot for each panel');
  }
  if (/ト書き|場面|シーン|stage direction|scene/i.test(message) && panels.length) {
    const notes = ja
      ? ['夕方の古いアパートの外観。', '台所。姉が請求書を前に考え込む。', '妹が戸口から声をかける。', '姉が振り向いて笑う。']
      : ['An old apartment block at dusk.', 'The kitchen. The older sister frowns at the bills.', 'Her sister calls from the doorway.', 'She turns and smiles.'];
    panels.forEach((p, i) => ops.push({ op: 'panel', panel: p.panel, note: notes[i % notes.length] }));
    done.push(ja ? '各コマのト書き' : 'a stage direction for each panel');
  }
  return { ops, done };
}

/** Comic operations for a request on the comic screen; null when the message is not about the page (the ordinary mock answers). */
export async function comicAgentReply(req: AgentRequest, call: MockToolCall): Promise<AgentReply | null> {
  if (req.screen !== 'comic') return null;
  const ja = req.locale === 'ja';
  const comic = data<ComicContext>(await call('get_comic_page'));
  const { ops, done } = comicOps(req.message, comic, ja);
  if (!ops.length) return null;
  await call('edit_comic', { ops });
  return {
    thoughts: [ja ? '漫画のページへの指示として読みました。' : 'Read it as a request about the comic page.'],
    text: ja ? `${done.join('、')}を入れました。絵は描くボタンで描けます。` : `I added ${done.join(', ')}. Press draw to make the pictures.`,
  };
}
