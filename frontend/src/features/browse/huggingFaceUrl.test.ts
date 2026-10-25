import { describe, expect, it } from 'vitest';
import { parseHuggingFaceInput } from './huggingFaceUrl';

describe('parseHuggingFaceInput', () => {
  it('reads owner/name and a repository page', () => {
    const whole = { repo: 'h94/IP-Adapter', folder: '', file: null };
    expect(parseHuggingFaceInput('h94/IP-Adapter')).toEqual(whole);
    expect(parseHuggingFaceInput('  https://huggingface.co/h94/IP-Adapter/ ')).toEqual(whole);
    expect(parseHuggingFaceInput('huggingface.co/h94/IP-Adapter?library=x#files')).toEqual(whole);
    expect(parseHuggingFaceInput('https://hf.co/h94/IP-Adapter/discussions')).toEqual(whole);
  });

  it('reads the folder of a tree address and the file of a blob or resolve address', () => {
    expect(parseHuggingFaceInput('https://huggingface.co/h94/IP-Adapter/tree/main/sdxl_models')).toEqual({ repo: 'h94/IP-Adapter', folder: 'sdxl_models', file: null });
    expect(parseHuggingFaceInput('https://huggingface.co/h94/IP-Adapter/blob/main/sdxl_models/ip-adapter_sdxl.safetensors')).toEqual({
      repo: 'h94/IP-Adapter',
      folder: 'sdxl_models',
      file: 'sdxl_models/ip-adapter_sdxl.safetensors',
    });
    expect(parseHuggingFaceInput('https://huggingface.co/a/b/resolve/main/x.safetensors?download=true')?.file).toBe('x.safetensors');
    expect(parseHuggingFaceInput('https://huggingface.co/a/b/tree/main')).toEqual({ repo: 'a/b', folder: '', file: null });
  });

  it('refuses what is not a model repository', () => {
    for (const bad of ['', '   ', 'name', 'a b/c', 'https://example.com/a/b', 'https://huggingface.co.evil.example/a/b', 'http://huggingface.co/a/b/../c'.replace('http', 'ftp'), 'https://huggingface.co/datasets/a/b', 'https://huggingface.co/spaces/a/b', 'a/b/tree/main/../x', 'https://huggingface.co/a/%2e%2e/c', 'https://huggingface.co/a/b/tree/main/%zz']) {
      expect(parseHuggingFaceInput(bad), bad).toBeNull();
    }
  });
});
