// Mock of the assistant on the text screen: keyword rules that add or change logo and speech-bubble layers. The real
// assistant (an LLM) understands free wording; this keeps the screen testable without one.
import type { AgentReply, AgentRequest } from '../types';
import { data, type MockToolCall } from './agentScript';

interface SceneLayer {
  id: string;
  type: 'text' | 'bubble';
  text: string;
  x: number;
  y: number;
  rotation: number;
  style: { fontSize: number; vertical: boolean; shadow: unknown; stroke: unknown };
}

interface Context {
  selectedLayerId: string | null;
  scene: { width: number; height: number; layers: SceneLayer[] };
}

const COLORS: [RegExp, string][] = [
  [/赤|red/i, '#e5252a'],
  [/青|blue/i, '#2f6feb'],
  [/黄|yellow/i, '#ffd23f'],
  [/緑|green/i, '#2fb344'],
  [/白|white/i, '#ffffff'],
  [/黒|black/i, '#111111'],
  [/ピンク|pink/i, '#ff5d8f'],
  [/オレンジ|orange/i, '#ff8a1f'],
  [/紫|purple/i, '#8a4bd8'],
];

const PRESETS: [RegExp, string][] = [
  [/ポップ|pop/i, 'pop'],
  [/効果音|sfx|sound effect/i, 'sfx'],
  [/金|ゴールド|gold/i, 'gold'],
  [/ステッカー|sticker/i, 'sticker'],
  [/やわらか|柔らか|soft/i, 'soft'],
];

const SHAPES: [RegExp, string][] = [
  [/叫|怒|burst|shout/i, 'burst'],
  [/考え|思|cloud|thought/i, 'cloud'],
  [/ささやき|ひそひそ|whisper/i, 'whisper'],
  [/四角|box|square/i, 'box'],
  [/ナレーション|narration/i, 'narration'],
];

function quoted(text: string): string | null {
  return /[「『“"]([^」』”"]+)[」』”"]/.exec(text)?.[1] ?? null;
}

