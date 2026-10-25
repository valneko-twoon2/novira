// Draws the whole stage: background, layers in order, staging/progress image, bbox and tool overlays.
import type { CanvasEntity, CanvasObject, CanvasSettings, EntityType, FilterPreview, Rect, RGBA, Tool, Viewport } from '@/state/canvas';
import { ENTITY_TYPES } from '@/state/canvas';
import { objectsBounds } from '@/ui/canvasDraw/bounds';
import { getImage } from '@/ui/canvasDraw/imageCache';
import { rgbaCss } from '@/ui/canvasDraw/rgbaCss';
import { BBOX_HANDLES, docToScreen, handlePoint, type Point } from '../geometry';
import type { StagePalette } from '../palette';
import { blendOperation, createCanvas, renderEntity } from '@/ui/canvasDraw/entityRender';

export interface StageScene {
  width: number;
  height: number;
  dpr: number;
  viewport: Viewport;
  entities: CanvasEntity[];
  groupHidden: Record<EntityType, boolean>;
  selectedId: string | null;
  bbox: Rect;
  tool: Tool;
  settings: CanvasSettings;
  palette: StagePalette;
  filterPreviews: Record<string, FilterPreview>;
  pending: { entityId: string; object: CanvasObject } | null;
  /** Staged result or live progress image drawn inside the bbox. */
  overlayImageUrl: string | null;
  /** Cursor in document space (null when outside the stage). */
  cursor: Point | null;
  brushWidth: number;
  eraserWidth: number;
  mosaicWidth: number;
  fillColor: RGBA;
  isPanning: boolean;
}

let checker: { key: string; tile: HTMLCanvasElement } | null = null;

function checkerTile(a: string, b: string): HTMLCanvasElement {
  const key = `${a}|${b}`;
  if (checker?.key === key) return checker.tile;
  const tile = createCanvas(32, 32);
  const ctx = tile.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillRect(16, 16, 16, 16);
  checker = { key, tile };
  return tile;
}

function drawBackground(ctx: CanvasRenderingContext2D, s: StageScene) {
  const pattern = ctx.createPattern(checkerTile(s.palette.checkerA, s.palette.checkerB), 'repeat');
  ctx.fillStyle = pattern ?? s.palette.checkerA;
  ctx.fillRect(0, 0, s.width, s.height);
  if (!s.settings.showGrid) return;
  const v = s.viewport;
  let step = 64;
  while (step * v.scale < 16) step *= 2;
  while (step * v.scale > 160 && step > 8) step /= 2;
  const major = step * 4;
  const x0 = Math.floor(-v.x / v.scale / step) * step;
  const y0 = Math.floor(-v.y / v.scale / step) * step;
  const x1 = (s.width - v.x) / v.scale;
  const y1 = (s.height - v.y) / v.scale;
  ctx.lineWidth = 1;
  for (const strong of [false, true]) {
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
      if ((Math.abs(x % major) < 1e-6) !== strong) continue;
      const sx = Math.round(x * v.scale + v.x) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, s.height);
    }
    for (let y = y0; y <= y1; y += step) {
      if ((Math.abs(y % major) < 1e-6) !== strong) continue;
      const sy = Math.round(y * v.scale + v.y) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(s.width, sy);
    }
    ctx.strokeStyle = strong ? s.palette.gridStrong : s.palette.grid;
    ctx.stroke();
  }
}

let layerScratch: HTMLCanvasElement | null = null;

/** A cleared offscreen canvas the size of the stage's backing store, reused between frames. */
function scratchContext(width: number, height: number): CanvasRenderingContext2D {
  if (!layerScratch || layerScratch.width !== width || layerScratch.height !== height) layerScratch = createCanvas(width, height);
  const sctx = layerScratch.getContext('2d') as CanvasRenderingContext2D;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, width, height);
  return sctx;
}

