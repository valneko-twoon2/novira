import { describe, expect, it } from 'vitest';
import { pickDepthModel, pickPoseModel, POSE_COLORS, POSE_JOINT_NAMES, POSE_LIMBS, POSE_MIRROR, poseLimbColor, poseStick } from './poseSkeleton';

describe('the OpenPose skeleton', () => {
  it('has 18 joints, 17 limbs between them and a colour for each', () => {
    expect(POSE_JOINT_NAMES).toHaveLength(18);
    expect(POSE_LIMBS).toHaveLength(17);
    expect(POSE_COLORS).toHaveLength(18);
    for (const [a, b] of POSE_LIMBS) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(POSE_JOINT_NAMES.length);
    }
  });

  it('draws every limb from the neck or along the arms and legs like OpenPose (the neck joins both shoulders and both hips)', () => {
    const neck = POSE_JOINT_NAMES.indexOf('neck');
    const fromNeck = POSE_LIMBS.filter(([a]) => a === neck).map(([, b]) => POSE_JOINT_NAMES[b]);
    expect(fromNeck).toEqual(expect.arrayContaining(['rightShoulder', 'leftShoulder', 'rightHip', 'leftHip', 'nose']));
  });

  it('pairs every right joint with its left partner, and the middle joints with themselves', () => {
    POSE_MIRROR.forEach((m, i) => {
      expect(POSE_MIRROR[m]).toBe(i);
      const name = POSE_JOINT_NAMES[i]!;
      const partner = POSE_JOINT_NAMES[m]!;
      if (name.startsWith('right')) expect(partner).toBe(name.replace('right', 'left'));
      else if (name.startsWith('left')) expect(partner).toBe(name.replace('left', 'right'));
      else expect(m).toBe(i);
    });
  });

  it('paints limbs at 60 % of their colour and scales the stick with the short side, never below 2 pixels', () => {
    expect(poseLimbColor(0)).toBe('rgb(153 0 0)');
    expect(poseLimbColor(9)).toBe('rgb(0 153 153)');
    expect(poseStick(512, 1024)).toBe(4);
    expect(poseStick(2048, 1024)).toBe(8);
    expect(poseStick(16, 16)).toBe(2);
  });
});

describe('pickPoseModel', () => {
  const model = (name: string, base = 'sdxl', type = 'controlnet') => ({ name, base, type, path: '', source: '' });

  it('prefers a model made for OpenPose, then a union model, and only one that fits the main model', () => {
    const models = [model('canny-sdxl'), model('controlnet-union-promax-sdxl'), model('openpose-sdxl'), model('openpose-sd1', 'sd-1')];
    expect(pickPoseModel(models, 'sdxl')?.name).toBe('openpose-sdxl');
    expect(pickPoseModel(models.filter((m) => !/^openpose-sdxl/.test(m.name)), 'sdxl')?.name).toBe('controlnet-union-promax-sdxl');
    expect(pickPoseModel(models, 'sd-1')?.name).toBe('openpose-sd1');
  });

  it('is null when nothing can read a pose, and ignores models that are not ControlNets', () => {
    expect(pickPoseModel([model('canny-sdxl')], 'sdxl')).toBeNull();
    expect(pickPoseModel([model('openpose-lora', 'sdxl', 'lora')], 'sdxl')).toBeNull();
    expect(pickPoseModel([], null)).toBeNull();
  });
});

describe('pickDepthModel', () => {
  const model = (name: string, base = 'sdxl', type = 'controlnet') => ({ name, base, type, path: '', source: '' });

  it('prefers a model made for depth maps, then a union model, and only one that fits the main model', () => {
    const models = [model('openpose-sdxl'), model('controlnet-union-sdxl-1.0'), model('controlnet-depth-sdxl'), model('depth-sd1', 'sd-1')];
    expect(pickDepthModel(models, 'sdxl')?.name).toBe('controlnet-depth-sdxl');
    expect(pickDepthModel(models.slice(0, 2), 'sdxl')?.name).toBe('controlnet-union-sdxl-1.0');
    expect(pickDepthModel(models, 'sd-1')?.name).toBe('depth-sd1');
    expect(pickDepthModel([model('openpose-sdxl')], 'sdxl')).toBeNull();
  });
});
