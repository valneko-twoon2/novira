// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { useCanvas, type PoseObject } from '@/state/canvas';
import { TooltipProvider } from '@/ui';
import { POSE_CATEGORIES, POSE_GROUPS } from '@/state/pose/posePresets';
import { PosePresetPicker } from './PosePresetPicker';

const initial = useCanvas.getState();
const poses = () => useCanvas.getState().entities.flatMap((e) => e.objects.filter((o): o is PoseObject => o.kind === 'pose'));
const openDialog = () => {
  render(
    <TooltipProvider>
      <PosePresetPicker />
    </TooltipProvider>,
  );
  fireEvent.click(screen.getByTestId('canvas-pose-presets'));
};

beforeEach(() => useCanvas.setState(initial, true));
afterEach(cleanup);

describe('the ready-made poses dialog', () => {
  it('lists the groups and categories on the left, starting with the compositions', () => {
    openDialog();
    for (const g of POSE_GROUPS) expect(screen.getByText(t(g.label))).toBeTruthy();
    for (const c of POSE_CATEGORIES) expect(screen.getByTestId(`canvas-pose-category-${c.id}`)).toBeTruthy();
    expect(screen.getByTestId('canvas-pose-category-panel.shot').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('canvas-pose-preset-bustUp')).toBeTruthy();
  });

  it('shows each pose as a drawn figure with its name, and switches category', () => {
    openDialog();
    const card = screen.getByTestId('canvas-pose-preset-bustUp');
    expect(card.querySelector('svg line')).not.toBeNull();
    expect(within(card).getByText(t('canvas.pose.preset.bustUp'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('canvas-pose-category-action'));
    expect(screen.queryByTestId('canvas-pose-preset-bustUp')).toBeNull();
    expect(screen.getByTestId('canvas-pose-preset-highKick').querySelector('svg')).not.toBeNull();
  });

  it('puts the chosen pose on a new layer and closes', () => {
    openDialog();
    fireEvent.click(screen.getByTestId('canvas-pose-category-panel.two'));
    fireEvent.click(screen.getByTestId('canvas-pose-preset-faceToFace'));
    expect(poses()).toHaveLength(2);
    expect(screen.queryByTestId('canvas-pose-preset-faceToFace')).toBeNull();
  });
});
