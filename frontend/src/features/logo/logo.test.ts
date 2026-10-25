import { describe, expect, it } from 'vitest';
import type { ImageDTO } from '@/backend';
import { LOGO_LIMITS, type LogoForm } from '@/state/media/logo';
import { logoPresets } from '@/state/presets/logoPresets';
import { useLogo } from '@/state/media/logo';
import { buildLogoPrompt, buildLogoRequest, logoProblems, logosOf } from './buildRequest';
import { summarizeLogoPreset } from './LogoPresetBar';

const form = (patch: Partial<LogoForm> = {}): LogoForm => ({ text: 'NOVA', style: '', size: 'square', count: 2, seed: 7, randomizeSeed: true, ...patch });

describe('logoProblems', () => {
  it('asks for the lettering and nothing else', () => {
    expect(logoProblems(form({ text: '  ' }), { text: 'need text' })).toEqual(['need text']);
    expect(logoProblems(form(), { text: 'need text' })).toEqual([]);
  });
});

describe('buildLogoPrompt', () => {
  it('quotes the lettering and adds the style only when given', () => {
    expect(buildLogoPrompt({ text: '  NOVA  ', style: '' })).toMatch(/^A professional logo design with the text "NOVA" written clearly\. Clean vector/);
    expect(buildLogoPrompt({ text: 'NOVA', style: ' minimal,\n blue ' })).toContain('Style: minimal, blue.');
  });

  it('keeps the quote closed and the lettering short', () => {
    expect(buildLogoPrompt({ text: 'Say "hi"', style: '' })).toContain(`"Say 'hi'"`);
    const long = buildLogoPrompt({ text: 'x'.repeat(200), style: '' });
    expect(long).toContain(`"${'x'.repeat(LOGO_LIMITS.text)}"`);
    expect(long).not.toContain('x'.repeat(LOGO_LIMITS.text + 1));
  });
});

describe('buildLogoRequest', () => {
  it('asks the logo model for the chosen shape and number of candidates', () => {
    const req = buildLogoRequest(form({ size: 'wide', count: 3 }));
    expect(req.params).toMatchObject({ generationMode: 'logo', width: 1536, height: 768, steps: 8, cfgScale: 1, loras: [] });
    expect(req.iterations).toBe(3);
    expect(req.randomizeSeed).toBe(true);
  });

  it('keeps a fixed seed when asked to', () => {
    const req = buildLogoRequest(form({ randomizeSeed: false, seed: 42 }));
    expect(req.params.seed).toBe(42);
    expect(req.randomizeSeed).toBe(false);
  });

  it('clamps the number of candidates', () => {
    expect(buildLogoRequest(form({ count: 99 })).iterations).toBe(LOGO_LIMITS.count.max);
    expect(buildLogoRequest(form({ count: 0 })).iterations).toBe(LOGO_LIMITS.count.min);
  });
});

describe('logosOf', () => {
  const img = (name: string, createdAt: number, mode: string, extra: Partial<ImageDTO> = {}) =>
    ({ name, createdAt, mediaType: 'image', isIntermediate: false, metadata: { generationMode: mode }, ...extra }) as unknown as ImageDTO;

  it('lists only finished logo images, newest first', () => {
    const images = [
      img('a', 1, 'logo'),
      img('b', 3, 'txt2img'),
      img('c', 2, 'logo'),
      img('d', 4, 'logo', { mediaType: 'video' }),
      img('e', 5, 'logo', { isIntermediate: true }),
    ];
    expect(logosOf(images).map((i) => i.name)).toEqual(['c', 'a']);
  });
});

describe('logo presets', () => {
  it('keep the look and the shape but not the lettering', () => {
    useLogo.getState().setForm({ text: 'NOVA', style: 'neon', size: 'tall', count: 3 });
    expect(logoPresets.snapshot()).toEqual({ style: 'neon', size: 'tall', count: 3 });
    logoPresets.apply({ style: 'retro', size: 'wide' });
    expect(useLogo.getState().form).toMatchObject({ text: 'NOVA', style: 'retro', size: 'wide' });
  });

  it('summarize as the shape and the first style word', () => {
    expect(summarizeLogoPreset({ size: 'wide', style: 'minimalist, flat vector' })).toMatch(/minimalist$/);
    expect(summarizeLogoPreset({})).toBe('');
  });
});
