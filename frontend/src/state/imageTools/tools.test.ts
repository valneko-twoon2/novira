// Reading the picture tools' stored settings back: a damaged or older store never breaks the band.
import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOL_SETTINGS, TOOL_RANGES, restoreToolSettings } from './tools';

describe('restoreToolSettings', () => {
  it('gives the defaults for nothing, or for something that is not settings', () => {
    for (const stored of [undefined, null, 'x', 3, [], {}]) expect(restoreToolSettings(stored)).toEqual(DEFAULT_TOOL_SETTINGS);
  });

  it('keeps stored values that are in range', () => {
    const stored = {
      facefix: { detector: 'bbox/face_yolov8m.pt', strength: 0.6, sensitivity: 0.3 },
      cutout: { model: 'BEN2', sensitivity: 0.5, edge: -3, background: 'white' },
      caption: { style: 'sentence' },
      pose: {},
    };
    expect(restoreToolSettings(stored)).toEqual(stored);
  });

  it('holds numbers to their ranges at both ends and rounds the edge to whole pixels', () => {
    const low = restoreToolSettings({ facefix: { strength: -1, sensitivity: 0 }, cutout: { sensitivity: 0, edge: -99 } });
    expect(low.facefix).toMatchObject({ strength: TOOL_RANGES.faceStrength.min, sensitivity: TOOL_RANGES.faceSensitivity.min });
    expect(low.cutout).toMatchObject({ sensitivity: TOOL_RANGES.cutoutSensitivity.min, edge: TOOL_RANGES.cutoutEdge.min });
    const high = restoreToolSettings({ facefix: { strength: 9, sensitivity: 9 }, cutout: { sensitivity: 9, edge: 2.6 } });
    expect(high.facefix).toMatchObject({ strength: TOOL_RANGES.faceStrength.max, sensitivity: TOOL_RANGES.faceSensitivity.max });
    expect(high.cutout).toMatchObject({ sensitivity: TOOL_RANGES.cutoutSensitivity.max, edge: 3 });
  });

  it('replaces values of the wrong kind by the defaults', () => {
    const s = restoreToolSettings({ facefix: { detector: '', strength: 'strong', sensitivity: Number.NaN }, cutout: { model: 7, background: 'pink' }, caption: { style: 'poem' } });
    expect(s.facefix).toEqual(DEFAULT_TOOL_SETTINGS.facefix);
    expect(s.cutout).toMatchObject({ model: null, background: 'alpha' });
    expect(s.caption.style).toBe('tags');
  });
});
