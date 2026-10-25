// The 3D view of the pose editor (three.js, loaded only when the editor opens): the 18 joints as balls and the bones as
// sticks in OpenPose's colours, seen from a fixed orthographic camera. Dragging a joint swings its bone round its
// parent; dragging the background turns the whole body (the view). The maths is in math.ts.
import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { POSE_COLORS, POSE_LIMBS } from '@/state/poseSkeleton';
import { POSE_PARENT } from '@/state/pose/pose';
import { aimBone, swingJoint, v3, type Ray, type Vec3 } from '@/state/pose/math3d';

export interface PoseScene {
  /** The joints as they are now, in the body's own space (before the view is turned). */
  joints(): Vec3[];
  view(): { yaw: number; pitch: number };
  setView(yaw: number, pitch: number): void;
  /** Puts the joints back as they were when the scene was made. */
  reset(): void;
  resize(): void;
  dispose(): void;
}

const PITCH_LIMIT = Math.PI / 2;
const UP = new Vector3(0, 1, 0);

/**
 * Builds the scene on `canvas`. `radius` is the half size of what the camera shows (world pixels). `onChange` runs
 * after every edit or turn. Throws when the browser gives no WebGL.
 */
export function createPoseScene(canvas: HTMLCanvasElement, initial: readonly Vec3[], hidden: readonly number[], radius: number, onChange: () => void): PoseScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.4));
  const light = new DirectionalLight(0xffffff, 1.6);
  light.position.set(1, 2, 3);
  scene.add(light);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, radius * 20);
  camera.position.set(0, 0, radius * 8);

  const body = new Group();
  scene.add(body);
  const ballGeometry = new SphereGeometry(radius * 0.04, 20, 14);
  const stickGeometry = new CylinderGeometry(radius * 0.02, radius * 0.02, 1, 12);
  const materials: MeshLambertMaterial[] = [];
  const material = (color: string, dim: boolean, factor = 1) => {
    const m = new MeshLambertMaterial({ color: new Color(color).multiplyScalar(factor), transparent: dim, opacity: dim ? 0.3 : 1 });
    materials.push(m);
    return m;
  };
  const balls = Array.from({ length: POSE_COLORS.length }, (_, i) => {
    const mesh = new Mesh(ballGeometry, material(POSE_COLORS[i] as string, hidden.includes(i)));
    body.add(mesh);
    return mesh;
  });
  const sticks = POSE_LIMBS.map(([a, b], i) => {
    const mesh = new Mesh(stickGeometry, material(POSE_COLORS[i] as string, hidden.includes(a) || hidden.includes(b), 0.7));
    body.add(mesh);
    return mesh;
  });

  let joints = initial.map((p) => ({ ...p }));
  let yaw = 0;
  let pitch = 0;
  let frame = 0;

  const draw = () => {
    frame = 0;
    renderer.render(scene, camera);
  };
  const redraw = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  const place = () => {
    joints.forEach((p, i) => balls[i]?.position.set(p.x, p.y, p.z));
    POSE_LIMBS.forEach(([a, b], i) => {
      const [p, q] = [joints[a] as Vec3, joints[b] as Vec3];
      const d = new Vector3(q.x - p.x, q.y - p.y, q.z - p.z);
      const stick = sticks[i] as Mesh;
      stick.position.set((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
      stick.scale.set(1, Math.max(d.length(), 1e-6), 1);
      if (d.lengthSq() > 0) stick.quaternion.copy(new Quaternion().setFromUnitVectors(UP, d.normalize()));
    });
    body.rotation.set(pitch, yaw, 0);
    redraw();
    onChange();
  };

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const half = radius * 1.25;
    camera.left = -half * Math.max(aspect, 1);
    camera.right = half * Math.max(aspect, 1);
    camera.top = half / Math.min(aspect, 1);
    camera.bottom = -half / Math.min(aspect, 1);
    camera.updateProjectionMatrix();
    redraw();
  };

  // The pointer's ray in the body's own space, so the maths does not need to know the view.
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const setRay = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };
  const localRay = (): Ray => {
    body.updateMatrixWorld();
    const inverse = new Matrix4().copy(body.matrixWorld).invert();
    const origin = raycaster.ray.origin.clone().applyMatrix4(inverse);
    const dir = raycaster.ray.direction.clone().transformDirection(inverse);
    return { origin: v3(origin.x, origin.y, origin.z), dir: v3(dir.x, dir.y, dir.z) };
  };

  let drag: { kind: 'joint'; joint: number } | { kind: 'view'; x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    setRay(e);
    body.updateMatrixWorld();
    const hit = raycaster.intersectObjects(balls, false)[0];
    const joint = hit ? balls.findIndex((b) => b === hit.object) : -1;
    drag = joint >= 0 ? { kind: 'joint', joint } : { kind: 'view', x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    if (drag.kind === 'view') {
      yaw += (e.clientX - drag.x) * 0.01;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + (e.clientY - drag.y) * 0.01));
      drag = { kind: 'view', x: e.clientX, y: e.clientY };
      place();
      return;
    }
    setRay(e);
    const ray = localRay();
    const tip = joints[drag.joint] as Vec3;
    const parentIndex = POSE_PARENT[drag.joint] ?? -1;
    const parent = parentIndex >= 0 ? joints[parentIndex] : undefined;
    let target: Vec3;
    if (parent) target = aimBone(parent, tip, ray);
    else {
      // The neck slides in the picture plane at its own depth.
      const t = Math.abs(ray.dir.z) > 1e-6 ? (tip.z - ray.origin.z) / ray.dir.z : 0;
      target = v3(ray.origin.x + ray.dir.x * t, ray.origin.y + ray.dir.y * t, ray.origin.z + ray.dir.z * t);
    }
    joints = swingJoint(joints, drag.joint, target);
    place();
  };
  const onUp = (e: PointerEvent) => {
    drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    camera.zoom = Math.max(0.5, Math.min(3, camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    camera.updateProjectionMatrix();
    redraw();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  resize();
  place();

  return {
    joints: () => joints.map((p) => ({ ...p })),
    view: () => ({ yaw, pitch }),
    setView: (y, p) => {
      yaw = y;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p));
      place();
    },
    reset: () => {
      joints = initial.map((p) => ({ ...p }));
      place();
    },
    resize,
    dispose: () => {
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      ballGeometry.dispose();
      stickGeometry.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
    },
  };
}
