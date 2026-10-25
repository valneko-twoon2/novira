// "Save page as PSD": the page as a layered Photoshop file. From the bottom: the white paper, the page's backdrop, then the
// page's raster layers in their order: the panels slot gives each panel (its fill and picture, cut to its shape) and all
// the frames together, the balloons slot each balloon, and each raster layer of the user one layer. A layer keeps its
// opacity, blend and visibility (a hidden one is in the file, hidden); masks are not in the file. Every layer is drawn by
// the same code as the saved picture (drawPagePart in pageRender.ts), so the layers stacked give the same page.
//
// The page's effect (mono, e-book, sepia) is a per-pixel colour change: a CSS filter, then the paper tone multiplied over
// it (see effects.ts). The flattened picture of the file is the saved picture itself, effect and all. Each layer gets the
// same filter and the same multiply on its own pixels, keeping its transparency, so the layers look as the page looks
// and still stack to it: the filters are linear colour changes and stacking layers is a weighted mean, so applying the
// filter before or after stacking gives the same colours (but for rounding, and where a contrast is cut off at black or
// white along a soft edge).
import { t } from '@/i18n';
import { plainText } from '@/state/comic/balloonText';
import type { ComicEffect, ComicPage } from '@/state/comic/document';
import { EFFECT_LOOK } from '@/state/comic/effects';
import { layerName } from '@/state/comic/layerName';
import { BALLOONS_SLOT, PANELS_SLOT } from '@/state/comic/pageCanvasDoc';
import { croppedLayer, encodePsd, type PsdDocument, type PsdLayer } from '@/state/psd';
import { drawPage, drawPagePart, pageCanvas, pageGroups, preparePage, type PagePart, type PreparedPage } from './pageRender';

/** One layer of the page's file: its name, the part of the page drawn in it, and the look of the page's layer it is in. */
export interface PageLayer {
  name: string;
  part: PagePart;
  look?: Pick<PsdLayer, 'opacity' | 'hidden' | 'blend'>;
}

/** How many characters of a balloon's words its layer's name shows. */
const NAME_WORDS = 16;

/** The start of a balloon's words on one line, for its layer's name. */
export function firstWords(text: string): string {
  const chars = [...plainText(text).replace(/\s+/g, ' ').trim()];
  return chars.length > NAME_WORDS ? `${chars.slice(0, NAME_WORDS).join('').trimEnd()}…` : chars.join('');
}

/**
 * The layers of the page's file, bottom first: the paper, the backdrop (when there is one), then the page's raster layers:
 * the panels slot gives one layer per panel and one with every frame (when a panel has one), the balloons slot one per
 * balloon with words, panel by panel, and each raster layer of the user one layer under its name. Panels and balloons are
 * numbered as the page lists them.
 */
export function pageLayers(prepared: PreparedPage): PageLayer[] {
  const layers: PageLayer[] = [{ name: t('comic.psd.paper'), part: { kind: 'paper' } }];
  if (prepared.page.backdrop && prepared.backdrop) layers.push({ name: t('comic.psd.backdrop'), part: { kind: 'backdrop' } });
  for (const { layer, parts } of pageGroups(prepared)) {
    if (!layer) continue;
    const look = { opacity: layer.opacity, hidden: !layer.isEnabled, blend: layer.blend ?? 'normal' };
    const add = (name: string, part: PagePart) => layers.push({ name, part, look });
    if (layer.slot === PANELS_SLOT) {
      for (const part of parts) if (part.kind === 'panel') add(t('comic.panel.number', { number: part.index + 1 }), part);
      if (prepared.panels.some((p) => p.outline)) add(t('comic.psd.frames'), { kind: 'frames' });
    } else if (layer.slot === BALLOONS_SLOT) {
      for (const part of parts) {
        if (part.kind !== 'balloon') continue;
        const number = (prepared.panels.find((p) => p.index === part.index)?.panel.bubbles.indexOf(part.bubble) ?? 0) + 1;
        add(t('comic.psd.balloon', { panel: part.index + 1, number, words: firstWords(part.bubble.text) }), part);
      }
    } else for (const part of parts) add(layerName(layer), part);
  }
  return layers;
}

/** "#rrggbb" as its three channels. */
function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** The pixels of a drawn layer with the page's effect on them (see the top of this file), its transparency kept. */
function layerPixels(canvas: HTMLCanvasElement, effect: ComicEffect): Uint8ClampedArray {
  const { width, height } = canvas;
  const look = EFFECT_LOOK[effect];
  let source = canvas;
  if (look.filter !== 'none') {
    source = pageCanvas({ width, height }).canvas;
    const ctx = source.getContext('2d')!;
    ctx.filter = look.filter;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }
  const pixels = source.getContext('2d')!.getImageData(0, 0, width, height).data;
  if (look.paper) {
    const [r, g, b] = rgbOf(look.paper);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = (pixels[i]! * r) / 255;
      pixels[i + 1] = (pixels[i + 1]! * g) / 255;
      pixels[i + 2] = (pixels[i + 2]! * b) / 255;
    }
  }
  return pixels;
}

/** The page's file as layers and its flattened picture. A layer with nothing drawn in it is left out. */
export function buildPagePsd(prepared: PreparedPage, effect: ComicEffect): PsdDocument {
  const { width, height } = prepared;
  const { canvas, ctx } = pageCanvas(prepared);
  const layers: PsdLayer[] = [];
  for (const { name, part, look } of pageLayers(prepared)) {
    ctx.clearRect(0, 0, width, height);
    drawPagePart(ctx, prepared, part);
    const layer = croppedLayer(name, layerPixels(canvas, effect), width, height, look);
    if (layer) layers.push(layer);
  }
  const flat = drawPage(prepared, effect);
  const composite = flat.getContext('2d')!.getImageData(0, 0, width, height).data;
  return { width, height, layers, composite };
}

/** The page as the bytes of a PSD file (see the top of this file). `urlOf` finds a picture's address as renderPage does. */
export async function renderPagePsd(page: ComicPage, urlOf: (imageName: string) => string | undefined, effect: ComicEffect = 'none'): Promise<Uint8Array> {
  return encodePsd(buildPagePsd(await preparePage(page, urlOf), effect));
}
