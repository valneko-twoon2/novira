// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { FONTS } from '@/state/fonts';
import { FontPicker } from './FontPicker';
import { TooltipProvider } from './controls';

afterEach(cleanup);

function renderPicker(value: string | null, onChange = vi.fn(), defaultLabel?: string) {
  render(
    <TooltipProvider>
      <FontPicker value={value} onChange={onChange} defaultLabel={defaultLabel} label="Font" testId="picker" />
    </TooltipProvider>,
  );
  return onChange;
}

describe('FontPicker', () => {
  it("lists the app's fonts and the computer's fonts under their headings, each in its own font", async () => {
    const onChange = renderPicker('Zen Maru Gothic');
    expect(screen.getByTestId('picker').textContent).toContain('Zen Maru Gothic');
    fireEvent.click(screen.getByTestId('picker'));
    // The mock backend reports a few fonts a Windows computer has.
    const meiryo = await screen.findByText('Meiryo');
    expect(screen.getByText(t('common.font.app'))).toBeTruthy();
    expect(screen.getByText(t('common.font.installed'))).toBeTruthy();
    expect(screen.getAllByTestId('font-option').length).toBeGreaterThanOrEqual(FONTS.length + 1);
    expect((meiryo as HTMLElement).style.fontFamily).toContain('Meiryo');
    fireEvent.click(meiryo);
    expect(onChange).toHaveBeenCalledWith('Meiryo');
  });

  it('narrows the list by a search, and offers the row for no font of its own first when asked', async () => {
    const onChange = renderPicker(null, vi.fn(), 'Standard');
    expect(screen.getByTestId('picker').textContent).toContain('Standard');
    fireEvent.click(screen.getByTestId('picker'));
    await screen.findByText('Meiryo');
    expect(screen.getAllByTestId('font-option')[0]!.textContent).toContain('Standard');
    fireEvent.change(screen.getByRole('textbox', { name: t('common.font.search') }), { target: { value: 'mincho' } });
    expect(screen.getAllByTestId('font-option').map((o) => o.textContent)).toEqual(['Shippori Mincho', 'MS Mincho', 'Yu Mincho']);
    fireEvent.change(screen.getByRole('textbox', { name: t('common.font.search') }), { target: { value: 'zzz' } });
    expect(screen.getByText(t('common.font.noMatch'))).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: t('common.font.search') }), { target: { value: '' } });
    fireEvent.click(screen.getAllByTestId('font-option')[0]!);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows a saved font the computer no longer has by its name', () => {
    renderPicker('Gone Font');
    expect(screen.getByTestId('picker').textContent).toContain('Gone Font');
  });
});
