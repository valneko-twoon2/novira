// Mock of the assistant's answers to questions: about an extension (found with search_extensions) and about a screen of
// the app (from get_app_guide), and about the user's recent pictures (list_gallery_images, which asks the user first).
// Deterministic; a real backend has the model write these.
import type { AgentExtensionInfo, AgentGuideEntry, AgentReply, AgentRequest } from '../types';
import { data, type MockToolCall } from './agentScript';

const QUESTION = /何|なに|どう|どこ|使い方|教えて|違い|what|how|where|which|explain|tell me/i;

/** The extension the question is about: the one asked about from the manager, else one whose name the message mentions. */
async function askedExtension(req: AgentRequest, call: MockToolCall): Promise<AgentExtensionInfo | undefined> {
  if (req.focus) return data<{ extensions: AgentExtensionInfo[] }>(await call('search_extensions', { ids: [req.focus] })).extensions?.[0];
  if (!/[a-z][a-z0-9._-]{2,}/i.test(req.message)) return undefined;
  const message = req.message.toLowerCase();
  const found = data<{ extensions: AgentExtensionInfo[] }>(await call('search_extensions', { query: req.message })).extensions ?? [];
  return found.find((e) => message.includes(e.name.toLowerCase()));
}

export async function helpAgentReply(req: AgentRequest, call: MockToolCall): Promise<AgentReply | null> {
  const ja = req.locale === 'ja';
  if (/最近の(画像|絵)|ギャラリーの(画像|絵)|recent pictures|my gallery/i.test(req.message)) {
    const answer = await call('list_gallery_images', { limit: 3 });
    if (!answer.ok) return { text: ja ? '画像を読む許可がないので、ギャラリーは見ていません。' : 'I did not look at the gallery: reading pictures was not allowed.' };
    const images = data<{ total: number; images: { name: string; prompt?: string }[] }>(answer);
    const prompts = (images.images ?? []).map((i) => i.prompt ?? i.name).join(' / ');
    return { text: ja ? `最近の画像は ${images.total ?? 0} 枚あります。${prompts}` : `There are ${images.total ?? 0} pictures. ${prompts}` };
  }
  const ext = await askedExtension(req, call);
  if (ext) {
    const nodes = ext.nodes?.length ? (ja ? ` 追加されるノード: ${ext.nodes.map((n) => n.name).join('、')}。` : ` Nodes it adds: ${ext.nodes.map((n) => n.name).join(', ')}.`) : '';
    const state = ext.installed
      ? ja
        ? 'すでにインストールされています。ワークフローのノード追加の一覧から使えます。'
        : 'It is already installed. Use it from the add-node list of the workflow editor.'
      : ja
        ? 'まだインストールされていません。インストールして ComfyUI を再起動すると、ノードが使えるようになります。'
        : 'It is not installed yet. Install it and restart ComfyUI to get its nodes.';
    if (!ext.installed) await call('recommend_packs', { ids: [ext.id] });
    return {
      thoughts: [ja ? `質問は拡張機能「${ext.name}」についてだと読み取りました。` : `Read the question as being about the extension ${ext.name}.`, ext.installed ? (ja ? 'インストール済みなので、使い方だけ答えます。' : 'It is installed, so I only explain how to use it.') : (ja ? 'まだインストールされていないので、インストールのカードを付けます。' : 'It is not installed yet, so I add an install card.')],
      text: `${ext.name}: ${ext.about || (ja ? '説明は見つかりませんでした。' : 'No description was found.')}${nodes} ${state}`,
    };
  }
  if (!QUESTION.test(req.message)) return null;
  const guide = (await call('get_app_guide')).content as AgentGuideEntry[];
  const entry = Array.isArray(guide) ? guide.find((g) => req.message.includes(g.name)) : undefined;
  return entry ? { text: `${entry.name}: ${entry.about}` } : null;
}
