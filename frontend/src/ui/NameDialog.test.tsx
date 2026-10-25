// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { NameDialog } from './NameDialog';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setup = (initial = 'Old name') => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(<NameDialog title="Rename" initial={initial} onSubmit={onSubmit} onClose={onClose} />);
  return { onSubmit, onClose, input: screen.getByTestId('name-dialog-input') as HTMLInputElement, ok: screen.getByTestId('name-dialog-ok') as HTMLButtonElement };
};

describe('NameDialog', () => {
  it('starts with the current name and submits it trimmed with the save button, then closes', () => {
    const { onSubmit, onClose, input, ok } = setup();
    expect(input.value).toBe('Old name');
    fireEvent.change(input, { target: { value: '  New name  ' } });
    fireEvent.click(ok);
    expect(onSubmit).toHaveBeenCalledWith('New name');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits with the Enter key too', () => {
    const { onSubmit, input } = setup();
    fireEvent.change(input, { target: { value: 'By keyboard' } });
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('By keyboard');
  });

  it('refuses a blank name: the button is disabled and nothing is submitted', () => {
    const { onSubmit, onClose, input, ok } = setup();
    fireEvent.change(input, { target: { value: '   ' } });
    expect(ok.disabled).toBe(true);
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without submitting on cancel and on the close button', () => {
    const { onSubmit, onClose } = setup();
    fireEvent.click(screen.getByText(t('common.cancel')));
    fireEvent.click(screen.getByLabelText(t('common.close')));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
