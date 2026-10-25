// Mock of the assistant on the video, music and voice screens: it fills the form from the wording of the request.
import type { AgentReply, AgentRequest } from '../types';
import type { MockToolCall } from './agentScript';

const GENRES: [RegExp, string][] = [
  [/ローファイ|lo-?fi/i, 'lo-fi'],
  [/ロック|rock/i, 'rock'],
  [/ジャズ|jazz/i, 'jazz'],
  [/ポップ|pop/i, 'pop'],
  [/ピアノ|piano/i, 'piano'],
  [/切な|sad|melanchol/i, 'melancholic'],
  [/明る|upbeat|happy/i, 'upbeat'],
  [/落ち着|calm|relax/i, 'calm'],
];

export async function mediaAgentReply(req: AgentRequest, call: MockToolCall): Promise<AgentReply | null> {
  const ja = req.locale === 'ja';
  const message = req.message.trim();
  if (req.screen === 'music') {
    const tags = GENRES.filter(([re]) => re.test(message)).map(([, tag]) => tag);
    const instrumental = /インスト|歌なし|instrumental/i.test(message);
    const fields: Record<string, unknown> = { tags: tags.length ? tags.join(', ') : 'pop, melodic', instrumental };
    if (!instrumental) fields.lyrics = '[verse]\nla la la\n[chorus]\nla la la';
    await call('set_form', { kind: 'music', fields });
    return { text: ja ? '曲のスタイルを設定しました。' : 'I set up the style of the song.' };
  }
  if (req.screen === 'video') {
    await call('set_form', { kind: 'video', fields: { prompt: message, seconds: 3 } });
    return { text: ja ? '動画の内容を設定しました。' : 'I set up the clip.' };
  }
  if (req.screen === 'voice') {
    await call('set_form', { kind: 'voice', fields: { text: message } });
    return { text: ja ? '読み上げる文章を設定しました。' : 'I set the text to read.' };
  }
  return null;
}
