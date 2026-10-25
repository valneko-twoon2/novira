// Draws a text-editor scene onto a 2D canvas: the background, then each visible layer from bottom to top.
import { bubbleGeometry, type Cmd } from './bubble';
import { fontCss } from '@/state/fonts';
import { fitFontSize, layoutText, type Measure, type TextBlock } from './layout';
import type { BubbleLayer, Layer, Scene, TextLayer, TextStyle } from '@/state/text/textModel';
import { unitChar } from './vertical';

function measureWith(ctx: CanvasRenderingContext2D, style: TextStyle): Measure {
  return (text, size) => {
    ctx.font = fontCss(style.fontFamily, style.fontWeight, size);
    // The block adds the letter spacing itself, so measure without it.
    const previous = ctx.letterSpacing;
    ctx.letterSpacing = '0px';
    const width = ctx.measureText(text).width;
    ctx.letterSpacing = previous;
    return width;
  };
}

export interface LaidOut {
  block: TextBlock;
  /** The style the block was laid out with (the font size may have been fitted). */
  style: TextStyle;
}

/** Wraps and sizes the text of a layer. */
function layoutLayer(ctx: CanvasRenderingContext2D, layer: Layer): LaidOut {
  const measure = measureWith(ctx, layer.style);
  if (layer.type === 'text') {
    return { block: layoutText(layer.text, layer.style, null, measure), style: layer.style };
  }
  const box = bubbleGeometry(layer).textBox;
  const size = layer.autoFit ? fitFontSize(layer.text, layer.style, box, measure) : layer.style.fontSize;
  const style = { ...layer.style, fontSize: size, letterSpacing: (layer.style.letterSpacing * size) / layer.style.fontSize };
  return { block: layoutText(layer.text, style, style.vertical ? box.height : box.width, measure), style };
}

/** Half size of the area a layer covers before rotation, for selection and hit tests. */
export function layerHalfSize(ctx: CanvasRenderingContext2D, layer: Layer): { hw: number; hh: number } {
  if (layer.type === 'bubble') return { hw: layer.width / 2, hh: layer.height / 2 };
  const { block, style } = layoutLayer(ctx, layer);
  const pad = (style.stroke?.width ?? 0) + (style.outline?.width ?? 0) + 2;
  return { hw: block.width / 2 + pad, hh: block.height / 2 + pad };
}

function trace(ctx: CanvasRenderingContext2D, cmds: Cmd[]): void {
  ctx.beginPath();
  for (const c of cmds) {
    switch (c[0]) {
      case 'M':
        ctx.moveTo(c[1], c[2]);
        break;
      case 'L':
        ctx.lineTo(c[1], c[2]);
        break;
      case 'Q':
        ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]);
        break;
      case 'C':
        ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
        break;
      case 'Z':
        ctx.closePath();
        break;
    }
  }
}

type Mode = 'fill' | 'stroke';

/** Issues the fill or stroke calls for every glyph of a block, centred on (0, 0). */
function drawGlyphs(ctx: CanvasRenderingContext2D, block: TextBlock, style: TextStyle, bend: number, mode: Mode): void {
  const put = (text: string, x: number, y: number) => (mode === 'fill' ? ctx.fillText(text, x, y) : ctx.strokeText(text, x, y));
  ctx.textBaseline = 'middle';
  if (block.kind === 'h') {
    ctx.font = fontCss(style.fontFamily, style.fontWeight, style.fontSize);
    ctx.letterSpacing = `${style.letterSpacing}px`;
    block.lines.forEach((line, i) => {
      const y = -block.height / 2 + style.fontSize / 2 + i * block.step;
      const x = style.align === 'left' ? -block.width / 2 : style.align === 'right' ? block.width / 2 + style.letterSpacing : style.letterSpacing / 2;
      ctx.textAlign = style.align;
      if (bend === 0 || line.text === '') {
        put(line.text, x, y);
        return;
      }
      drawArc(ctx, line.text, line.width, block.width, style, bend, y, put);
    });
    ctx.letterSpacing = '0px';
    return;
  }
  ctx.textAlign = 'center';
  block.columns.forEach((col, ci) => {
    const cx = block.width / 2 - style.fontSize / 2 - ci * block.step;
    const used = col.length * block.cell;
    const top = style.align === 'left' ? 0 : style.align === 'right' ? block.height - used : (block.height - used) / 2;
    col.forEach((u, ri) => {
      const cy = -block.height / 2 + top + block.cell * (ri + 0.5);
      ctx.save();
      if (u.kind === 'pair') {
        ctx.font = fontCss(style.fontFamily, style.fontWeight, style.fontSize * 0.62);
        put(unitChar(u), cx, cy);
      } else {
        ctx.font = fontCss(style.fontFamily, style.fontWeight, style.fontSize);
        ctx.translate(cx + u.dx * style.fontSize, cy + u.dy * style.fontSize);
        if (u.rotate) ctx.rotate(Math.PI / 2);
        put(u.ch, 0, 0);
      }
      ctx.restore();
    });
  });
}