/** The text-editor operations a request asks for, with the answer; null when there is no scene. */
export function textEdit(req: AgentRequest, ctx: Partial<Context> | undefined): { text: string; ops: unknown[] } | null {
  if (!ctx?.scene) return null;
  const scene = ctx.scene;
  const ja = req.locale === 'ja';
  const say = (jaText: string, enText: string) => (ja ? jaText : enText);
  const message = req.message;
  const words = quoted(message);
  const layers = scene.layers;
  const target = layers.find((l) => l.id === ctx.selectedLayerId) ?? layers.at(-1);
  const ops: unknown[] = [];
  const done: string[] = [];

  const wantsNew = /(作|追加|入れ|つけ|付け|add|make|create)/i.test(message);
  if (/吹き出し|セリフ|bubble|speech/i.test(message) && (wantsNew || !target || target.type !== 'bubble')) {
    const shape = SHAPES.find(([re]) => re.test(message))?.[1] ?? 'round';
    ops.push({ op: 'add', layer: { type: 'bubble', shape, text: words ?? say('セリフ', 'Hello!'), x: scene.width * 0.6, y: scene.height * 0.3 } });
    done.push(say('吹き出しを追加', 'added a speech bubble'));
  } else if (wantsNew && /ロゴ|文字|テキスト|logo|text/i.test(message)) {
    const layer: Record<string, unknown> = { id: 'new', type: 'text', text: words ?? 'LOGO' };
    ops.push({ op: 'add', layer });
    const preset = PRESETS.find(([re]) => re.test(message))?.[1];
    if (preset) ops.push({ op: 'preset', id: 'new', preset });
    done.push(say('文字を追加', 'added text'));
  } else if (target) {
    const set: Record<string, unknown> = {};
    const style: Record<string, unknown> = {};
    const preset = PRESETS.find(([re]) => re.test(message))?.[1];
    if (preset && target.type === 'text') {
      ops.push({ op: 'preset', id: target.id, preset });
      done.push(say(`スタイルを「${preset}」に`, `style set to ${preset}`));
    }
    const color = COLORS.find(([re]) => re.test(message))?.[1];
    if (color && !preset) {
      style.fill = { kind: 'solid', color };
      done.push(say('色を変更', 'changed the colour'));
    }
    if (/大きく|でかく|bigger|larger/i.test(message)) {
      style.fontSize = Math.round(target.style.fontSize * 1.3);
      done.push(say('文字を大きく', 'made the text larger'));
    } else if (/小さく|smaller/i.test(message)) {
      style.fontSize = Math.max(8, Math.round(target.style.fontSize / 1.3));
      done.push(say('文字を小さく', 'made the text smaller'));
    }
    if (/縦書き|vertical/i.test(message)) {
      style.vertical = true;
      done.push(say('縦書きに', 'set vertical writing'));
    } else if (/横書き|horizontal/i.test(message)) {
      style.vertical = false;
      done.push(say('横書きに', 'set horizontal writing'));
    }
    if (/影.*(消|なし|外)|no shadow/i.test(message)) {
      style.shadow = null;
      done.push(say('影を消去', 'removed the shadow'));
    } else if (/影|shadow/i.test(message)) {
      style.shadow = { color: 'rgba(0, 0, 0, 0.5)', blur: 8, offsetX: 6, offsetY: 8 };
      done.push(say('影を追加', 'added a shadow'));
    }
    if (/縁取り.*(消|なし|外)|no outline/i.test(message)) {
      style.stroke = null;
      done.push(say('縁取りを消去', 'removed the outline'));
    } else if (/縁取り|outline/i.test(message)) {
      style.stroke = { color: '#111111', width: Math.max(2, Math.round(target.style.fontSize / 12)) };
      done.push(say('縁取りを追加', 'added an outline'));
    }
    const angle = /(-?\d+)\s*度/.exec(message)?.[1];
    if (angle !== undefined) {
      set.rotation = Number(angle);
      done.push(say(`${angle}度回転`, `rotated ${angle} degrees`));
    }
    if (/中央|真ん中|center/i.test(message)) {
      set.x = scene.width / 2;
      set.y = scene.height / 2;
      done.push(say('中央へ移動', 'moved to the centre'));
    } else if (/上|top/i.test(message) && /移動|寄せ|move/i.test(message)) {
      set.y = scene.height * 0.2;
      done.push(say('上へ移動', 'moved up'));
    } else if (/下|bottom/i.test(message) && /移動|寄せ|move/i.test(message)) {
      set.y = scene.height * 0.8;
      done.push(say('下へ移動', 'moved down'));
    }
    if (words && /(に変え|にして|と書|に直|に修正|change|to)/i.test(message)) {
      set.text = words;
      done.push(say(`文字を「${words}」に`, `text set to "${words}"`));
    }
    if (/消して|削除|delete|remove/i.test(message)) {
      ops.push({ op: 'remove', id: target.id });
      done.push(say('削除', 'removed it'));
    } else if (Object.keys(style).length || Object.keys(set).length) {
      ops.push({ op: 'update', id: target.id, set: { ...set, ...(Object.keys(style).length ? { style } : {}) } });
    }
  }

  if (!ops.length) {
    return {
      text: say('どう直すか教えてください。たとえば「赤くして」「もっと大きく」「縦書きにして」「「ありがとう」に変えて」「ポップなロゴを作って」のように伝えてください。', 'Tell me how to change it, e.g. "make it red", "bigger", "vertical writing", or "add a pop logo saying \'Thanks\'".'),
      ops: [],
    };
  }
  return { text: say(`${done.join('、')}しました。`, `Done: ${done.join(', ')}.`), ops };
}

/** On the text screen: reads the scene, then changes it with edit_text. */
export async function textAgentReply(req: AgentRequest, call: MockToolCall): Promise<AgentReply | null> {
  if (req.screen !== 'text') return null;
  const edit = textEdit(req, data<Context>(await call('get_text_scene')));
  if (!edit) return null;
  if (edit.ops.length) await call('edit_text', { ops: edit.ops });
  return { text: edit.text };
}
