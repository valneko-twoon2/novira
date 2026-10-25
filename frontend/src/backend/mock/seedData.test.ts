import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKFLOWS } from '../defaultWorkflows';
import { SEED_BOARDS, SEED_IMAGES, SEED_MODELS, STARTER_MODELS } from './seedData';

const unique = (values: string[]) => new Set(values).size === values.length;

describe('mock seed data', () => {
  it('has unique ids', () => {
    expect(unique(SEED_MODELS.map((m) => m.key))).toBe(true);
    expect(unique(SEED_BOARDS.map((b) => b.id))).toBe(true);
    expect(unique(STARTER_MODELS.map((m) => m.id))).toBe(true);
    expect(unique(DEFAULT_WORKFLOWS.map((w) => w.id))).toBe(true);
  });

  it('makes every sample picture with an installed main model and puts it on a known board', () => {
    const mains = new Set(SEED_MODELS.filter((m) => m.type === 'main').map((m) => m.key));
    const boards = new Set(SEED_BOARDS.map((b) => b.id));
    for (const spec of SEED_IMAGES) {
      expect(mains.has(spec.modelKey), spec.modelKey).toBe(true);
      if (spec.boardId !== null) expect(boards.has(spec.boardId), spec.boardId).toBe(true);
      expect(spec.width % 8 === 0 && spec.height % 8 === 0).toBe(true);
    }
  });
});
