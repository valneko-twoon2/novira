// Mock of the assistant's extension recommendations: keyword rules over the wording of the request, limited to the
// packs search_extensions lists.
import type { AgentPackInfo, AgentReply, AgentRequest } from '../types';
import { data, type MockToolCall } from './agentScript';

const RULES: { re: RegExp; ids: string[]; ja: string; en: string }[] = [
  { re: /顔|face|表情|目線/i, ids: ['impact', 'impactSubpack', 'nkd'], ja: '顔を直したり、表情を変えたりするなら、この拡張が合います。', en: 'These fit fixing faces or changing expressions.' },
  { re: /背景|切り抜|抜き|background|cut ?out/i, ids: ['rmbg', 'sam2'], ja: '背景を消して物や人だけを残すなら、この拡張が合います。', en: 'These remove the background and keep just the subject.' },
  { re: /一部|部分|インペイント|inpaint|修正/i, ids: ['cropStitch', 'inpaintNodes'], ja: '直したい所だけを描き直すなら、この拡張が合います。', en: 'These redraw just the part you want to fix.' },
  { re: /拡大|高精細|高画質|upscale|大きく/i, ids: ['ultimateUpscale', 'seedvr2'], ja: '絵を大きく高精細にするなら、この拡張が合います。', en: 'These enlarge a picture with fine detail.' },
  { re: /ポーズ|線画|pose|depth|奥行き/i, ids: ['controlnetAux'], ja: '参考画像のポーズや線画から描くなら、この拡張が合います。', en: 'This draws from the pose or line art of a reference.' },
  { re: /画風|参照画像|似せ|style|reference/i, ids: ['ipadapter', 'pulid'], ja: '参照画像の画風や人物に寄せるなら、この拡張が合います。', en: 'These match the style or person of a reference.' },
  { re: /動画|なめらか|補間|video|smooth/i, ids: ['frameInterpolation', 'videoHelper', 'wanVideo'], ja: '動画を作ったりなめらかにするなら、この拡張が合います。', en: 'These make video or smooth it.' },
  { re: /文章|説明|タグ|caption|tag/i, ids: ['florence2', 'wd14'], ja: '画像から文章やタグを取り出すなら、この拡張が合います。', en: 'These get words or tags out of a picture.' },
  { re: /メモリ|軽く|重い|vram|memory/i, ids: ['gguf', 'nunchaku', 'framePack', 'wanVideo'], ja: '重いモデルを少ないメモリで動かすなら、この拡張が合います。', en: 'These run heavy models in less memory.' },
  { re: /おすすめ|オススメ|拡張|何ができ|recommend|extension|beginner|初心者/i, ids: ['impact', 'rmbg', 'ultimateUpscale', 'florence2'], ja: 'まず入れておくと便利なものを選びました。', en: 'These are good first picks.' },
];

// A request about doing something (not a description of a picture to draw).
const WANTS = /したい|できる|できない|ほしい|欲しい|教えて|おすすめ|オススメ|拡張|直す|消す|can i|how|want|recommend|extension|beginner|初心者/i;

/** The rule a request matches, if it asks for something an extension does. */
export function packRule(message: string) {
  return WANTS.test(message) ? RULES.find((r) => r.re.test(message)) : undefined;
}

export async function packAgentReply(req: AgentRequest, call: MockToolCall): Promise<AgentReply | null> {
  const rule = packRule(req.message.trim());
  if (!rule) return null;
  const packs = data<{ packs: AgentPackInfo[] }>(await call('search_extensions', {})).packs ?? [];
  const offered = new Set(packs.map((p) => p.id));
  const installed = new Set(packs.filter((p) => p.installed).map((p) => p.id));
  const ids = rule.ids.filter((id) => offered.has(id) && !installed.has(id)).slice(0, 4);
  const ja = req.locale === 'ja';
  if (!ids.length) return { text: ja ? 'それに合う拡張は、もう入っています。' : 'The extensions for that are already installed.' };
  await call('recommend_packs', { ids });
  return { text: ja ? rule.ja : rule.en };
}
