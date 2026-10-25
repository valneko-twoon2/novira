// Mock of the AI assistant: keyword rules that pick a model, LoRAs, a prompt and a few parameters from the user's
// request, each carried out with the app's tools (list_models, select_model, add_lora, set_generation_settings), like a
// real assistant. Deterministic; the real backend runs claude or codex instead.
import type { AgentReply, AgentRequest } from '../types';
import { helpAgentReply } from './agentHelp';
import { mediaAgentReply } from './agentMedia';
import { comicAgentReply } from './agentComic';
import { packAgentReply } from './agentPacks';
import { poseAgentReply } from './agentPose';
import { data, type MockRule, type MockToolCall } from './agentScript';
import { textAgentReply } from './agentText';

/** A model as list_models tells it. */
interface AgentModelInfo {
  key: string;
  name: string;
  base: string;
  type: string;
}

type Style = 'anime' | 'photo' | 'flux' | 'pixel' | 'general';

const STYLE_RULES: { style: Style; re: RegExp }[] = [
  { style: 'pixel', re: /ドット|ピクセル|pixel/i },
  { style: 'flux', re: /flux|フラックス|高速|すぐ|fast|quick/i },
  { style: 'anime', re: /アニメ|イラスト|漫画|マンガ|キャラ|anime|illustration|manga|cartoon/i },
  { style: 'photo', re: /写真|リアル|実写|フォト|photo|realistic|real\b/i },
];

// Japanese words -> prompt tags (English tags are what the models understand).
const TAGS: [RegExp, string][] = [
  [/少女|女の子|女性|girl|woman/i, '1girl'],
  [/少年|男の子|男性|boy\b|man\b/i, '1boy'],
  [/猫|ねこ|cat/i, 'cat'],
  [/犬|いぬ|dog/i, 'dog'],
  [/ドラゴン|竜|dragon/i, 'dragon'],
  [/ロボット|robot/i, 'robot'],
  [/風景|景色|landscape|scenery/i, 'scenery'],
  [/夕焼け|夕日|sunset/i, 'sunset'],
  [/夜景|夜|night/i, 'night'],
  [/海|ocean|sea\b/i, 'ocean'],
  [/山|mountain/i, 'mountain'],
  [/森|forest/i, 'forest'],
  [/街|都市|city/i, 'city street'],
  [/桜|cherry blossom/i, 'cherry blossoms'],
  [/雨|rain/i, 'rain'],
  [/雪|snow/i, 'snow'],
  [/城|castle/i, 'castle'],
  [/宇宙|space/i, 'space'],
  [/花|flower/i, 'flowers'],
  [/青い髪|blue hair/i, 'blue hair'],
  [/長い髪|long hair/i, 'long hair'],
  [/笑顔|smil/i, 'smile'],
  [/制服|uniform/i, 'school uniform'],
  [/サイバーパンク|cyberpunk/i, 'cyberpunk'],
  [/ファンタジー|fantasy/i, 'fantasy'],
  [/水彩|watercolor/i, 'watercolor'],
];

const QUALITY: Record<Style, string> = {
  anime: 'masterpiece, best quality, newest, absurdres, highres',
  photo: 'photo, realistic, highly detailed, sharp focus, natural lighting',
  flux: 'highly detailed',
  pixel: 'pixel art, limited palette, clean pixels',
  general: 'masterpiece, best quality, highly detailed',
};

const NEGATIVE: Record<Style, string> = {
  anime: 'lowres, bad anatomy, bad hands, text, error, worst quality, low quality, jpeg artifacts, signature, watermark, blurry',
  photo: 'cartoon, anime, painting, lowres, blurry, deformed, bad anatomy, watermark, text',
  flux: '',
  pixel: 'blurry, smooth gradients, antialiasing, noise, watermark',
  general: 'lowres, bad anatomy, worst quality, low quality, blurry, watermark',
};

const REASON: Record<Style, { ja: string; en: string }> = {
  anime: { ja: 'アニメ・イラスト向けなので', en: 'it suits anime and illustration' },
  photo: { ja: '写真のようなリアルな絵に強いので', en: 'it is strong at photorealistic images' },
  flux: { ja: '少ないステップで速く生成できるので', en: 'it generates quickly with few steps' },
  pixel: { ja: 'ドット絵はSDXL系とピクセルアートLoRAの組み合わせが合うので', en: 'SDXL with a pixel-art LoRA works best for pixel art' },
  general: { ja: '汎用的に使えるので', en: 'it is a good all-rounder' },
};

const findLora = (models: AgentModelInfo[], re: RegExp, base?: AgentModelInfo['base']) =>
  models.find((m) => m.type === 'lora' && re.test(m.name) && (!base || m.base === base || m.base === 'any'));

function pickMain(models: AgentModelInfo[], style: Style): AgentModelInfo | undefined {
  const mains = models.filter((m) => m.type === 'main');
  const byName = (re: RegExp) => mains.find((m) => re.test(m.name));
  const order: Record<Style, (AgentModelInfo | undefined)[]> = {
    anime: [byName(/noob|illustrious|anime|wai/i), byName(/dreamshaper/i)],
    photo: [byName(/juggernaut|realvis|photo/i)],
    flux: [byName(/flux/i)],
    pixel: [mains.find((m) => m.base === 'sdxl')],
    general: [byName(/juggernaut/i), mains[0]],
  };
  return [...order[style], mains[0]].find(Boolean);
}

