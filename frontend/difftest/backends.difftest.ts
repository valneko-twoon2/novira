// @vitest-environment jsdom
// The same calls to the browser mock and to the real backend, case by case, and their answers compared (harness.ts):
// what the end-to-end tests see from the mock must be what the app sees from the backend.
import { describe, it } from 'vitest';
import type { BackendClient } from '../src/backend/client';
import type { EngineSettings } from '../src/backend/types';
import type { ImageDTO } from '../src/backend/types';
import { apart, ORIGIN, png, same, TOKEN, useBackends } from './harness';

/** The pictures brought back come in an order neither side promises; the gallery sorts them when it shows them. */
const newestFirst = (images: ImageDTO[]) => [...images].sort((x, y) => y.createdAt - x.createdAt);

describe.runIf(ORIGIN && TOKEN)('the mock answers as the real backend does', () => {
  const backends = useBackends();

  it('makes, renames, archives and refuses boards alike', async () => {
    await same(backends, (b) => [
      () => b.createBoard('  Trimmed  '),
      () => b.createBoard('   '),
      () => b.createBoard('x'.repeat(300)),
      () => b.createBoard('Second').then((board) => b.updateBoard(board.id, { name: '  Renamed ' })),
      () => b.createBoard('Third').then((board) => b.updateBoard(board.id, { archived: true })),
      () => b.updateBoard('board-none', { name: 'nobody' }),
      () => b.updateBoard('board-none', { name: '   ' }),
    ]);
  });

  it('saves, replaces and deletes workflows alike', async () => {
    await same(backends, async (b) => {
      const first = await b.saveWorkflow({ name: 'Diff A', description: '', author: '', tags: ['x'], graph: { v: 1 } } as never);
      return [
        () => Promise.resolve(first),
        () => b.saveWorkflow({ id: first.id, name: 'Diff A2', description: 'd', author: 'me', tags: [], graph: { v: 2 } } as never),
        () => b.saveWorkflow({ id: 'made-up', name: 'Diff B', description: '', author: '', tags: [], graph: {} } as never),
        () => b.saveWorkflow({ name: '   ', description: '', author: '', tags: [], graph: {} } as never),
        () => b.bootstrap().then((boot) => boot.workflows.filter((w) => w.name.startsWith('Diff ')).sort((x, y) => x.name.localeCompare(y.name))),
        () => b.deleteWorkflow(first.id),
        () => b.deleteWorkflow('wf-none'),
      ];
    });
  });

  it('keeps comics, the canvas and the screen state alike, and refuses the same bad ones', async () => {
    // Only the comics of this case: the sequences (sequences.difftest.ts) save theirs on the same server.
    const comics = (b: BackendClient) => b.listComics().then((list) => list.filter((c) => ['comic-1', 'comic 2'].includes(c.id)).map((c) => ({ id: c.id, document: c.document })));
    await same(backends, (b) => [
      () => b.saveComic('comic-1', { title: 'First', pages: [] }),
      () => b.saveComic('comic 2', {}),
      () => b.saveComic('', {}),
      () => b.saveComic('a/b', {}),
      () => b.saveComic('x'.repeat(65), {}),
      () => comics(b),
      () => b.deleteComic('comic-1'),
      () => b.deleteComic('comic-none'),
      () => comics(b),
      () => b.saveCanvas('{"version":1,"entities":[]}'),
      () => b.loadCanvas(),
      () => b.saveCanvas('[1]'),
      () => b.saveCanvas('not json'),
      () => b.loadCanvas(),
      () => b.saveUiState('{"novira.theme":"light"}'),
      () => b.adoptUiState(null),
      () => b.saveUiState('{"theme":"light"}'),
      () => b.saveUiState('{"novira.x":1}'),
    ]);
  });

  it('uploads, stars, moves, deletes and brings back pictures alike', async () => {
    await same(backends, async (b) => {
      const board = await b.createBoard('Pictures');
      const a = await b.uploadImage(png(16, 12), { boardId: board.id });
      await apart();
      const c = await b.uploadImage(png(8, 8), { boardId: null });
      const gallery = async () => (await b.bootstrap()).images.filter((i) => [a.name, c.name].includes(i.name));
      return [
        () => Promise.resolve([a, c]),
        () => b.uploadImage(new Blob([new TextEncoder().encode('not a picture')]), { boardId: null }),
        () => b.updateImages([a.name], { starred: true }),
        () => b.updateImages([a.name, 'nobody.png'], { boardId: null }),
        () => b.updateImages([c.name], { boardId: board.id }),
        () => gallery(),
        () => b.deleteImages([a.name]),
        () => gallery(),
        () => b.restoreImages([a.name, 'nobody.png']).then(newestFirst),
        () => gallery(),
        () => b.deleteBoard(board.id, false),
        () => gallery(),
      ];
    });
  });

  it('deletes a board with its pictures, keeps the flags of a picture and brings pictures back alike', async () => {
    await same(backends, async (b) => {
      const board = await b.createBoard('With pictures');
      const kept = await b.createBoard('Kept');
      const a = await b.uploadImage(png(4, 4), { boardId: board.id, isIntermediate: true });
      await apart();
      const c = await b.uploadImage(png(6, 4), { boardId: board.id });
      await apart();
      const d = await b.uploadImage(png(4, 6), { boardId: kept.id });
      const names = [a.name, c.name, d.name];
      const gallery = async () => (await b.bootstrap()).images.filter((i) => names.includes(i.name));
      const boards = async () => (await b.bootstrap()).boards.filter((x) => [board.id, kept.id].includes(x.id));
      return [
        () => Promise.resolve([a, c, d]),
        () => b.updateImages([c.name], { isIntermediate: true, starred: true }),
        () => b.updateImages([], { starred: true }),
        () => b.updateImages([d.name], { boardId: 'board-none' }),
        () => gallery(),
        () => b.deleteBoard(board.id, true),
        () => boards(),
        () => gallery(),
        // Back from the bin into a board that is gone: the pictures land outside any board.
        () => b.restoreImages([a.name, c.name]).then(newestFirst),
        () => gallery(),
        () => b.deleteBoard('board-none', true),
        () => b.deleteBoard(kept.id, false),
        () => gallery(),
        () => b.deleteImages([]),
        () => b.restoreImages([]),
      ];
    });
  });

  it('checks and keeps engine settings alike', async () => {
    /** What both sides decide; the folders are each machine's own. */
    const decided = (s: EngineSettings) => ({
      comfyuiPackage: s.comfyuiPackage,
      comfyuiStartTimeoutSecs: s.comfyuiStartTimeoutSecs,
      civitaiLookup: s.civitaiLookup,
      modelRoots: s.modelRoots,
      dataDirNext: s.dataDirNext,
      dataDirMoves: s.dataDirMoves,
      restartNeeded: s.restartNeeded,
    });
    await same(backends, (b) => [
      () => b.engineSettings().then(decided),
      () => b.setEngineSettings({ comfyuiStartTimeoutSecs: 29 }).then(decided),
      () => b.setEngineSettings({ comfyuiStartTimeoutSecs: 30 }).then(decided),
      () => b.setEngineSettings({ comfyuiStartTimeoutSecs: 1800 }).then(decided),
      () => b.setEngineSettings({ comfyuiStartTimeoutSecs: 1801 }).then(decided),
      () => b.setEngineSettings({ comfyuiStartTimeoutSecs: 60.5 }).then(decided),
      () => b.setEngineSettings({ comfyuiPackage: 'amd' }).then(decided),
      () => b.setEngineSettings({ comfyuiPackage: 'intel' as never }).then(decided),
      () => b.setEngineSettings({ civitaiLookup: true }).then(decided),
      () => b.setEngineSettings({ somethingElse: 1 } as never).then(decided),
      () => b.engineSettings().then(decided),
      () => b.setEngineSettings({ comfyuiPackage: 'nvidia', comfyuiStartTimeoutSecs: 180, civitaiLookup: false }).then(decided),
      () => b.removeModelRoot(0).then(decided),
      () => b.removeModelRoot(-1).then(decided),
      // Not cancelDataDirChange or resetComfyuiInstallDir: novira-server answers them "not available in the browser"
      // (SHELL_ONLY in api.rs), while the mock stands for the desktop app.
    ]);
  });

  it('answers calls about things that are not there alike', async () => {
    const calls = (b: BackendClient) => [
      () => b.cancelQueueItem(987654),
      () => b.cancelBatch('no-such-batch'),
      () => b.retryQueueItem(987654),
      () => b.pruneQueue(),
      () => b.updateModel('no-such-model', { name: 'x' }),
      () => b.deleteModel('no-such-model'),
      () => b.modelParts('no-such-model'),
      () => b.listUnfinishedDownloads(),
      () => b.deleteUnfinishedDownloads(['../outside', 'C:\\Windows\\x']),
      () => b.deleteUnfinishedDownloads(['']),
      () => b.deleteUnfinishedDownloads(['a\u0007b']),
      () => b.deleteUnfinishedDownloads(['x'.repeat(512)]),
      () => b.deleteUnfinishedDownloads(['x'.repeat(513)]),
      // 513 bytes in 171 characters: the limit counts bytes.
      () => b.deleteUnfinishedDownloads(['あ'.repeat(171)]),
      () => b.deleteUnfinishedDownloads(Array.from({ length: 1000 }, (_, i) => `p${i}`)),
      () => b.deleteUnfinishedDownloads(Array.from({ length: 1001 }, (_, i) => `p${i}`)),
      () => b.takeRestoredUiState(),
      () => b.checkWatermarkImage('nobody.png'),
      () => b.checkWatermarkImage('../x.png'),
      () => b.lookupReference('en', '   '),
    ];
    await same(backends, calls);
  });
});
