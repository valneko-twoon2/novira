// Mock videos: a short WebM recorded from a canvas that slowly pans and zooms over the synthesized picture.
// Returns null where recording is not available (tests), and the caller then shows the still image.
export async function synthesizeVideo(source: HTMLCanvasElement, opts: { frames: number; fps: number }): Promise<string | null> {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  const scale = Math.min(1, 480 / Math.max(source.width, source.height));
  const out = document.createElement('canvas');
  out.width = Math.max(2, Math.round(source.width * scale));
  out.height = Math.max(2, Math.round(source.height * scale));
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  const stream = out.captureStream(opts.fps);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const total = Math.min(opts.frames, 36);
  return new Promise((resolve) => {
    recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
    recorder.start();
    let i = 0;
    const timer = setInterval(() => {
      const k = i / Math.max(1, total - 1);
      const zoom = 1 + 0.12 * k;
      const w = out.width * zoom;
      const h = out.height * zoom;
      ctx.drawImage(source, -(w - out.width) * (0.3 + 0.4 * k), -(h - out.height) * 0.5, w, h);
      if (++i >= total) {
        clearInterval(timer);
        setTimeout(() => recorder.stop(), 60);
      }
    }, 1000 / opts.fps);
  });
}
