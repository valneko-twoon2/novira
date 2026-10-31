// jsdom draws nothing: the mock reads a picture's size from the PNG header, as the backend does.
import { vi } from 'vitest';

vi.mock('../src/backend/mock/imageSynth', async (original) => ({
  ...(await original<typeof import('../src/backend/mock/imageSynth')>()),
  imageSize: vi.fn(async (url: string) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const view = new DataView(bytes.buffer);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }),
}));
