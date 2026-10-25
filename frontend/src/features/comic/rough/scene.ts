// The 3D view of a panel's rough (three.js, loaded only when the rough's editor opens): the mannequins and props as the
// bake sees them (the same triangles, roughMesh.ts), a floor with a grid, and the panel's camera with its perspective, so
// the view is the panel. Dragging a person or a prop moves it on the floor; dragging a coloured joint of the chosen person
// bends that limb round the joint it hangs from (the neck moves the person); dragging the background turns the camera
// round what it looks at, Shift- or right-dragging slides it, and the wheel brings it nearer. The maths is in state/.
import {
  AmbientLight,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  WebGLRenderer,
  type Material,
} from 'three';
import { ROUGH_DISTANCE, ROUGH_EXTENT, ROUGH_PITCH_MAX, type ComicRough, type RoughPerson } from '@/state/comic/rough';
import { FLOOR_HALF, personTriangles, propTriangles } from '@/state/comic/roughMesh';
import { cameraFrame, localJoints, personJoints, toLocal } from '@/state/comic/roughView';
import { add, aimBone, swingJoint, v3, type Ray, type Vec3 } from '@/state/pose/math3d';
import { POSE_PARENT } from '@/state/pose/pose';
import { POSE_COLORS } from '@/state/poseSkeleton';

export interface RoughScene {
  /** Shows a rough changed from outside (the side panel), keeping the chosen thing when it is still there. */
  set(rough: ComicRough): void;
  /** Chooses a person or a prop (its joints are shown when it is a person), or nothing. */
  select(id: string | null): void;
  resize(): void;
  dispose(): void;
}

export interface RoughSceneEvents {
  /** The rough after an edit in the view: a drag, a turn or a zoom of the camera. */
  change(rough: ComicRough): void;
  /** A person or a prop chosen in the view, or nothing (a click on the background). */
  select(id: string | null): void;
}

const ORBIT_SPEED = 0.008;
const mm = (v: number) => Math.round(v * 1000) / 1000;
const clampPlace = (v: number) => Math.max(-ROUGH_EXTENT, Math.min(ROUGH_EXTENT, v));
/** A theme colour from the page's tokens, so the view follows the light and dark themes. */
const token = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

