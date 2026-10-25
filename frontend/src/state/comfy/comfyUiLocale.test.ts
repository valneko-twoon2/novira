// Reading ComfyUI's words: once per language, the newest language wins when two are read at once, and a failure keeps
// the English names and is logged.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type ComfyUiLocale } from '@/backend';
import { useDevLog } from '@/state/devLog';
import { useComfyUiLocale } from './comfyUiLocale';

const words = (heading: string): ComfyUiLocale => ({ categories: {}, comfyNodesHeading: heading, extensionsHeading: null, nodes: {} });

afterEach(() => {
  vi.restoreAllMocks();
  useComfyUiLocale.setState({ locale: null, words: null });
});

describe('ComfyUI words', () => {
  it('reads the words of a language once', async () => {
    const read = vi.spyOn(backend, 'comfyUiLocale').mockResolvedValue(words('A'));
    await useComfyUiLocale.getState().load('ja');
    await useComfyUiLocale.getState().load('ja');
    expect(read).toHaveBeenCalledTimes(1);
    expect(useComfyUiLocale.getState().words?.comfyNodesHeading).toBe('A');
  });

  it('keeps the words of the newest language when an older answer comes last', async () => {
    let answerJa: (w: ComfyUiLocale) => void = () => {};
    vi.spyOn(backend, 'comfyUiLocale').mockImplementation((locale) =>
      locale === 'ja' ? new Promise((r) => (answerJa = r)) : Promise.resolve(words('fr')),
    );
    const ja = useComfyUiLocale.getState().load('ja');
    await useComfyUiLocale.getState().load('fr');
    answerJa(words('ja'));
    await ja;
    expect(useComfyUiLocale.getState()).toMatchObject({ locale: 'fr', words: { comfyNodesHeading: 'fr' } });
  });

  it('keeps no words and logs it when ComfyUI cannot answer', async () => {
    vi.spyOn(backend, 'comfyUiLocale').mockRejectedValue(new Error('offline'));
    const before = useDevLog.getState().entries.length;
    await useComfyUiLocale.getState().load('ja');
    expect(useComfyUiLocale.getState().words).toBeNull();
    expect(useDevLog.getState().entries.slice(before).some((e) => e.message.includes('offline'))).toBe(true);
  });
});