function drawEntities(ctx: CanvasRenderingContext2D, s: StageScene, types: readonly EntityType[] = ENTITY_TYPES) {
  const v = s.viewport;
  const visible = (e: CanvasEntity) => types.includes(e.type) && e.isEnabled && !s.groupHidden[e.type];
  // A blended layer meets only the layers under it, not the checkerboard, so the layers are drawn apart first.
  const blended = s.entities.some((e) => visible(e) && blendOperation(e) !== 'source-over');
  const target = blended ? scratchContext(ctx.canvas.width, ctx.canvas.height) : ctx;
  ctx.save();
  target.save();
  target.setTransform(v.scale * s.dpr, 0, 0, v.scale * s.dpr, v.x * s.dpr, v.y * s.dpr);
  target.imageSmoothingEnabled = v.scale < 2;
  for (const type of types) {
    if (s.groupHidden[type]) continue;
    for (const e of s.entities) {
      if (e.type !== type || !e.isEnabled) continue;
      const extra = s.pending?.entityId === e.id ? s.pending.object : null;
      const r = renderEntity(e, { extra, preview: s.filterPreviews[e.id] });
      if (!r) continue;
      target.globalAlpha = e.opacity;
      target.globalCompositeOperation = blendOperation(e);
      target.drawImage(r.canvas, e.x + r.x, e.y + r.y, r.width, r.height);
    }
  }
  target.restore();
  if (target !== ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(target.canvas, 0, 0);
  }
  ctx.setTransform(v.scale * s.dpr, 0, 0, v.scale * s.dpr, v.x * s.dpr, v.y * s.dpr);
  ctx.imageSmoothingEnabled = v.scale < 2;
  ctx.globalAlpha = 1;
  if (s.overlayImageUrl) {
    const img = getImage(s.overlayImageUrl);
    if (img) ctx.drawImage(img, s.bbox.x, s.bbox.y, s.bbox.width, s.bbox.height);
  }
  ctx.restore();
}

function screenRect(r: Rect, v: Viewport): Rect {
  const p = docToScreen(r, v);
  return { x: p.x, y: p.y, width: r.width * v.scale, height: r.height * v.scale };
}

function drawBbox(ctx: CanvasRenderingContext2D, s: StageScene) {
  const r = screenRect(s.bbox, s.viewport);
  if (s.settings.dimOutsideBbox) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, s.width, s.height);
    ctx.rect(r.x, r.y, r.width, r.height);
    ctx.fillStyle = s.palette.outside;
    ctx.fill('evenodd');
    ctx.restore();
  }
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = s.palette.cursorShadow;
  ctx.strokeRect(r.x, r.y, r.width, r.height);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = s.palette.bbox;
  ctx.strokeRect(r.x, r.y, r.width, r.height);
  ctx.restore();
  if (s.tool !== 'bbox') return;
  ctx.save();
  for (const h of BBOX_HANDLES) {
    const p = handlePoint(r, h);
    ctx.fillStyle = s.palette.bboxHandle;
    ctx.strokeStyle = s.palette.bbox;
    ctx.lineWidth = 1.5;
    ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
  }
  const label = `${s.bbox.width} × ${s.bbox.height}`;
  ctx.font = '600 11px system-ui, sans-serif';
  const tw = ctx.measureText(label).width + 12;
  const lx = r.x + r.width / 2 - tw / 2;
  const ly = r.y - 24;
  ctx.fillStyle = s.palette.labelBg;
  ctx.beginPath();
  ctx.roundRect(lx, ly, tw, 18, 4);
  ctx.fill();
  ctx.fillStyle = s.palette.labelText;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, lx + 6, ly + 9.5);
  ctx.restore();
}

function drawSelection(ctx: CanvasRenderingContext2D, s: StageScene) {
  if (s.tool !== 'move') return;
  const e = s.entities.find((x) => x.id === s.selectedId);
  if (!e || !e.isEnabled) return;
  const b = objectsBounds(e.objects);
  if (!b) return;
  const r = screenRect({ x: b.x + e.x, y: b.y + e.y, width: b.width, height: b.height }, s.viewport);
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = s.palette.accent;
  ctx.strokeRect(r.x - 0.5, r.y - 0.5, r.width + 1, r.height + 1);
  ctx.restore();
}

