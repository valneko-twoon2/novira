// Draws a comic page as one picture for "save page as picture": each panel's picture covers its frame, the frames are drawn
// in the page's frame colour (as thick as the page's frame width, with the page's inset between the line and the picture), and the balloons
// and captions sit on top where they sit on the page. The page keeps the text itself; this is the one place the text is
// drawn into pixels. Each part (paper, backdrop, a panel, a frame, a balloon) is drawn by drawPagePart, so the picture and
// the layered PSD (pagePsd.ts) are drawn by the same code. The page's raster layers (page.canvas, pageCanvasDoc.ts) are drawn
// in their order: the panels slot gives the panels with their frames, the balloons slot the balloons, and each of the user's
// rasters its objects (by the Canvas's own drawing, ui/canvasDraw), each with its opacity and blend; a hidden one is left
// out. Masks are not part of the page's picture.
import { loadImage } from '@/backend';
import type { RasterEntity } from '@/state/canvas';
import { pagePixels, type ComicBubble, type ComicEffect, type ComicImageView, type ComicPage, type ComicPanel } from '@/state/comic/document';
import { BUBBLE_TEXT_SHARE, DASH, balloonOutline, balloonShape, lineStrokes, seedOf, type Poly } from '@/state/comic/balloon';
import { charMarks, plainText } from '@/state/comic/balloonText';
import { frameStrokes } from '@/state/comic/frames';
import { frameOutlines, panelGeometry } from '@/state/comic/layout';
import { EFFECT_LOOK } from '@/state/comic/effects';
import { pictureBox } from '@/state/comic/imageView';
import { BALLOONS_SLOT, PANELS_SLOT, pageRasters, withUrls } from '@/state/comic/pageCanvasDoc';
import { STAMP_HEIGHT_EM, stampById, stampUrl } from '@/state/comic/stamps';
import type { Shape } from '@/state/comic/shapes';
import { ensureFont } from '@/state/fonts';
import { useSettings } from '@/state/settings';
import { hasContent, imageUrlsOf } from '@/ui/canvasDraw/composite';
import { blendOperation, renderEntity } from '@/ui/canvasDraw/entityRender';
import { preloadImages } from '@/ui/canvasDraw/imageCache';

export { pagePixels };
const FONT = '"Yu Gothic UI", Meiryo, "Malgun Gothic", "Microsoft YaHei", "Segoe UI", sans-serif';
/** The balloon text's size as a share of its panel's width (at the default size), and the most of the panel's width a balloon takes. */
const FONT_SHARE = BUBBLE_TEXT_SHARE;
const BUBBLE_WIDTH_SHARE = 0.42;
/** The most of the panel's height a vertical balloon's column takes. */
const BUBBLE_HEIGHT_SHARE = 0.6;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Scripts written without spaces: a line may break between any two of their characters (CJK, kana, Hangul, full-width forms). */
const SPACELESS = '\\u1100-\\u11ff\\u2e80-\\u9fff\\uac00-\\ud7af\\uf900-\\ufaff\\uff00-\\uffef';
/** The pieces a line is made of: a run of spaces, one character of a spaceless script, or a run of other characters (a word). */
const PIECE = new RegExp(`\\s+|[${SPACELESS}]|[^\\s${SPACELESS}]+`, 'gu');

/**
 * The text split into lines no wider than `maxWidth`. A line breaks at a space, and between any two characters of a script
 * without spaces (Japanese). A word wider than a line breaks between its characters.
 */