/** Builds the view on `canvas`, which shows the panel at `aspect` (width over height). Throws when the browser gives no WebGL. */
export function createRoughScene(canvas: HTMLCanvasElement, initial: ComicRough, aspect: number, events: RoughSceneEvents): RoughScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.3));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const camera = new PerspectiveCamera(40, aspect, 0.05, 400);

  const colours = () => ({
    person: token(canvas, '--base-500', '#9a9a9a'),
    prop: token(canvas, '--base-400', '#7a7a7a'),
    floor: token(canvas, '--base-800', '#eeeeee'),
    grid: token(canvas, '--base-600', '#bdbdbd'),
    chosen: token(canvas, '--accent', '#2f6feb'),
  });
  let colour = colours();
  const floor = new Group();
  const floorMaterial = new MeshLambertMaterial({ color: colour.floor });
  const floorPlane = new Mesh(new PlaneGeometry(FLOOR_HALF * 2, FLOOR_HALF * 2), floorMaterial);
  floorPlane.rotation.x = -Math.PI / 2;
  const gridOf = () => {
    const made = new GridHelper(20, 20, colour.grid, colour.grid);
    made.position.y = 0.002;
    return made;
  };
  let grid = gridOf();
  floor.add(floorPlane, grid);
  scene.add(floor);

  const things = new Group();
  scene.add(things);
  const handles = new Group();
  scene.add(handles);
  const handleGeometry = new SphereGeometry(0.035, 12, 8);
  // The joints are drawn over everything, so a joint behind the body can still be taken.
  const handleMaterials = POSE_COLORS.map((c) => new MeshBasicMaterial({ color: c, depthTest: false }));
  const handleMeshes = POSE_COLORS.map((_, i) => {
    const mesh = new Mesh(handleGeometry, handleMaterials[i]);
    mesh.renderOrder = 10;
    mesh.userData.joint = i;
    handles.add(mesh);
    return mesh;
  });

  let rough: ComicRough = structuredClone(initial);
  let chosen: string | null = null;
  const meshes = new Map<string, Mesh>();
  let frame = 0;

  const draw = () => {
    frame = 0;
    renderer.render(scene, camera);
  };
  const redraw = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  const meshOf = (id: string, triangles: number[], kind: 'person' | 'prop') => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const material = new MeshLambertMaterial({ color: id === chosen ? colour.chosen : colour[kind], side: DoubleSide });
    const mesh = new Mesh(geometry, material);
    mesh.userData = { id, kind };
    return mesh;
  };
  const drop = (mesh: Mesh) => {
    things.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as Material).dispose();
  };
  /** Builds the mesh of one person or prop again (after it moved), or all of them. */
  const build = (only?: string) => {
    for (const [id, mesh] of meshes) {
      if (only && id !== only) continue;
      drop(mesh);
      meshes.delete(id);
    }
    for (const prop of rough.props) {
      if (only && prop.id !== only) continue;
      const triangles: number[] = [];
      propTriangles(triangles, prop);
      const mesh = meshOf(prop.id, triangles, 'prop');
      meshes.set(prop.id, mesh);
      things.add(mesh);
    }
    for (const person of rough.people) {
      if (only && person.id !== only) continue;
      const triangles: number[] = [];
      personTriangles(triangles, person);
      const mesh = meshOf(person.id, triangles, 'person');
      meshes.set(person.id, mesh);
      things.add(mesh);
    }
    floor.visible = rough.floor;
    placeHandles();
    redraw();
  };
  const chosenPerson = (): RoughPerson | undefined => rough.people.find((p) => p.id === chosen);
  const placeHandles = () => {
    const person = chosenPerson();
    handles.visible = !!person;
    if (!person) return;
    personJoints(person).forEach((p, i) => handleMeshes[i]?.position.set(p.x, p.y, p.z));
  };
  const placeCamera = () => {
    const f = cameraFrame(rough.camera);
    camera.position.set(f.position.x, f.position.y, f.position.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(rough.camera.target.x, rough.camera.target.y, rough.camera.target.z);
    camera.fov = rough.camera.fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    redraw();
  };
  const paintChoice = () => {
    for (const [id, mesh] of meshes) (mesh.material as MeshLambertMaterial).color.set(id === chosen ? colour.chosen : colour[mesh.userData.kind as 'person' | 'prop']);
    placeHandles();
    redraw();
  };
  const choose = (id: string | null, tell: boolean) => {
    chosen = id && meshes.has(id) ? id : null;
    paintChoice();
    if (tell) events.select(chosen);
  };

  // The theme can change while the editor is open (the settings, or the system's light and dark).
  const retheme = () => {
    colour = colours();
    floorMaterial.color.set(colour.floor);
    floor.remove(grid);
    grid.dispose();
    grid = gridOf();
    floor.add(grid);
    paintChoice();
  };
  const themeWatch = new MutationObserver(retheme);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  const systemTheme = window.matchMedia?.('(prefers-color-scheme: dark)');
  systemTheme?.addEventListener('change', retheme);

  const resize = () => {
    renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1, false);
    placeCamera();
  };

  // Pointer --------------------------------------------------------------------------------------------------------
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const setRay = (e: PointerEvent | WheelEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };
  const worldRay = (): Ray => {
    const { origin, direction } = raycaster.ray;
    return { origin: v3(origin.x, origin.y, origin.z), dir: v3(direction.x, direction.y, direction.z) };
  };
  /** Where the pointer's ray meets the level `y`, or null when it runs away from it. */
  const onLevel = (y: number): Vec3 | null => {
    const { origin, dir } = worldRay();
    if (Math.abs(dir.y) < 1e-6) return null;
    const t = (y - origin.y) / dir.y;
    return t > 0 ? add(origin, v3(dir.x * t, dir.y * t, dir.z * t)) : null;
  };

  type Drag =
    | { kind: 'joint'; person: string; joint: number }
    | { kind: 'move'; id: string; level: number; offset: { x: number; z: number } }
    | { kind: 'orbit'; x: number; y: number; moved: boolean }
    | { kind: 'pan'; x: number; y: number; moved: boolean };
  let drag: Drag | null = null;

  const startMove = (id: string): Drag | null => {
    const thing = rough.people.find((p) => p.id === id) ?? rough.props.find((p) => p.id === id);
    if (!thing) return null;
    const at = onLevel(thing.y);
    return { kind: 'move', id, level: thing.y, offset: at ? { x: thing.x - at.x, z: thing.z - at.z } : { x: 0, z: 0 } };
  };

  const onDown = (e: PointerEvent) => {
    setRay(e);
    const person = chosenPerson();
    const handle = person && handles.visible ? raycaster.intersectObjects(handleMeshes, false)[0] : undefined;
    if (person && handle) {
      const joint = handle.object.userData.joint as number;
      drag = (POSE_PARENT[joint] ?? -1) < 0 ? startMove(person.id) : { kind: 'joint', person: person.id, joint };
    } else {
      const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
      const id = hit ? (hit.object.userData.id as string) : null;
      if (id) {
        choose(id, true);
        drag = startMove(id);
      } else {
        drag = { kind: e.shiftKey || e.button === 2 ? 'pan' : 'orbit', x: e.clientX, y: e.clientY, moved: false };
      }
    }
    canvas.setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent) => {
    const d = drag;
    if (!d) return;
    if (d.kind === 'orbit' || d.kind === 'pan') {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
      d.x = e.clientX;
      d.y = e.clientY;
      const c = rough.camera;
      if (d.kind === 'orbit') {
        rough = { ...rough, camera: { ...c, yaw: c.yaw - dx * ORBIT_SPEED, pitch: Math.max(-ROUGH_PITCH_MAX, Math.min(ROUGH_PITCH_MAX, c.pitch + dy * ORBIT_SPEED)) } };
      } else {
        const f = cameraFrame(c);
        const k = c.distance * 0.0015;
        const t = c.target;
        rough = {
          ...rough,
          camera: { ...c, target: { x: clampPlace(t.x - f.right.x * dx * k + f.up.x * dy * k), y: clampPlace(t.y - f.right.y * dx * k + f.up.y * dy * k), z: clampPlace(t.z - f.right.z * dx * k + f.up.z * dy * k) } },
        };
      }
      placeCamera();
      events.change(rough);
      return;
    }
    setRay(e);
    if (d.kind === 'move') {
      const at = onLevel(d.level);
      if (!at) return;
      const { id, offset } = d;
      const to = { x: mm(clampPlace(at.x + offset.x)), z: mm(clampPlace(at.z + offset.z)) };
      rough = {
        ...rough,
        people: rough.people.map((p) => (p.id === id ? { ...p, ...to } : p)),
        props: rough.props.map((p) => (p.id === id ? { ...p, ...to } : p)),
      };
      build(id);
      events.change(rough);
      return;
    }
    const { person: personId, joint } = d;
    const person = rough.people.find((p) => p.id === personId);
    if (!person) return;
    // The pointer's ray in the person's own space, where its joints are.
    const ray = worldRay();
    const origin = toLocal(person, ray.origin);
    const ahead = toLocal(person, add(ray.origin, ray.dir));
    const local: Ray = { origin, dir: v3(ahead.x - origin.x, ahead.y - origin.y, ahead.z - origin.z) };
    const joints = localJoints(person);
    const parent = joints[POSE_PARENT[joint] as number] as Vec3;
    const next = swingJoint(joints, joint, aimBone(parent, joints[joint] as Vec3, local));
    rough = { ...rough, people: rough.people.map((p) => (p.id === personId ? { ...p, joints: next.flatMap((q) => [mm(q.x), mm(q.y), mm(q.z)]) } : p)) };
    build(personId);
    events.change(rough);
  };

  const onUp = (e: PointerEvent) => {
    // A click on the background (no drag) lets go of the chosen thing.
    if (drag && (drag.kind === 'orbit' || drag.kind === 'pan') && !drag.moved) choose(null, true);
    drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const c = rough.camera;
    const distance = Math.max(ROUGH_DISTANCE.min, Math.min(ROUGH_DISTANCE.max, c.distance * (e.deltaY > 0 ? 1.1 : 1 / 1.1)));
    rough = { ...rough, camera: { ...c, distance: mm(distance) } };
    placeCamera();
    events.change(rough);
  };
  const onMenu = (e: Event) => e.preventDefault();
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onMenu);

  build();
  resize();

  return {
    set: (next) => {
      rough = structuredClone(next);
      build();
      if (chosen && !meshes.has(chosen)) choose(null, false);
      placeCamera();
    },
    select: (id) => choose(id, false),
    resize,
    dispose: () => {
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onMenu);
      for (const mesh of meshes.values()) drop(mesh);
      floorPlane.geometry.dispose();
      floorMaterial.dispose();
      grid.dispose();
      themeWatch.disconnect();
      systemTheme?.removeEventListener('change', retheme);
      handleGeometry.dispose();
      for (const m of handleMaterials) m.dispose();
      renderer.dispose();
    },
  };
}