/** Pose tool: a handle on every joint of the selected layer's poses; hidden joints are hollow. */
function drawPoseHandles(ctx: CanvasRenderingContext2D, s: StageScene) {
  if (s.tool !== 'pose') return;
  const e = s.entities.find((x) => x.id === s.selectedId);
  if (!e || !e.isEnabled || s.groupHidden[e.type]) return;
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const o of e.objects) {
    if (o.kind !== 'pose') continue;
    for (let i = 0; i * 2 + 1 < o.points.length; i++) {
      const p = docToScreen({ x: e.x + (o.points[i * 2] as number), y: e.y + (o.points[i * 2 + 1] as number) }, s.viewport);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      const hidden = o.hidden.includes(i);
      if (!hidden) {
        ctx.fillStyle = s.palette.cursor;
        ctx.fill();
      }
      ctx.strokeStyle = hidden ? s.palette.cursor : s.palette.cursorShadow;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCursor(ctx: CanvasRenderingContext2D, s: StageScene) {
  if (!s.cursor || s.isPanning || (s.tool !== 'brush' && s.tool !== 'eraser' && s.tool !== 'mosaic')) return;
  const p = docToScreen(s.cursor, s.viewport);
  const radius = Math.max(1, ((s.tool === 'brush' ? s.brushWidth : s.tool === 'mosaic' ? s.mosaicWidth : s.eraserWidth) / 2) * s.viewport.scale);
  ctx.save();
  if (s.tool === 'brush') {
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = rgbaCss(s.fillColor, s.fillColor.a * 0.35);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = s.palette.cursorShadow;
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = s.palette.cursor;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = s.palette.cursor;
  ctx.fill();
  ctx.restore();
}

export function drawStage(ctx: CanvasRenderingContext2D, s: StageScene) {
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  ctx.clearRect(0, 0, s.width, s.height);
  drawBackground(ctx, s);
  drawEntities(ctx, s);
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  drawBbox(ctx, s);
  drawSelection(ctx, s);
  drawPoseHandles(ctx, s);
  drawCursor(ctx, s);
}

/** The masks: what the chrome over an embedded stage draws of the layers (the host shows the rasters itself). */
const MASK_TYPES: readonly EntityType[] = ['inpaint', 'regional'];

/**
 * The chrome of a stage laid over a document its host shows itself (a comic page): nothing under the layers, the masks,
 * a staged result, the bbox, the selection, the pose handles and the brush cursor, on a clear canvas. The bbox is the
 * generation box, so it is drawn only when it matters: with the box tool, on an inpaint mask, or around a staged result.
 */
export function drawStageChrome(ctx: CanvasRenderingContext2D, s: StageScene) {
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  ctx.clearRect(0, 0, s.width, s.height);
  drawEntities(ctx, s, MASK_TYPES);
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  const onMask = s.entities.find((e) => e.id === s.selectedId)?.type === 'inpaint';
  if (s.tool === 'bbox' || onMask || s.overlayImageUrl) drawBbox(ctx, s);
  drawSelection(ctx, s);
  drawPoseHandles(ctx, s);
  drawCursor(ctx, s);
}

/**
 * One layer with the object being drawn on it, on a canvas that covers the whole document at `scale` canvas pixels per
 * document pixel. Its opacity and blend are left to the element that shows the canvas.
 */
export function drawLayerContent(ctx: CanvasRenderingContext2D, entity: CanvasEntity | null, extra: CanvasObject | null, scale: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!entity) return;
  const r = renderEntity(entity, { extra });
  if (!r) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(r.canvas, entity.x + r.x, entity.y + r.y, r.width, r.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