export function wrapText(measure: (line: string) => number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    // A word too wide for a line is split into characters, so each of them can start a line.
    const pieces = (paragraph.match(PIECE) ?? []).flatMap((piece) => (!/^\s/.test(piece) && measure(piece) > maxWidth ? [...piece] : [piece]));
    let line = '';
    for (const piece of pieces) {
      if (/^\s/.test(piece)) {
        // A space stays in its line; one at the start of a line is dropped.
        if (line) line += piece;
        continue;
      }
      // The piece moves to a new line when it does not fit; the spaces before it are cut from the end of the old line.
      if (line && measure(line + piece) > maxWidth) {
        lines.push(line.trimEnd());
        line = '';
      }
      line += piece;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

/**
 * The text of a vertical balloon as its columns, in reading order (the first column is the rightmost): each line of the
 * text is a column, and a column longer than `maxChars` continues in the next one.
 */
export function wrapVertical(text: string, maxChars: number): string[] {
  const columns: string[] = [];
  for (const paragraph of text.split('\n')) {
    const chars = [...paragraph];
    if (chars.length === 0) columns.push('');
    for (let i = 0; i < chars.length; i += maxChars) columns.push(chars.slice(i, i + maxChars).join(''));
  }
  return columns;
}

/**
 * The picture as the panel shows it: placed, sized, turned and mirrored by the panel's view (the same box the screen
 * gives it, see imageView.ts), and cut off at the panel's edges by the clip the caller set.
 */
function drawPicture(ctx: CanvasRenderingContext2D, img: HTMLImageElement, rect: Rect, view: ComicImageView) {
  const box = pictureBox(view, { width: img.naturalWidth, height: img.naturalHeight }, rect);
  ctx.save();
  ctx.translate(rect.x + box.cx, rect.y + box.cy);
  ctx.rotate((view.rotation * Math.PI) / 180);
  ctx.scale(view.flipX ? -1 : 1, view.flipY ? -1 : 1);
  ctx.drawImage(img, -box.width / 2, -box.height / 2, box.width, box.height);
  ctx.restore();
}

/**
 * The balloon's outline in the box it is drawn in, as the screen draws it (see BalloonArt): each stroke of its line centred on
 * the outline, then the fill over the inner half, then the ink of a flash. One line's width is a tenth of the text's size.
 */
function drawOutline(ctx: CanvasRenderingContext2D, bubble: ComicBubble, box: Rect, fontPx: number) {
  const shape = balloonShape(bubble, seedOf(bubble.id));
  const trace = (polys: Poly[]) => {
    ctx.beginPath();
    for (const poly of polys) {
      poly.forEach((p, i) => (i ? ctx.lineTo(box.x + p.x * box.width, box.y + p.y * box.height) : ctx.moveTo(box.x + p.x * box.width, box.y + p.y * box.height)));
      ctx.closePath();
    }
  };
  const parts = shape.body ? [...shape.tail, shape.body] : shape.tail;
  const unit = Math.max(1, fontPx * 0.1);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (bubble.line === 'dashed') ctx.setLineDash(DASH.map((d) => d * unit));
  for (const stroke of lineStrokes(bubble.line)) {
    ctx.strokeStyle = stroke.ink ? '#000000' : '#ffffff';
    ctx.lineWidth = stroke.widths * unit * bubble.lineWidth;
    trace(parts);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = bubble.dark ? '#000000' : '#ffffff';
  // Each part is filled alone, so the tail and the body make one shape where they overlap.
  for (const part of parts) {
    trace([part]);
    ctx.fill();
  }
  if (shape.ink.length) {
    ctx.fillStyle = '#000000';
    trace(shape.ink);
    ctx.fill();
  }
  ctx.restore();
}

/** The CSS font families a balloon's words are drawn in: its own font, else the settings' balloon font, then the fallbacks. */
export function bubbleFonts(bubble: ComicBubble, defaultFont: string): string {
  const family = bubble.font || defaultFont;
  return family ? `"${family}", ${FONT}` : FONT;
}

/** Where each line (or column) starts in the plain text, so the marks of its characters can be found. */
function lineStarts(plain: string, lines: string[]): number[] {
  let cursor = 0;
  return lines.map((line) => {
    const at = plain.indexOf(line, cursor);
    const start = at < 0 ? cursor : at;
    cursor = start + line.length;
    return start;
  });
}

/** A stamp balloon: its picture at its place, as tall as STAMP_HEIGHT_EM times the text of a balloon of its size, turned about its middle. */
function drawStamp(ctx: CanvasRenderingContext2D, bubble: ComicBubble, rect: Rect, image: HTMLImageElement | undefined) {
  const stamp = stampById(bubble.text);
  if (!stamp || !image) return;
  const h = rect.width * FONT_SHARE * bubble.scale * STAMP_HEIGHT_EM;
  const w = (h * stamp.width) / stamp.height;
  const x = rect.x + bubble.x * rect.width;
  const y = rect.y + bubble.y * rect.height;
  ctx.save();
  if (bubble.rotation) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((bubble.rotation * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
}

/** A balloon or caption: its outline (the shape of its kind, with its tail) and its text, at the size of its text. */
function drawBubble(ctx: CanvasRenderingContext2D, bubble: ComicBubble, rect: Rect, defaultFont: string, stamps: Map<string, HTMLImageElement>) {
  if (bubble.kind === 'stamp') {
    drawStamp(ctx, bubble, rect, stamps.get(bubble.text));
    return;
  }
  const sfx = bubble.kind === 'sfx';
  const plain = bubble.kind === 'plain';
  const fontPx = rect.width * FONT_SHARE * bubble.scale;
  const pad = fontPx * (sfx ? 0.15 : 0.6);
  const lineHeight = fontPx * (sfx ? 1.1 : 1.3);
  const families = bubbleFonts(bubble, defaultFont);
  // A sound effect is always heavy; elsewhere the bold marks decide (see balloonText).
  const fontFor = (bold: boolean) => `${sfx ? 900 : bold ? 700 : 400} ${fontPx}px ${families}`;
  ctx.font = fontFor(false);
  const words = plainText(bubble.text);
  const marks = charMarks(bubble.text);
  const x = rect.x + bubble.x * rect.width;
  const y = rect.y + bubble.y * rect.height;
  // The text's lines: rows of text, or the columns of a vertical balloon. The box is the text plus its padding.
  let lines: string[];
  let w: number;
  let h: number;
  if (bubble.vertical) {
    const maxChars = Math.max(1, Math.floor((rect.height * BUBBLE_HEIGHT_SHARE - pad * 2) / fontPx));
    lines = wrapVertical(words, maxChars);
    const longest = Math.max(1, ...lines.map((l) => [...l].length));
    w = lines.length * lineHeight + pad * 2;
    h = longest * fontPx + pad * 2;
  } else {
    lines = wrapText((s) => ctx.measureText(s).width, words, rect.width * BUBBLE_WIDTH_SHARE - pad * 2);
    const textWidth = Math.max(fontPx, ...lines.map((l) => ctx.measureText(l).width));
    w = textWidth + pad * 2;
    h = lines.length * lineHeight + pad * 2;
  }
  const starts = lineStarts(words, lines);
  // The lettering is turned about the middle of its box, with everything drawn for it.
  ctx.save();
  if (bubble.rotation) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((bubble.rotation * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  // The outline is drawn in the balloon's own box (larger than the text's box, see balloonOutline), so the tail follows its size and shape.
  if (!sfx && !plain) drawOutline(ctx, bubble, balloonOutline({ x, y, width: w, height: h }, bubble), fontPx);
  ctx.fillStyle = bubble.dark ? '#ffffff' : '#000000';
  ctx.textBaseline = 'top';
  // A sound effect has a white edge around its black letters, drawn first so the letters stay whole; plain words a thin one.
  const edge = sfx ? 0.22 : plain ? 0.12 : 0;
  if (edge) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = fontPx * edge;
    ctx.lineJoin = 'round';
  }
  const letters = (s: string, px: number, py: number) => {
    if (edge) ctx.strokeText(s, px, py);
    ctx.fillText(s, px, py);
  };
  // An emphasis dot: a small round dot centred at a point, in the colour of the words.
  const dot = (cx: number, cy: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, fontPx * 0.07, 0, Math.PI * 2);
    ctx.fill();
  };
  const markAt = (i: number) => marks[i] ?? { bold: false, dots: false };
  if (bubble.vertical) {
    // Columns run from the right; each column is centred in its slot and its characters go down it, their dots on the right.
    ctx.textAlign = 'center';
    lines.forEach((column, i) => {
      const cx = x + w - pad - i * lineHeight - lineHeight / 2;
      let at = starts[i]!;
      [...column].forEach((ch, j) => {
        const mark = markAt(at);
        at += ch.length;
        ctx.font = fontFor(mark.bold);
        const top = y + pad + j * fontPx;
        letters(ch, cx, top);
        if (mark.dots && ch.trim()) dot(cx + fontPx * 0.6, top + fontPx / 2);
      });
    });
    ctx.textAlign = 'left';
  } else {
    // Each line is drawn in runs of the same marks; a dotted character has its dot above it.
    lines.forEach((line, i) => {
      const top = y + pad + i * lineHeight;
      const base = starts[i]!;
      let px = x + pad;
      let k = 0;
      while (k < line.length) {
        const { bold, dots } = markAt(base + k);
        let end = k + 1;
        while (end < line.length && markAt(base + end).bold === bold && markAt(base + end).dots === dots) end++;
        const run = line.slice(k, end);
        ctx.font = fontFor(bold);
        letters(run, px, top);
        if (dots) {
          let cx = px;
          for (const ch of run) {
            const cw = ctx.measureText(ch).width;
            if (ch.trim()) dot(cx + cw / 2, top - fontPx * 0.12);
            cx += cw;
          }
        }
        px += ctx.measureText(run).width;
        k = end;
      }
    });
  }
  ctx.restore();
}

/** The drawn page passed through the effect: its filter, then the paper tone multiplied over it (the same values the screen uses). */
function withEffect(source: HTMLCanvasElement, effect: ComicEffect): HTMLCanvasElement {
  const look = EFFECT_LOOK[effect];
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.filter = look.filter;
  ctx.drawImage(source, 0, 0);
  ctx.filter = 'none';
  if (look.paper) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = look.paper;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  return out;
}

/** The picture formats a page can be drawn as: PNG for the gallery and CBZ, JPEG for PDF. */
export type PageFormat = 'png' | 'jpeg';

const JPEG_QUALITY = 0.92;

function canvasBlob(canvas: HTMLCanvasElement, format: PageFormat): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), `image/${format}`, format === 'jpeg' ? JPEG_QUALITY : undefined),
  );
}

/** A panel as it is placed on the drawn page, in pixels: its region is its shape when the page is reshaped, else its box. */
export interface PlacedPanel {
  /** Its place in the page's panel list. */
  index: number;
  panel: ComicPanel;
  shape: Shape | null;
  rect: Rect;
  /** The line its frame follows (see frames.ts); none when it has no frame. */
  outline: Shape | null | undefined;
  /** Its picture, loaded; null when it has none or the picture is gone. */
  image: HTMLImageElement | null;
}

/**
 * Everything a page needs before any of it is drawn: its size, its panels as placed, its pictures loaded and its balloons'
 * fonts ready. The parts of the page are then drawn from this, one at a time (see drawPagePart), so the saved picture and
 * the layered file draw the same way.
 */
export interface PreparedPage {
  page: ComicPage;
  width: number;
  height: number;
  backdrop: HTMLImageElement | null;
  panels: PlacedPanel[];
  defaultFont: string;
  /**
   * The page's raster layers bottom first (its slots among them), with their pictures' addresses looked up and loaded (a
   * picture that is gone is left out).
   */
  rasters: RasterEntity[];
  /** The pictures of the stamp balloons on the page, loaded, by stamp id. */
  stamps: Map<string, HTMLImageElement>;
}

/** True when the balloon has words to draw (one without words is left off the saved page). */
export function isWritten(bubble: ComicBubble): boolean {
  if (bubble.kind === 'stamp') return stampById(bubble.text) !== undefined;
  return plainText(bubble.text).trim() !== '';
}

/**
 * Loads what the page needs. `urlOf` gives the address of a picture by its gallery name (or undefined when the picture is
 * gone, and the frame stays empty). The balloons' fonts are loaded too (the app's own fonts come in parts, by the
 * characters used), so no fallback is drawn in their place.
 */
export async function preparePage(page: ComicPage, urlOf: (imageName: string) => string | undefined): Promise<PreparedPage> {
  const { width, height } = pagePixels(page);
  const backdropUrl = page.backdrop ? urlOf(page.backdrop.imageName) : undefined;
  const geometry = panelGeometry(page);
  const outlines = frameOutlines(page);
  const placePanel = async (panel: ComicPanel, index: number): Promise<PlacedPanel[]> => {
    const placed = geometry[index];
    if (!placed) return [];
    const { box, shape } = placed;
    const url = panel.imageName ? urlOf(panel.imageName) : undefined;
    const rect = { x: box.x * width, y: box.y * height, width: box.width * width, height: box.height * height };
    return [{ index, panel, shape, rect, outline: outlines[index], image: url ? await loadImage(url) : null }];
  };
  // The backdrop and the panels' pictures load side by side.
  const [backdrop, placedPanels] = await Promise.all([backdropUrl ? loadImage(backdropUrl) : null, Promise.all(page.panels.map(placePanel))]);
  const panels = placedPanels.flat();
  const rasters = withUrls(pageRasters(page.canvas), urlOf) as RasterEntity[];
  await preloadImages(imageUrlsOf(rasters));
  const defaultFont = useSettings.getState().comicFont;
  const written = panels.flatMap(({ panel }) => panel.bubbles).filter(isWritten);
  const stampTexts = [...new Set(written.filter((b) => b.kind === 'stamp').map((b) => b.text))];
  const stamps = new Map(await Promise.all(stampTexts.map(async (text): Promise<[string, HTMLImageElement]> => [text, await loadImage(stampUrl(text))])));
  await Promise.all(
    written.flatMap((b) => {
      const family = b.kind === 'stamp' ? '' : b.font || defaultFont;
      return family ? [ensureFont(family, 400, plainText(b.text)), ensureFont(family, 700, plainText(b.text))] : [];
    }),
  );
  return { page, width, height, backdrop, panels, defaultFont, rasters, stamps };
}

/** One part of a page, drawn alone: the paper, the backdrop, one panel's fill and picture, every frame, or one balloon. */
export type PagePart =
  | { kind: 'paper' }
  | { kind: 'backdrop' }
  | { kind: 'panel'; index: number }
  | { kind: 'frame'; index: number }
  | { kind: 'frames' }
  | { kind: 'balloon'; index: number; bubble: ComicBubble }
  | { kind: 'raster'; entity: RasterEntity };

/** Traces a closed outline given in shares of the page. */
function tracePoly(ctx: CanvasRenderingContext2D, prepared: PreparedPage, poly: Shape) {
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x * prepared.width, p.y * prepared.height) : ctx.moveTo(p.x * prepared.width, p.y * prepared.height)));
  ctx.closePath();
}