/** Picks the model, LoRAs, prompt and parameters for a picture. */
async function imageAgentReply(req: AgentRequest, call: MockToolCall): Promise<AgentReply> {
  const ja = req.locale === 'ja';
  const text = req.message.trim();
  const style: Style = STYLE_RULES.find((r) => r.re.test(text))?.style ?? 'general';
  const tags = [...new Set(TAGS.filter(([re]) => re.test(text)).map(([, tag]) => tag))];
  const isAscii = /^[\x20-\x7e]+$/.test(text);

  if (tags.length === 0 && !isAscii && style === 'general') {
    return {
      text: ja
        ? '何を描きたいか、もう少し教えてください。たとえば「夕焼けの海辺に立つアニメ風の少女」のように、題材・雰囲気・画風を書いてもらえれば、モデルやLoRA、プロンプトを選びます。'
        : 'Tell me a bit more about what you want to draw — subject, mood and style, e.g. "an anime girl on a beach at sunset" — and I will pick the model, LoRAs and prompt.',
    };
  }

  const models = data<{ models: AgentModelInfo[] }>(await call('list_models')).models ?? [];
  const main = pickMain(models, style);
  if (main) await call('select_model', { key: main.key });

  // LoRAs that fit the chosen model's base.
  const wantsDetail = /高品質|精細|細かい|detailed|high quality/i.test(text);
  const wanted: { re: RegExp; weight: number }[] = [];
  if (style === 'pixel') wanted.push({ re: /pixel/i, weight: 0.9 });
  if (/水彩|watercolor/i.test(text)) wanted.push({ re: /watercolor/i, weight: 0.8 });
  if (style === 'flux' && /リアル|写真|photo|real/i.test(text)) wanted.push({ re: /realism/i, weight: 0.8 });
  if (wantsDetail) wanted.push({ re: /detail/i, weight: 0.6 });
  const picked: AgentModelInfo[] = [];
  for (const l of wanted) {
    const m = findLora(models, l.re, main?.base);
    if (m) {
      await call('add_lora', { key: m.key, weight: l.weight });
      picked.push(m);
    }
  }

  // Prompt: the user's words as tags (or the English text as is) plus style-specific quality tags.
  const subject = tags.length ? tags.join(', ') : text;
  const trigger = picked.some((m) => /pixel/i.test(m.name)) ? 'pixel art' : '';
  const positive = [subject, trigger, QUALITY[style]].filter(Boolean).join(', ');
  // Parameters.
  const patch: { steps?: number; cfgScale?: number; width?: number; height?: number } = {};
  if (/縦|ポートレート|portrait|vertical/i.test(text)) Object.assign(patch, { width: 832, height: 1216 });
  else if (/横|ワイド|風景|wide|landscape|scenery/i.test(text)) Object.assign(patch, { width: 1216, height: 832 });
  if (main?.base === 'flux') Object.assign(patch, { steps: 4, cfgScale: 1 });
  else if (/下書き|ドラフト|draft/i.test(text)) patch.steps = 12;
  else if (wantsDetail) patch.steps = 40;
  await call('set_generation_settings', { positivePrompt: positive, negativePrompt: NEGATIVE[style], ...patch });

  const notes: string[] = [];
  if (main) notes.push(ja ? `モデルは「${main.name}」` : `model: ${main.name}`);
  if (picked.length) notes.push(ja ? `LoRAは「${picked.map((m) => m.name).join('」「')}」` : `LoRA: ${picked.map((m) => m.name).join(', ')}`);
  const body = ja
    ? `${notes.join('、')}を選びました（${REASON[style].ja}）。プロンプトとネガティブプロンプトも入れてあります。生成ボタンを押すか、下の「生成する」から始められます。`
    : `I chose ${notes.join(', ')} (${REASON[style].en}) and filled in the prompt and negative prompt. Press Generate, or use the button below.`;
  return { text: body };
}

/** The prompt the mock "reads" from attached pictures: fixed, so tests and the manual's pictures stay the same. */
export const MOCK_PICTURE_PROMPT = '1girl, solo, summer sky, white clouds, soft light, detailed illustration';

/** A message with pictures: the mock writes a prompt "from" them into the prompt box and says how many it looked at. */
async function pictureAgentReply(req: AgentRequest, call: MockToolCall): Promise<AgentReply | null> {
  const count = req.images?.length ?? 0;
  if (!count) return null;
  await call('set_generation_settings', { positivePrompt: MOCK_PICTURE_PROMPT });
  return {
    text:
      req.locale === 'ja'
        ? `添付の画像 ${count} 枚を見て、プロンプトを「${MOCK_PICTURE_PROMPT}」にしました。`
        : `I looked at the ${count} attached picture(s) and set the prompt to "${MOCK_PICTURE_PROMPT}".`,
  };
}

/**
 * The rules, in order: pictures sent with the message come first; a question about an extension or the app is answered before anything is set; on the text, comic,
 * media and canvas screens the request is about them; then recommendations; else the picture's settings.
 */
const RULES: MockRule[] = [pictureAgentReply, helpAgentReply, textAgentReply, comicAgentReply, mediaAgentReply, poseAgentReply, packAgentReply, imageAgentReply];

/** Answers a request by running the first rule that takes it. */
export async function runMockAgent(req: AgentRequest, call: MockToolCall): Promise<AgentReply> {
  for (const rule of RULES) {
    const reply = await rule(req, call);
    if (reply) return reply;
  }
  return { text: '' };
}
