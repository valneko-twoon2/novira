import { describe, expect, it } from 'vitest';
import type { ComfyNodeDefs } from '@/backend';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { mockPoseExtract } from '@/backend/mock/poseExtract';
import { MAX_EXTRACTED_PEOPLE, POSE_EXTRACT_NODE, buildPoseExtractGraph, parsePoseExtract, poseExtractReady } from './poseExtract';

/** One person's 54 numbers: every joint at `(x, y)` with a score, except the joints in `missing` (not found: zeros). */
const person = (x: number, y: number, missing: number[] = [], spread = 0) => ({
  pose_keypoints_2d: Array.from({ length: 18 }, (_, j) => (missing.includes(j) ? [0, 0, 0] : [x, y + j * spread, 1])).flat(),
});
const answer = (people: unknown[], w = 400, h = 200) => JSON.stringify([{ people, canvas_width: w, canvas_height: h }]);

describe('pose extraction prompt', () => {
  it('loads the picture, asks only for the body and shows the keypoints output as text', () => {
    const g = buildPoseExtractGraph('photo.png', PACK_NODE_DEFS);
    expect(g.prompt.source!.inputs.image).toEqual({ $image: 'photo.png' });
    expect(g.prompt.pose!.class_type).toBe(POSE_EXTRACT_NODE);
    expect(g.prompt.pose!.inputs).toMatchObject({ image: ['source', 0], detect_body: 'enable', detect_hand: 'disable', detect_face: 'disable' });
    expect(g.prompt.show).toEqual({ class_type: 'PreviewAny', inputs: { source: ['pose', 1] } });
    expect(g.outputs).toEqual(['show']);
  });

  it('wires the output the real node names POSE_KEYPOINT', () => {
    expect(PACK_NODE_DEFS[POSE_EXTRACT_NODE]!.output_name?.[1]).toBe('POSE_KEYPOINT');
  });

  it('uses the CPU-friendly detector and estimator when offered, and the first offered otherwise', () => {
    expect(buildPoseExtractGraph('a.png', PACK_NODE_DEFS).prompt.pose!.inputs).toMatchObject({ bbox_detector: 'yolox_l.onnx', pose_estimator: 'dw-ll_ucoco_384.onnx' });
    const defs = { DWPreprocessor: { input: { required: {}, optional: { bbox_detector: [['None', 'other.onnx']], pose_estimator: [['only.pt']] } } } } as unknown as ComfyNodeDefs;
    expect(buildPoseExtractGraph('a.png', defs).prompt.pose!.inputs).toMatchObject({ bbox_detector: 'other.onnx', pose_estimator: 'only.pt' });
    expect(buildPoseExtractGraph('a.png', null).prompt.pose!.inputs).not.toHaveProperty('pose_estimator');
  });

  it('is ready only when the pack is loaded', () => {
    expect(poseExtractReady(null)).toBe(false);
    expect(poseExtractReady({} as ComfyNodeDefs)).toBe(false);
    expect(poseExtractReady(PACK_NODE_DEFS)).toBe(true);
  });
});

describe('pose extraction answer', () => {
  it('reads the people of the answer in 0 to 1 of the picture, with the picture shape', () => {
    const found = parsePoseExtract(answer([person(100, 50)]))!;
    expect(found.aspect).toBe(2);
    expect(found.people).toHaveLength(1);
    expect(found.people[0]!.points.slice(0, 4)).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(found.people[0]!.hidden).toEqual([]);
  });

  it('reads the mock answer, which is a real answer of the node', () => {
    const found = parsePoseExtract(mockPoseExtract())!;
    expect(found.people).toHaveLength(1);
    expect(found.people[0]!.points).toHaveLength(36);
    expect(found.people[0]!.points.every((v) => v > 0 && v <= 1)).toBe(true);
  });

  it('marks the joints that were not found as hidden', () => {
    const found = parsePoseExtract(answer([person(100, 50, [4, 7, 10, 13])]))!;
    expect(found.people[0]!.hidden).toEqual([4, 7, 10, 13]);
  });

  it('drops people with too few joints, keeps the biggest four and orders them left to right', () => {
    const few = person(300, 50, Array.from({ length: 14 }, (_, i) => i));
    const people = [person(300, 20, [], 5), person(50, 20, [], 8), person(150, 20, [], 3), person(250, 20, [], 7), person(350, 20, [], 1), few];
    const found = parsePoseExtract(answer(people))!;
    expect(found.people).toHaveLength(MAX_EXTRACTED_PEOPLE);
    expect(found.people.map((p) => p.points[0]! * 400)).toEqual([50, 250, 300, 150].sort((a, b) => a - b));
  });

  it('treats a missing score or a non-positive position as not found', () => {
    const p = person(100, 50);
    p.pose_keypoints_2d[2] = 0;
    p.pose_keypoints_2d[3] = -1;
    p.pose_keypoints_2d[6] = Number.NaN;
    expect(parsePoseExtract(answer([p]))!.people[0]!.hidden).toEqual([0, 1, 2]);
  });

  it('gives null for text that is not that JSON, and no people for an empty picture', () => {
    expect(parsePoseExtract('')).toBeNull();
    expect(parsePoseExtract('not json')).toBeNull();
    expect(parsePoseExtract('[]')).toBeNull();
    expect(parsePoseExtract('{"people": 3}')).toBeNull();
    expect(parsePoseExtract(JSON.stringify([{ people: [], canvas_width: 0, canvas_height: 10 }]))).toBeNull();
    expect(parsePoseExtract(answer([]))!.people).toEqual([]);
    expect(parsePoseExtract(answer([{ pose_keypoints_2d: [1, 2] }, 'x', null]))!.people).toEqual([]);
  });
});