/** One horizontal line set along a circular arc. */
function drawArc(
  ctx: CanvasRenderingContext2D,
  text: string,
  lineWidth: number,
  blockWidth: number,
  style: TextStyle,
  bend: number,
  y: number,
  put: (text: string, x: number, y: number) => void,
): void {
  const sign = Math.sign(bend);
  const total = (Math.abs(bend) / 100) * Math.PI * 1.2;
  const radius = Math.max(blockWidth, lineWidth, 1) / total;
  ctx.textAlign = 'center';
  ctx.font = fontCss(style.fontFamily, style.fontWeight, style.fontSize);
  ctx.letterSpacing = '0px';
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + style.letterSpacing);
  let s = -widths.reduce((a, b) => a + b, 0) / 2;
  chars.forEach((c, i) => {
    const mid = s + widths[i]! / 2;
    s += widths[i]!;
    const a = mid / radius;
    ctx.save();
    ctx.translate(radius * Math.sin(a), y + sign * radius * (1 - Math.cos(a)));
    ctx.rotate(sign * a);
    put(c, 0, 0);
    ctx.restore();
  });
}

function fillOf(ctx: CanvasRenderingContext2D, style: TextStyle, block: TextBlock): string | CanvasGradient {
  if (style.fill.kind === 'solid') return style.fill.color;
  const g = ctx.createLinearGradient(0, -block.height / 2, 0, block.height / 2);
  g.addColorStop(0, style.fill.top);
  g.addColorStop(1, style.fill.bottom);
  return g;
}

/** Outer outline, inner outline, then the fill; the shadow belongs to the outermost shape. */
function paintBlock(ctx: CanvasRenderingContext2D, laid: LaidOut, bend: number): void {
  const { block, style } = laid;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  let shadowPending = style.shadow;
  const withShadow = (draw: () => void) => {
    if (shadowPending) {
      ctx.shadowColor = shadowPending.color;
      ctx.shadowBlur = shadowPending.blur;
      ctx.shadowOffsetX = shadowPending.offsetX;
      ctx.shadowOffsetY = shadowPending.offsetY;
      shadowPending = null;
      draw();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      draw();
    }
  };
  const inner = style.stroke?.width ?? 0;
  if (style.outline && style.outline.width > 0) {
    ctx.strokeStyle = style.outline.color;
    ctx.lineWidth = 2 * (style.outline.width + inner);
    withShadow(() => drawGlyphs(ctx, block, style, bend, 'stroke'));
  }
  if (style.stroke && style.stroke.width > 0) {
    ctx.strokeStyle = style.stroke.color;
    ctx.lineWidth = 2 * style.stroke.width;
    withShadow(() => drawGlyphs(ctx, block, style, bend, 'stroke'));
  }
  ctx.fillStyle = fillOf(ctx, style, block);
  withShadow(() => drawGlyphs(ctx, block, style, bend, 'fill'));
}

function drawBubble(ctx: CanvasRenderingContext2D, layer: BubbleLayer): void {
  const geo = bubbleGeometry(layer);
  const shapes: Cmd[][] = [geo.body, ...(geo.tail ? [geo.tail] : [])];
  const w = layer.border.width;
  ctx.lineJoin = 'round';
  ctx.lineWidth = w * 2;
  ctx.strokeStyle = layer.border.color;
  ctx.fillStyle = layer.fill;
  // The outline is drawn double width and the fill covers its inner half, so the pointer joins the body without a seam.
  if (geo.dashed) ctx.setLineDash([w * 4.4, w * 3.2]);
  for (const s of shapes) {
    trace(ctx, s);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const c of geo.circles) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const s of shapes) {
    trace(ctx, s);
    ctx.fill();
  }
  for (const c of geo.circles) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (layer.text.trim() !== '') paintBlock(ctx, layoutLayer(ctx, layer), 0);
}

function drawLayerContent(ctx: CanvasRenderingContext2D, layer: Layer): void {
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.type === 'bubble') drawBubble(ctx, layer);
  else if ((layer as TextLayer).text !== '') paintBlock(ctx, layoutLayer(ctx, layer), layer.bend);
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, scene: Scene): void {
  if (layer.opacity >= 1) {
    ctx.save();
    drawLayerContent(ctx, layer);
    ctx.restore();
    return;
  }
  // Partly transparent layers are drawn whole on their own canvas first, so overlapping parts do not show through.
  const sheet = document.createElement('canvas');
  const scale = ctx.getTransform().a;
  sheet.width = Math.max(1, Math.round(scene.width * scale));
  sheet.height = Math.max(1, Math.round(scene.height * scale));
  const sctx = sheet.getContext('2d');
  if (!sctx) return;
  sctx.scale(scale, scale);
  drawLayerContent(sctx, layer);
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(sheet, 0, 0);
  ctx.restore();
}

/**
 * Draws the scene at `scale` (1 = image pixels). `base` is the background picture of an image background. `underlay`
 * paints behind everything in device pixels (the preview's checkerboard); an export passes none.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  base: CanvasImageSource | null,
  scale = 1,
  underlay?: (ctx: CanvasRenderingContext2D) => void,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  underlay?.(ctx);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const bg = scene.background;
  if (bg.kind === 'color' && bg.color) {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, scene.width, scene.height);
  } else if (bg.kind === 'image' && base) {
    ctx.drawImage(base, 0, 0, scene.width, scene.height);
  }
  for (const layer of scene.layers) {
    if (layer.visible) drawLayer(ctx, layer, scene);
  }
  ctx.restore();
}
