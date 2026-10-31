// @vitest-environment jsdom
// Random sequences of library calls (boards, pictures, comics) from a fixed seed, run on the mock and on the real
// backend, with the whole of what the sequence made read back after every call. A fixed case covers what someone
// thought of; a sequence also reaches orders nobody wrote down (a picture moved into a board that was just deleted,
// brought back twice, a comic saved over after deletion). The choices depend only on the seed and on how many things the
// sequence has made so far, so both sides get the same calls as long as they agree.
// NOVIRA_DIFF_SEED changes the first seed, NOVIRA_DIFF_RUNS the number of sequences, NOVIRA_DIFF_STEPS their length.
import { describe, it } from 'vitest';
import type { BackendClient } from '../src/backend/client';
import { apart, ORIGIN, png, same, TOKEN, useBackends, type Step } from './harness';

const SEED = Number(process.env.NOVIRA_DIFF_SEED) || 20261031;
const RUNS = Number(process.env.NOVIRA_DIFF_RUNS) || 3;
const STEPS = Number(process.env.NOVIRA_DIFF_STEPS) || 30;

const NAMES = ['A', '  padded  ', '', '   ', 'x'.repeat(100), 'x'.repeat(300), '日本語', 'a/b', '..', '🙂', 'tab\there'];
const COMIC_IDS = ['c1', 'c-2', 'c 3', '', 'a/b', 'x'.repeat(64), 'x'.repeat(65)];

/** xorshift32, as the monkey test: the same seed gives the same sequence. */
function random(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  };
}

/** One sequence on one backend: each step is a call, followed by a read of everything the sequence made. */
function sequence(b: BackendClient, seed: number): Step[] {
  const next = random(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
  const boards: string[] = [];
  const pictures: string[] = [];
  const comics = new Set<string>();
  // A board or picture the sequence made, or now and then one that never was.
  const board = () => (boards.length === 0 || next() < 0.1 ? 'board-none' : pick(boards));
  const boardOrNone = () => (next() < 0.3 ? null : board());
  const some = () => (pictures.length === 0 ? ['nobody.png'] : pictures.filter(() => next() < 0.4).concat(next() < 0.1 ? ['nobody.png'] : []));
  const calls: (() => Promise<unknown>)[] = [
    () => b.createBoard(pick(NAMES)).then((x) => (boards.push(x.id), x)),
    () => b.updateBoard(board(), next() < 0.5 ? { name: pick(NAMES) } : { archived: next() < 0.5 }),
    () => b.deleteBoard(board(), next() < 0.5),
    async () => {
      await apart();
      const x = await b.uploadImage(png(1 + Math.floor(next() * 8), 1 + Math.floor(next() * 8)), { boardId: boardOrNone(), isIntermediate: next() < 0.2 });
      pictures.push(x.name);
      return x;
    },
    () => b.updateImages(some(), pick([{ starred: next() < 0.5 }, { boardId: boardOrNone() }, { isIntermediate: next() < 0.5 }])),
    () => b.deleteImages(some()),
    () => b.restoreImages(some()).then((back) => [...back].sort((x, y) => y.createdAt - x.createdAt)),
    () => {
      const id = pick(COMIC_IDS);
      return b.saveComic(id, { title: pick(NAMES), pages: [] }).then(() => comics.add(id));
    },
    () => b.deleteComic(pick([...comics, 'c-none'])),
  ];
  const state = async () => {
    const boot = await b.bootstrap();
    return {
      boards: boot.boards.filter((x) => boards.includes(x.id)),
      pictures: boot.images.filter((x) => pictures.includes(x.name)),
      comics: (await b.listComics()).filter((c) => comics.has(c.id)).map((c) => ({ id: c.id, document: c.document })),
    };
  };
  const steps: Step[] = [];
  for (let i = 0; i < STEPS; i++) {
    // The call is chosen when the step runs, from what the steps before it made.
    steps.push(() => pick(calls)());
    steps.push(state);
  }
  return steps;
}

describe.runIf(ORIGIN && TOKEN)('random sequences of library calls end alike on the mock and the real backend', () => {
  const backends = useBackends();
  for (let run = 0; run < RUNS; run++) {
    const seed = SEED + run;
    it(`sequence of seed ${seed}`, { timeout: 30_000 + STEPS * 2_000 }, async () => {
      await same(backends, (b) => sequence(b, seed));
    });
  }
});
