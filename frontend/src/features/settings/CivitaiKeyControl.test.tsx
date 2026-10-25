// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { CivitaiKeyControl } from './CivitaiKeyControl';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CivitaiKeyControl', () => {
  it('shows ten asterisks, never the key, once a key is saved', async () => {
    const set = vi.spyOn(backend, 'setCivitaiKey').mockResolvedValue();
    vi.spyOn(backend, 'hasCivitaiKey').mockResolvedValue(false);
    render(<CivitaiKeyControl />);
    const input = await screen.findByTestId('civitai-key-input');
    expect((input as HTMLInputElement).type).toBe('password');
    fireEvent.change(input, { target: { value: 'secret-key' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(set).toHaveBeenCalledWith('secret-key'));
    const mask = (await screen.findByTestId('civitai-key-mask')) as HTMLInputElement;
    expect(mask.value).toBe('**********');
    expect(document.body.innerHTML).not.toContain('secret-key');
  });
});
