// Owns the stage <canvas>: render loop, pointer/wheel/space interactions for every tool. With an external view the stage
// lies over a document its host shows itself (a comic page): the view follows the host's box instead of the store's
// viewport, wheel and panning stay the host's, the canvas draws only the chrome (masks, bbox, cursor) and the selected
// layer is drawn on the host's content canvas, which sits in the host's own layer stack.
import { t } from '@/i18n';
import {
  isSlot,
  newId,
  selectedEntity,
  useCanvas,
  type CanvasEntity,
  type CanvasObject,
  type CanvasStore,
  type PoseObject,
  type RectObject,
  type StrokeObject,
  type Rect,
  type Viewport,
} from '@/state/canvas';
import { findImage, useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { toast } from '@/state/toasts';
import { wheelZoomFactor } from '@/ui/zoomMath';
import { docToScreen, HANDLE_CURSORS, hitBbox, normalizeRect, resizeRect, screenToDoc, snap, zoomAt, type BboxHandle, type Point } from '../geometry';
import { addPoseLayer, bucketFill, fillPolygon } from '../actions';
import { onImageLoaded } from '@/ui/canvasDraw/imageCache';
import { readPalette, type StagePalette } from '../palette';
import { dragJoint, hitJoint, poseLineWidth, standingPose, toggleJoint } from '@/state/pose/pose';
import { createCanvas, renderEntity } from '@/ui/canvasDraw/entityRender';
import { drawLayerContent, drawStage, drawStageChrome } from '../render/stageRender';
import { fitBboxOnce, setStageSize } from '../view';

type Drag =
  | { kind: 'pan'; start: Point; vp: Viewport }
  | { kind: 'stroke'; entityId: string; object: StrokeObject }
  | { kind: 'lasso'; entityId: string; object: StrokeObject }
  | { kind: 'rect'; entityId: string; start: Point; object: RectObject }
  | { kind: 'move'; entityId: string; start: Point; ex: number; ey: number; moved: boolean }
  | { kind: 'pose'; entityId: string; objectId: string; joint: number; free: boolean; moved: boolean }
  | { kind: 'bboxMove'; start: Point; rect: Rect; moved: boolean }
  | { kind: 'bboxResize'; handle: BboxHandle; start: Point; rect: Rect; moved: boolean }
  | { kind: 'pick' };

/** A stage over a document its host shows: see the top of this file. */
export interface ExternalView {
  /** The document's size in pixels. The stage's host covers the document as it is shown, so its box gives the view. */
  docSize: () => { width: number; height: number };
  /** The canvas that shows the selected layer in the host's layer stack, or null when there is none. */
  content: () => HTMLCanvasElement | null;
  /** Keeps the generation box inside what the host allows (its document, a sane size); the box tool is offered only with it. */
  limitBbox?: (box: Rect) => Rect;
}

/** How near (in screen pixels) the pointer must be to grab a joint. */
const POSE_HIT_PX = 10;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export class StageController {
  private ctx: CanvasRenderingContext2D;
  private palette: StagePalette;
  private raf = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private drag: Drag | null = null;
  private cursor: Point | null = null;
  private screenCursor: Point | null = null;
  private spaceHeld = false;
  private cleanup: (() => void)[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private host: HTMLElement,
    private store: CanvasStore = useCanvas,
    private external: ExternalView | null = null,
  ) {
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.palette = readPalette(host);
  }

  start() {
    const c = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };
    on(c, 'pointerdown', (e) => this.onPointerDown(e));
    on(c, 'pointermove', (e) => this.onPointerMove(e));
    on(c, 'pointerup', (e) => this.onPointerUp(e));
    on(c, 'pointercancel', (e) => this.onPointerUp(e));
    on(c, 'pointerleave', () => {
      this.cursor = null;
      this.invalidate();
    });
    on(c, 'contextmenu', (e) => e.preventDefault());
    // Over a host's document, the wheel scrolls and zooms the host, and the host has no space-bar panning.
    if (!this.external) {
      on(c, 'wheel', (e) => this.onWheel(e), { passive: false });
      on(window, 'keydown', (e) => this.onKey(e as unknown as KeyboardEvent, true));
      on(window, 'keyup', (e) => this.onKey(e as unknown as KeyboardEvent, false));
      on(window, 'blur', () => {
        this.spaceHeld = false;
        this.updateCursor();
      });
    }

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.host);
    this.cleanup.push(() => ro.disconnect());
    this.cleanup.push(this.store.subscribe(() => this.invalidate()));
    this.cleanup.push(useQueue.subscribe((s, p) => s.progress !== p.progress && this.invalidate()));
    this.cleanup.push(useGallery.subscribe((s, p) => s.images !== p.images && this.invalidate()));
    this.cleanup.push(onImageLoaded(() => this.invalidate()));
    this.resize();
    this.updateCursor();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  }

  private resize() {
    const r = this.host.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(r.width));
    this.height = Math.max(1, Math.floor(r.height));
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    if (!this.external) {
      setStageSize(this.width, this.height, this.store);
      fitBboxOnce(this.store);
    }
    this.render();
  }

  invalidate() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  private overlayImageUrl(): string | null {
    const q = useQueue.getState();
    // Jobs bound for the canvas draw into the Image tab's store only.
    if (this.store === useCanvas && q.progress?.progressImageUrl) {
      const item = q.items.find((i) => i.id === q.progress?.itemId);
      if (item?.destination === 'canvas') return q.progress.progressImageUrl;
    }
    const s = this.store.getState();
    if (s.stagedImageNames.length && s.stagingShowResults) {
      return findImage(s.stagedImageNames[s.stagedIndex] ?? null)?.url ?? null;
    }
    return null;
  }

  /** The view: the store's viewport, or over a host's document the host's box (the document fills it). */
  private viewport(): Viewport {
    if (!this.external) return this.store.getState().viewport;
    const doc = this.external.docSize();
    const box = this.host.getBoundingClientRect();
    const at = this.canvas.getBoundingClientRect();
    return { x: box.left - at.left, y: box.top - at.top, scale: doc.width > 0 && box.width > 0 ? box.width / doc.width : 1 };
  }

  private render() {
    const s = this.store.getState();
    const pending = this.drag?.kind === 'stroke' || this.drag?.kind === 'lasso' || this.drag?.kind === 'rect' ? { entityId: this.drag.entityId, object: this.drag.object } : null;
    const content = this.external?.content() ?? null;
    if (content) this.renderContent(content, pending);
    (this.external ? drawStageChrome : drawStage)(this.ctx, {
      width: this.width,
      height: this.height,
      dpr: this.dpr,
      viewport: this.viewport(),
      entities: s.entities,
      groupHidden: s.groupHidden,
      selectedId: s.selectedEntityId,
      bbox: s.bbox,
      tool: s.tool,
      settings: s.settings,
      palette: this.palette,
      filterPreviews: s.filterPreviews,
      pending,
      overlayImageUrl: this.overlayImageUrl(),
      cursor: this.cursor,
      brushWidth: s.brushWidth,
      eraserWidth: s.eraserWidth,
      mosaicWidth: s.mosaicWidth,
      fillColor: s.fillColor,
      isPanning: this.drag?.kind === 'pan' || this.spaceHeld,
    });
  }

  /**
   * The selected raster layer and the stroke being drawn on it, on the host's content canvas: as many pixels as the document
   * has, or fewer when it is shown smaller (its shown size times the device pixel ratio).
   */
  private renderContent(content: HTMLCanvasElement, pending: { entityId: string; object: CanvasObject } | null) {
    const ctx = content.getContext('2d');
    const doc = this.external?.docSize();
    if (!ctx || !doc || doc.width <= 0 || doc.height <= 0) return;
    const shown = content.getBoundingClientRect().width * (window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(Math.min(doc.width, shown || doc.width)));
    const height = Math.max(1, Math.round((width * doc.height) / doc.width));
    if (content.width !== width || content.height !== height) {
      content.width = width;
      content.height = height;
    }
    const s = this.store.getState();
    const e = selectedEntity(s);
    const layer = e && e.type === 'raster' && !isSlot(e) && e.isEnabled ? e : null;
    drawLayerContent(ctx, layer, layer && pending?.entityId === layer.id ? pending.object : null, width / doc.width);
  }

  private point(e: { clientX: number; clientY: number }): Point {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private updateCursor() {
    const s = this.store.getState();
    let cursor = 'default';
    if (this.drag?.kind === 'pan') cursor = 'grabbing';
    else if (this.spaceHeld || s.tool === 'view') cursor = 'grab';
    else if (s.tool === 'brush' || s.tool === 'eraser' || s.tool === 'mosaic') cursor = 'none';
    else if (s.tool === 'rect' || s.tool === 'lasso' || s.tool === 'pose' || s.tool === 'colorPicker' || s.tool === 'bucket') cursor = 'crosshair';
    else if (s.tool === 'move') cursor = 'move';
    else if (s.tool === 'bbox') {
      const drag = this.drag;
      const hit = drag?.kind === 'bboxResize' ? drag.handle : drag?.kind === 'bboxMove' ? 'inside' : this.screenCursor ? hitBbox(this.screenCursor, this.bboxScreen()) : null;
      cursor = hit === 'inside' ? 'move' : hit ? HANDLE_CURSORS[hit] : 'default';
    }
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
  }

  private limited(box: Rect): Rect {
    return this.external?.limitBbox ? this.external.limitBbox(box) : box;
  }

  private bboxScreen(): Rect {
    const s = this.store.getState();
    const v = this.viewport();
    const p = docToScreen(s.bbox, v);
    return { x: p.x, y: p.y, width: s.bbox.width * v.scale, height: s.bbox.height * v.scale };
  }

  /** Entity that receives drawing, creating a raster layer when nothing is selected. */
  private drawTarget(allowCreate: boolean): CanvasEntity | null {
    const s = this.store.getState();
    let target = selectedEntity(s);
    if (!target) {
      if (!allowCreate) return null;
      const id = s.addEntity('raster');
      target = this.store.getState().entities.find((e) => e.id === id);
      if (!target) return null;
    }
    if (isSlot(target)) {
      toast({ status: 'warning', title: t('canvas.toast.slotLayer') });
      return null;
    }
    if (target.isLocked) {
      toast({ status: 'warning', title: t('canvas.toast.layerLocked') });
      return null;
    }
    if (!target.isEnabled || s.groupHidden[target.type]) {
      toast({ status: 'warning', title: t('canvas.toast.layerHidden') });
      return null;
    }
    return target;
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button === 2 || this.drag) return;
    const s = this.store.getState();
    const p = this.point(e);
    const view = this.viewport();
    const doc = screenToDoc(p, view);
    // Over a host's document only the painting tools (and the box tool, when the host limits the box) work, with the main button.
    if (this.external && (e.button !== 0 || s.tool === 'view' || (s.tool === 'bbox' && !this.external.limitBbox) || s.tool === 'pose')) return;
    this.canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || this.spaceHeld || s.tool === 'view') {
      e.preventDefault();
      this.drag = { kind: 'pan', start: p, vp: s.viewport };
    } else if (e.button !== 0) {
      return;
    } else if (s.tool === 'brush' || s.tool === 'eraser' || s.tool === 'mosaic') {
      const target = this.drawTarget(s.tool === 'brush');
      if (!target) return;
      // A mosaic pixelates the picture of a layer; a mask has no picture to pixelate.
      if (s.tool === 'mosaic' && (target.type === 'inpaint' || target.type === 'regional')) {
        toast({ status: 'warning', title: t('canvas.toast.mosaicLayer') });
        return;
      }
      const lx = doc.x - target.x;
      const ly = doc.y - target.y;
      const b = s.bbox;
      this.drag = {
        kind: 'stroke',
        entityId: target.id,
        object: {
          kind: 'stroke',
          id: newId('stroke'),
          tool: s.tool,
          color: s.fillColor,
          width: s.tool === 'brush' ? s.brushWidth : s.tool === 'mosaic' ? s.mosaicWidth : s.eraserWidth,
          ...(s.tool === 'mosaic' ? { block: s.mosaicBlock } : {}),
          points: [lx, ly],
          clip: s.settings.clipToBbox ? { x: b.x - target.x, y: b.y - target.y, width: b.width, height: b.height } : null,
        },
      };
    } else if (s.tool === 'lasso') {
      const target = this.drawTarget(true);
      if (!target) return;
      const outline: StrokeObject = { kind: 'stroke', id: newId('stroke'), tool: 'brush', color: s.fillColor, width: Math.max(1, 1.5 / view.scale), points: [doc.x - target.x, doc.y - target.y], clip: null };
      this.drag = { kind: 'lasso', entityId: target.id, object: outline };
    } else if (s.tool === 'rect') {
      const target = this.drawTarget(true);
      if (!target) return;
      const start = { x: doc.x - target.x, y: doc.y - target.y };
      this.drag = { kind: 'rect', entityId: target.id, start, object: { kind: 'rect', id: newId('rect'), x: start.x, y: start.y, width: 0, height: 0, color: s.fillColor } };
    } else if (s.tool === 'pose') {
      this.startPose(doc, e, view.scale);
    } else if (s.tool === 'move') {
      const target = selectedEntity(s);
      if (!target) return;
      if (isSlot(target)) {
        toast({ status: 'warning', title: t('canvas.toast.slotLayer') });
        return;
      }
      if (target.isLocked) {
        toast({ status: 'warning', title: t('canvas.toast.layerLocked') });
        return;
      }
      this.drag = { kind: 'move', entityId: target.id, start: doc, ex: target.x, ey: target.y, moved: false };
    } else if (s.tool === 'bbox') {
      const hit = hitBbox(p, this.bboxScreen());
      if (hit === 'inside') this.drag = { kind: 'bboxMove', start: doc, rect: s.bbox, moved: false };
      else if (hit) this.drag = { kind: 'bboxResize', handle: hit, start: doc, rect: s.bbox, moved: false };
    } else if (s.tool === 'colorPicker') {
      this.drag = { kind: 'pick' };
      this.pick(doc);
    } else if (s.tool === 'bucket') {
      // The fill is read from the layer's pixels inside the generation box, or the whole document over a host's document.
      const target = this.drawTarget(false);
      if (!target) {
        if (!selectedEntity(s)) toast({ status: 'warning', title: t('canvas.toast.rasterOnly') });
        return;
      }
      const size = this.external?.docSize();
      void bucketFill(target.id, doc, size ? { x: 0, y: 0, width: size.width, height: size.height } : s.bbox, this.store);
    }
    this.updateCursor();
    this.invalidate();
  }

  /**
   * Pose tool: a joint of a pose on the selected control layer is grabbed (Alt shows or hides it), anywhere else
   * places a standing pose. Without a selected control layer a new one is made.
   */
  private startPose(doc: Point, e: PointerEvent, scale: number) {
    const s = this.store.getState();
    let target: CanvasEntity | null | undefined = selectedEntity(s);
    if (target?.type !== 'control') {
      const id = addPoseLayer(this.store);
      target = this.store.getState().entities.find((x) => x.id === id);
    } else {
      target = this.drawTarget(false);
    }
    if (!target) return;
    const local = { x: doc.x - target.x, y: doc.y - target.y };
    const poses = target.objects.filter((o): o is PoseObject => o.kind === 'pose').reverse();
    for (const pose of poses) {
      const joint = hitJoint(pose, local, POSE_HIT_PX / scale);
      if (joint === null) continue;
      if (e.altKey) {
        const toggled = toggleJoint(pose, joint);
        s.updateEntity(target.id, { objects: target.objects.map((o) => (o.id === pose.id ? toggled : o)) });
      } else {
        this.drag = { kind: 'pose', entityId: target.id, objectId: pose.id, joint, free: e.shiftKey, moved: false };
      }
      return;
    }
    s.addObject(target.id, standingPose(newId('pose'), local, Math.round(s.bbox.height * 0.8), poseLineWidth(s.bbox)));
  }

  private onPointerMove(e: PointerEvent) {
    const s = this.store.getState();
    const p = this.point(e);
    const view = this.viewport();
    const doc = screenToDoc(p, view);
    this.cursor = doc;
    this.screenCursor = p;
    const d = this.drag;
    if (d?.kind === 'pan') {
      s.setViewport({ scale: d.vp.scale, x: d.vp.x + p.x - d.start.x, y: d.vp.y + p.y - d.start.y });
    } else if (d?.kind === 'stroke' || d?.kind === 'lasso') {
      const target = s.entities.find((x) => x.id === d.entityId);
      if (target) {
        const pts = d.object.points;
        const lx = doc.x - target.x;
        const ly = doc.y - target.y;
        const last = pts.length - 2;
        const minDist = 1 / view.scale;
        if (Math.hypot(lx - (pts[last] as number), ly - (pts[last + 1] as number)) >= minDist) {
          const points = e.shiftKey && d.kind === 'stroke' && pts.length >= 2 ? [pts[0] as number, pts[1] as number, lx, ly] : [...pts, lx, ly];
          d.object = { ...d.object, points };
        }
      }
    } else if (d?.kind === 'rect') {
      const target = s.entities.find((x) => x.id === d.entityId);
      if (target) {
        let x1 = doc.x - target.x;
        let y1 = doc.y - target.y;
        if (e.shiftKey) {
          const size = Math.max(Math.abs(x1 - d.start.x), Math.abs(y1 - d.start.y));
          x1 = d.start.x + Math.sign(x1 - d.start.x || 1) * size;
          y1 = d.start.y + Math.sign(y1 - d.start.y || 1) * size;
        }
        const r = normalizeRect(d.start.x, d.start.y, x1, y1);
        d.object = { ...d.object, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      }
    } else if (d?.kind === 'move') {
      if (!d.moved) {
        s.pushHistory();
        d.moved = true;
      }
      s.updateEntity(d.entityId, { x: Math.round(d.ex + doc.x - d.start.x), y: Math.round(d.ey + doc.y - d.start.y) }, { history: false });
    } else if (d?.kind === 'pose') {
      const target = s.entities.find((x) => x.id === d.entityId);
      const pose = target?.objects.find((o): o is PoseObject => o.id === d.objectId && o.kind === 'pose');
      if (target && pose) {
        if (!d.moved) {
          s.pushHistory();
          d.moved = true;
        }
        const moved = dragJoint(pose, d.joint, { x: doc.x - target.x, y: doc.y - target.y }, d.free);
        s.updateEntity(target.id, { objects: target.objects.map((o) => (o.id === pose.id ? moved : o)) }, { history: false });
      }
    } else if (d?.kind === 'bboxMove') {
      if (!d.moved) {
        s.pushHistory();
        d.moved = true;
      }
      const step = s.settings.snapToGrid ? 64 : 8;
      const x = e.altKey ? d.rect.x + doc.x - d.start.x : snap(d.rect.x + doc.x - d.start.x, step);
      const y = e.altKey ? d.rect.y + doc.y - d.start.y : snap(d.rect.y + doc.y - d.start.y, step);
      s.setBbox(this.limited({ ...d.rect, x, y }), { history: false });
    } else if (d?.kind === 'bboxResize') {
      if (!d.moved) {
        s.pushHistory();
        d.moved = true;
      }
      const params = useParams.getState();
      const keepRatio = e.shiftKey || (params.aspectLocked && params.aspectRatio !== 'free');
      const step = s.settings.snapToGrid ? 64 : 8;
      const r = resizeRect(d.rect, d.handle, doc.x - d.start.x, doc.y - d.start.y, { step, ratio: keepRatio ? d.rect.width / d.rect.height : null });
      s.setBbox(this.limited(r), { history: false });
    } else if (d?.kind === 'pick') {
      this.pick(doc);
    }
    this.updateCursor();
    this.invalidate();
  }

  private onPointerUp(e: PointerEvent) {
    const d = this.drag;
    this.drag = null;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    const s = this.store.getState();
    if (d?.kind === 'stroke') s.addObject(d.entityId, d.object);
    else if (d?.kind === 'lasso') void fillPolygon(d.entityId, d.object.points, this.store);
    else if (d?.kind === 'rect' && d.object.width > 0 && d.object.height > 0) s.addObject(d.entityId, d.object);
    this.updateCursor();
    this.invalidate();
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const s = this.store.getState();
    if (e.ctrlKey && !e.deltaMode && Math.abs(e.deltaY) >= 50 && (s.tool === 'brush' || s.tool === 'eraser' || s.tool === 'mosaic')) {
      const cur = s.tool === 'brush' ? s.brushWidth : s.tool === 'mosaic' ? s.mosaicWidth : s.eraserWidth;
      const next = cur * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
      if (s.tool === 'brush') s.setBrushWidth(next);
      else if (s.tool === 'mosaic') s.setMosaicWidth(next);
      else s.setEraserWidth(next);
      return;
    }
    s.setViewport(zoomAt(s.viewport, this.point(e), s.viewport.scale * wheelZoomFactor(e)));
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (e.key !== ' ' || isTyping(e.target)) return;
    if (down) e.preventDefault();
    if (this.spaceHeld === down) return;
    this.spaceHeld = down;
    this.updateCursor();
    this.invalidate();
  }

  /** Sample the composite of visible raster and control layers into the fill color. */
  private pick(doc: Point) {
    const s = this.store.getState();
    const c = createCanvas(1, 1);
    const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    ctx.translate(-Math.floor(doc.x), -Math.floor(doc.y));
    for (const e of s.entities) {
      if ((e.type !== 'raster' && e.type !== 'control') || !e.isEnabled || s.groupHidden[e.type]) continue;
      const r = renderEntity(e, { preview: s.filterPreviews[e.id] });
      if (!r) continue;
      ctx.globalAlpha = e.opacity;
      ctx.drawImage(r.canvas, e.x + r.x, e.y + r.y, r.width, r.height);
    }
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if ((d[3] as number) === 0) return;
    s.setFillColor({ r: d[0] as number, g: d[1] as number, b: d[2] as number, a: s.fillColor.a });
  }
}
