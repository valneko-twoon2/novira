import { describe, expect, it } from 'vitest';
import type { ComfyNodeDefs } from '@/backend';
import { DETECTOR_NODE, FACE_NODE, buildFaceFixGraph, faceDetectors } from './faceFix';

const defsWith = (names: string[]) => ({ [DETECTOR_NODE]: { input: { required: { model_name: [names] } } } }) as unknown as ComfyNodeDefs;

const options = { modelKey: 'sdxl-key', prompt: '1girl, smile', negative: 'blurry', detector: 'bbox/face_yolov8m.pt', strength: 0.4, sensitivity: 0.5, steps: 20, cfg: 5, scheduler: 'dpmpp_2m_k' } as const;

describe('face fix prompt', () => {
  it('loads the picture and the detector, redraws the faces with the picture\'s model, and saves one picture', () => {
    const g = buildFaceFixGraph('photo.png', options);
    expect(g.prompt.source!.inputs.image).toEqual({ $image: 'photo.png' });
    expect(g.prompt.ckpt!.inputs.ckpt_name).toEqual({ $model: 'sdxl-key' });
    expect(g.prompt.detector).toMatchObject({ class_type: DETECTOR_NODE, inputs: { model_name: 'bbox/face_yolov8m.pt' } });
    const face = g.prompt.face!;
    expect(face.class_type).toBe(FACE_NODE);
    expect(face.inputs).toMatchObject({ image: ['source', 0], bbox_detector: ['detector', 0], denoise: 0.4, bbox_threshold: 0.5, steps: 20, cfg: 5 });
    expect(g.prompt.pos!.inputs.text).toBe('1girl, smile');
    expect(g.prompt.neg!.inputs.text).toBe('blurry');
    expect(g.prompt.save!.inputs.images).toEqual(['face', 0]);
    expect(g.outputs).toEqual(['save']);
  });

  it('lets the backend choose the seed and translate the scheduler', () => {
    const face = buildFaceFixGraph('photo.png', options).prompt.face!;
    expect(face.inputs.seed).toEqual({ $seed: true });
    expect(face.inputs.sampler_name).toEqual({ $sampler_name: 'dpmpp_2m_k' });
    expect(face.inputs.scheduler).toEqual({ $scheduler: 'dpmpp_2m_k' });
  });
});

describe('face detectors', () => {
  it('lists the box detectors the loaded node offers, the ones for faces first, without the segmentation ones', () => {
    expect(faceDetectors(defsWith(['bbox/hand_yolov8s.pt', 'segm/person_yolov8m-seg.pt', 'bbox/face_yolov8m.pt']))).toEqual(['bbox/face_yolov8m.pt', 'bbox/hand_yolov8s.pt']);
  });

  it('is empty while the pack is not loaded or has no box detector', () => {
    expect(faceDetectors(null)).toEqual([]);
    expect(faceDetectors({} as ComfyNodeDefs)).toEqual([]);
    expect(faceDetectors(defsWith(['segm/person_yolov8m-seg.pt']))).toEqual([]);
  });
});
