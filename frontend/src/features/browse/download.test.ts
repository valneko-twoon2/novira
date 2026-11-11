import { describe, expect, it } from 'vitest';
import type { CivitaiFile, CivitaiModel } from '@/backend';
import { fileSource } from './download';

const file = (id: string) => ({ id, name: 'x.safetensors' }) as CivitaiFile;

describe('fileSource', { tags: [] }, () => {
  it('names a Civitai file by model and version-file', { tags: ['equivalence'] }, () => {
    expect(fileSource({ id: '12' } as CivitaiModel, file('3-4'))).toBe('civitai:12/3-4');
  });

  it('names a Hugging Face file by repository and path', { tags: ['equivalence'] }, () => {
    expect(fileSource({ id: 'owner/repo', source: 'huggingface' } as CivitaiModel, file('loras/a.safetensors'))).toBe('owner/repo::loras/a.safetensors');
  });
});