/** Runs `draw` cut to the panel's region (its shape when the page is reshaped, else its box). */
function inPanel(ctx: CanvasRenderingContext2D, prepared: PreparedPage, { shape, rect }: PlacedPanel, draw: () => void) {
  ctx.save();
  if (shape) tracePoly(ctx, prepared, shape);
  else {
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.clip();
  draw();
  ctx.restore();
}

/** The frame: rings along the panel's edge, each a stroke centred on it and cut to the panel (see frames.ts). */
function drawFrame(ctx: CanvasRenderingContext2D, prepared: PreparedPage, placed: PlacedPanel) {
  const { outline } = placed;
  if (!outline) return;
  const { page, width } = prepared;
  const strokes = frameStrokes(page);
  inPanel(ctx, prepared, placed, () => {
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    for (const [strokeStyle, lineWidth] of [
      ['#ffffff', strokes.deep * width],
      [page.frameColor, strokes.line * width],
      ['#ffffff', strokes.gutter * width],
    ] as const) {
      // A canvas ignores a line width of 0 and keeps the last one, so a ring of no width is skipped.
      if (lineWidth <= 0) continue;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      tracePoly(ctx, prepared, outline);
      ctx.stroke();
    }
  });
}

/** Draws one part of the prepared page onto `ctx` (a canvas the size of the page). */
export function drawPagePart(ctx: CanvasRenderingContext2D, prepared: PreparedPage, part: PagePart): void {
  const { page, width, height } = prepared;
  const placedAt = (index: number) => prepared.panels.find((p) => p.index === index);
  switch (part.kind) {
    case 'paper':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      return;
    case 'backdrop':
      // The backdrop lies over the page, under every panel.
      if (page.backdrop && prepared.backdrop) drawPicture(ctx, prepared.backdrop, { x: 0, y: 0, width, height }, page.backdrop.view);
      return;
    case 'panel': {
      const placed = placedAt(part.index);
      if (!placed) return;
      const { rect, image, panel } = placed;
      inPanel(ctx, prepared, placed, () => {
        // A panel with no picture is grey, unless a backdrop shows through it.
        if (!page.backdrop) {
          ctx.fillStyle = '#e8e8e8';
          ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }
        if (image) drawPicture(ctx, image, rect, panel.imageView);
      });
      return;
    }
    case 'frame': {
      const placed = placedAt(part.index);
      if (placed) drawFrame(ctx, prepared, placed);
      return;
    }
    case 'frames':
      for (const placed of prepared.panels) drawFrame(ctx, prepared, placed);
      return;
    case 'balloon': {
      // A balloon lies over the gutters, and is cut at its own panel's edge as it is on the screen.
      const placed = placedAt(part.index);
      if (placed && isWritten(part.bubble)) inPanel(ctx, prepared, placed, () => drawBubble(ctx, part.bubble, placed.rect, prepared.defaultFont, prepared.stamps));
      return;
    }
    case 'raster': {
      // A raster layer is drawn by the Canvas's own code, on a canvas of its own (its eraser reaches only its own lines),
      // and put where the layer sits on the page (document space is page pixels). Its look is the caller's (see drawPage).
      const e = part.entity;
      const r = renderEntity(e);
      if (r) ctx.drawImage(r.canvas, e.x + r.x, e.y + r.y, r.width, r.height);
      return;
    }
  }
}

/** The parts of one layer of the page: a raster layer of the page, or (null) the paper and the backdrop under every layer. */
export interface PageGroup {
  layer: RasterEntity | null;
  parts: PagePart[];
}

/** The parts a raster layer draws (whether it is shown or not): the panels or the balloons for a slot, else its objects. */
function layerParts(prepared: PreparedPage, layer: RasterEntity): PagePart[] {
  if (layer.slot === PANELS_SLOT)
    return prepared.panels.flatMap(({ index }): PagePart[] => [
      { kind: 'panel', index },
      { kind: 'frame', index },
    ]);
  if (layer.slot === BALLOONS_SLOT) return prepared.panels.flatMap(({ index, panel }) => panel.bubbles.filter(isWritten).map((bubble): PagePart => ({ kind: 'balloon', index, bubble })));
  if (layer.slot) return [];
  return hasContent(layer) ? [{ kind: 'raster', entity: layer }] : [];
}

/**
 * The page bottom first, layer by layer: the paper and the backdrop, then each raster layer of the page (hidden ones too;
 * the caller leaves them out or keeps them hidden).
 */
export function pageGroups(prepared: PreparedPage): PageGroup[] {
  return [{ layer: null, parts: [{ kind: 'paper' }, { kind: 'backdrop' }] }, ...prepared.rasters.map((layer) => ({ layer, parts: layerParts(prepared, layer) }))];
}

/** Whether a layer is faded or blended, so it is laid over the page with its look. */
const hasLook = (layer: RasterEntity) => layer.opacity < 1 || blendOperation(layer) !== 'source-over';

/**
 * The parts of the saved page in the order they are drawn: the paper, the backdrop, then the shown layers bottom first (by
 * default each panel followed by its frame, then every balloon on top of all the panels).
 */
export function pageParts(prepared: PreparedPage): PagePart[] {
  return pageGroups(prepared).flatMap((g) => (!g.layer || g.layer.isEnabled ? g.parts : []));
}

/** A canvas the size of the page and its 2D context. */
export function pageCanvas(prepared: Pick<PreparedPage, 'width' | 'height'>): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = prepared.width;
  canvas.height = prepared.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  return { canvas, ctx };
}

