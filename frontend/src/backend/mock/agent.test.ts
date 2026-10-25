// The mock assistant's scripts: which tools each kind of request calls, and with what.
import { describe, expect, it } from 'vitest';
import type { AgentRequest } from '../types';
import { SEED_MODELS } from './seedData';
import { runMockAgent } from './agent';
import { fakeTools } from './agentScript.testkit';

const models = SEED_MODELS.map((m) => ({ key: m.key, name: m.name, base: m.base, type: m.type }));
const request = (message: string, over: Partial<AgentRequest> = {}): AgentRequest => ({ message, locale: 'ja', ...over });

async function ask(message: string, over: Partial<AgentRequest> = {}, answers: Record<string, unknown> = {}, failing: string[] = []) {
  const tools = fakeTools({ list_models: { models }, ...answers }, failing);
  const reply = await runMockAgent(request(message, over), tools.call);
  return { reply, tools };
}

describe('the mock assistant on the Generate tab', () => {
  it('reads the models, picks an anime model and fills both prompts for an anime request', async () => {
    const { tools } = await ask('夕焼けの海辺に立つアニメ風の少女');
    expect(tools.tools()).toEqual(['list_models', 'select_model', 'set_generation_settings']);
    expect(tools.args('select_model')).toEqual({ key: 'main-noobai-xl' });
    expect(tools.args('set_generation_settings')?.positivePrompt).toContain('1girl');
    expect(tools.args('set_generation_settings')?.negativePrompt).toContain('lowres');
  });

  it('adds a LoRA that matches the chosen base', async () => {
    const { tools } = await ask('ドット絵の猫');
    expect(tools.args('add_lora')).toMatchObject({ key: 'lora-pixel-art-xl' });
  });

  it('asks for more detail, changing nothing, when nothing is recognized', async () => {
    const { reply, tools } = await ask('あれをお願い');
    expect(tools.calls).toEqual([]);
    expect(reply.text).toContain('もう少し教えて');
  });

  it('answers in English when asked to', async () => {
    const { reply } = await ask('a photo of a cat', { locale: 'en' });
    expect(reply.text).toMatch(/^I chose/);
  });
});

describe('the mock assistant answering questions', () => {
  const foo = { id: 'ext:ComfyUI-Foo', name: 'ComfyUI-Foo', about: 'Draws foo', installed: false };

  it('looks up the extension asked about from the manager and offers to install one that is missing', async () => {
    const { reply, tools } = await ask('what is this', { locale: 'en', focus: foo.id }, { search_extensions: { extensions: [foo] } });
    expect(tools.args('search_extensions')).toEqual({ ids: [foo.id] });
    expect(reply.text).toContain('Draws foo');
    expect(tools.args('recommend_packs')).toEqual({ ids: [foo.id] });
  });

  it('names the nodes of an installed extension and does not recommend it again', async () => {
    const installed = { ...foo, installed: true, nodes: [{ name: 'Foo Draw', inputs: [], outputs: [] }] };
    const { reply, tools } = await ask('what does ComfyUI-Foo do', { locale: 'en' }, { search_extensions: { extensions: [installed] } });
    expect(tools.args('search_extensions')).toEqual({ query: 'what does ComfyUI-Foo do' });
    expect(reply.text).toContain('Foo Draw');
    expect(tools.tools()).not.toContain('recommend_packs');
  });

  it('answers a question about a screen from the guide', async () => {
    const guide = [{ id: 'tab.models', name: 'Models', about: 'Lists the installed models' }];
    const { reply } = await ask('Where is Models?', { locale: 'en' }, { get_app_guide: guide, search_extensions: { extensions: [] } });
    expect(reply.text).toContain('Lists the installed models');
  });

  it('reads the recent pictures only with permission, and says so when it is declined', async () => {
    const pictures = { total: 2, images: [{ name: 'a.png', prompt: 'a cat' }] };
    const allowed = await ask('最近の画像を見て', {}, { list_gallery_images: pictures });
    expect(allowed.reply.text).toContain('a cat');
    const declined = await ask('最近の画像を見て', {}, {}, ['list_gallery_images']);
    expect(declined.reply.text).toContain('許可がない');
  });
});

describe('the mock assistant on the other screens', () => {
  it('places a named pose on the canvas, and leaves other screens and words alone', async () => {
    const { tools } = await ask('a pose with both arms up', { locale: 'en', screen: 'canvas' });
    expect(tools.args('set_pose')).toEqual({ people: [expect.objectContaining({ rArm: expect.any(Object), lArm: expect.any(Object) })] });
    expect((await ask('座っているポーズ', { screen: 'canvas' })).tools.tools()).toContain('set_pose');
    expect((await ask('a running pose', { locale: 'en', screen: 'generate' })).tools.tools()).not.toContain('set_pose');
    expect((await ask('a standing person', { locale: 'en', screen: 'canvas' })).tools.tools()).not.toContain('set_pose');
  });

  it('fills the music, video and voice forms on their screens', async () => {
    expect((await ask('明るいポップな曲', { screen: 'music' })).tools.args('set_form')).toMatchObject({ kind: 'music', fields: { tags: 'pop, upbeat' } });
    expect((await ask('海を走る船', { screen: 'video' })).tools.args('set_form')).toMatchObject({ kind: 'video', fields: { prompt: '海を走る船' } });
    expect((await ask('こんにちは', { screen: 'voice' })).tools.args('set_form')).toMatchObject({ kind: 'voice', fields: { text: 'こんにちは' } });
  });

  it('recommends only offered packs that are not installed yet', async () => {
    const packs = [
      { id: 'rmbg', name: 'RMBG', goals: [], about: '', installed: false },
      { id: 'sam2', name: 'SAM2', goals: [], about: '', installed: true },
    ];
    const { reply, tools } = await ask('背景を消したい', {}, { search_extensions: { packs, extensions: [] } });
    expect(tools.args('recommend_packs')).toEqual({ ids: ['rmbg'] });
    expect(reply.text).toContain('背景');
    const none = await ask('背景を消したい', {}, { search_extensions: { packs: packs.map((p) => ({ ...p, installed: true })), extensions: [] } });
    expect(none.tools.tools()).not.toContain('recommend_packs');
  });
});
