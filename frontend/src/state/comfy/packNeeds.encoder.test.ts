import { describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { clipVisionSizeByName, refImagesEncoderReason } from './packNeeds';

const on = (clipVisionModel: 'ViT-H' | 'ViT-G' | 'ViT-L', isEnabled = true) => ({ isEnabled, clipVisionModel });
const encoder = (path: string) => ({ type: 'clip_vision' as const, path });

describe('clipVisionSizeByName', { tags: [] }, () => {
  it('reads the size the way the backend does, from the file name', { tags: ['equivalence'] }, () => {
    expect(clipVisionSizeByName('C:\\m\\CLIP-ViT-H-14.safetensors')).toBe('ViT-H');
    expect(clipVisionSizeByName('/m/clip_vit_bigG.safetensors')).toBe('ViT-G');
    expect(clipVisionSizeByName('/m/vit-l-14.safetensors')).toBe('ViT-L');
    expect(clipVisionSizeByName('/m/model.safetensors')).toBeNull();
  });
});

describe('refImagesEncoderReason', { tags: [] }, () => {
  it('says the encoder is missing when none is installed', { tags: ['boundary', 'condition'] }, () => {
    expect(refImagesEncoderReason([on('ViT-H')], [])).toBe(t('params.readiness.refNeedsEncoder', { size: 'ViT-H' }));
  });
  it('says so when the installed encoders all name another size', { tags: ['condition'] }, () => {
    expect(refImagesEncoderReason([on('ViT-H')], [encoder('/m/vit-l.safetensors')])).toContain('ViT-H');
  });
  it('is quiet when the wanted size is installed, or when an encoder does not say its size', { tags: ['decision-table'] }, () => {
    expect(refImagesEncoderReason([on('ViT-H')], [encoder('/m/CLIP-ViT-H.safetensors')])).toBeNull();
    expect(refImagesEncoderReason([on('ViT-H')], [encoder('/m/model.safetensors')])).toBeNull();
  });
  it('ignores disabled reference images and models that are not encoders', { tags: ['condition'] }, () => {
    expect(refImagesEncoderReason([on('ViT-H', false)], [])).toBeNull();
    expect(refImagesEncoderReason([on('ViT-H')], [{ type: 'main', path: '/m/vit-h.safetensors' }])).toContain('ViT-H');
  });
});
