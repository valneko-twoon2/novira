// The Face Rig pack's axes and presets as it reports them (/nkd/facerig/library), and handle positions on a typical
// portrait, for the mock.
import type { FaceRigLibrary } from '../types';

export const MOCK_FACE_RIG_LIBRARY: FaceRigLibrary = {
  axes: [
    { name: 'au12', label: 'smile', au: 'AU12', group: 'mouth', side: 'C', lo: -0.23, hi: 1 },
    { name: 'au26', label: 'jaw open', au: 'AU26', group: 'mouth', side: 'C', lo: -0.25, hi: 1 },
    { name: 'au20', label: 'stretch', au: 'AU20', group: 'mouth', side: 'C', lo: -1, hi: 1 },
    { name: 'au18', label: 'pucker', au: 'AU18', group: 'mouth', side: 'C', lo: -1, hi: 1 },
    { name: 'au45_L', label: 'close', au: 'AU45', group: 'eyes', side: 'L', lo: -0.25, hi: 1 },
    { name: 'au45_R', label: 'close', au: 'AU45', group: 'eyes', side: 'R', lo: -0.25, hi: 1 },
    { name: 'au61', label: 'look right', au: 'AU61', group: 'eyes', side: 'C', lo: 0, hi: 1 },
    { name: 'au62', label: 'look left', au: 'AU62', group: 'eyes', side: 'C', lo: 0, hi: 1 },
    { name: 'au63', label: 'look up', au: 'AU63', group: 'eyes', side: 'C', lo: 0, hi: 1 },
    { name: 'au64', label: 'look down', au: 'AU64', group: 'eyes', side: 'C', lo: 0, hi: 1 },
    { name: 'au1_2_L', label: 'raise', au: 'AU1+AU2', group: 'brows', side: 'L', lo: -0.5, hi: 1 },
    { name: 'au1_2_R', label: 'raise', au: 'AU1+AU2', group: 'brows', side: 'R', lo: -0.5, hi: 1 },
    { name: 'au4_L', label: 'furrow', au: 'AU4', group: 'brows', side: 'L', lo: 0, hi: 1 },
    { name: 'au4_R', label: 'furrow', au: 'AU4', group: 'brows', side: 'R', lo: 0, hi: 1 },
  ],
  presets: {
    happy: { aus: {}, missing: [] },
    surprised: { aus: {}, missing: [] },
    sad: { aus: {}, missing: [] },
    angry: { aus: {}, missing: [] },
    afraid: { aus: {}, missing: [] },
    disgusted: { aus: {}, missing: [] },
  },
};

export const MOCK_FACE_RIG_ANCHORS: Record<string, [number, number]> = {
  brow_L: [0.416, 0.385],
  brow_R: [0.61, 0.395],
  lid_L: [0.414, 0.414],
  lid_R: [0.593, 0.423],
  corner_L: [0.408, 0.594],
  corner_R: [0.585, 0.599],
  jaw: [0.484, 0.756],
  gaze: [0.502, 0.435],
  lips: [0.492, 0.635],
};

/** A plain picture for when the mock has none to show. */
export const MOCK_FACE_RIG_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#2a2a2a"/><ellipse cx="256" cy="270" rx="130" ry="170" fill="#c9a081"/></svg>')}`;