/** The whole page drawn on one canvas, with the effect over it: the saved picture, and the flattened picture of the layered file. */
export function drawPage(prepared: PreparedPage, effect: ComicEffect = 'none'): HTMLCanvasElement {
  const { canvas, ctx } = pageCanvas(prepared);
  let apart: ReturnType<typeof pageCanvas> | null = null;
  for (const { layer, parts } of pageGroups(prepared)) {
    if (layer && !layer.isEnabled) continue;
    if (!layer || !hasLook(layer)) {
      for (const part of parts) drawPagePart(ctx, prepared, part);
      continue;
    }
    if (!parts.length) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = blendOperation(layer);
    if (layer.slot) {
      // A slot's parts are drawn together first, so the look is laid over them as one layer.
      apart ??= pageCanvas(prepared);
      apart.ctx.clearRect(0, 0, prepared.width, prepared.height);
      for (const part of parts) drawPagePart(apart.ctx, prepared, part);
      ctx.drawImage(apart.canvas, 0, 0);
    } else {
      // A user's raster is one picture already: it is laid on with its look.
      for (const part of parts) drawPagePart(ctx, prepared, part);
    }
    ctx.restore();
  }
  return effect === 'none' ? canvas : withEffect(canvas, effect);
}

/**
 * The page as a picture (PNG unless `format` says otherwise). `urlOf` gives the address of a panel's picture by its gallery name (or undefined when the picture
 * is gone, and the frame stays empty).
 */
export async function renderPage(
  page: ComicPage,
  urlOf: (imageName: string) => string | undefined,
  format: PageFormat = 'png',
  effect: ComicEffect = 'none',
): Promise<Blob> {
  return canvasBlob(drawPage(await preparePage(page, urlOf), effect), format);
}
