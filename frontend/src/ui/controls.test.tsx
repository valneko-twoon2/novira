// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Checkbox, IconButton, NumberInput, ProgressBar, Switch, TooltipProvider } from './controls';

afterEach(cleanup);

describe('NumberInput', () => {
  it('commits on blur, clamped to the range', () => {
    const onChange = vi.fn();
    render(<NumberInput value={5} onChange={onChange} min={1} max={10} aria-label="steps" />);
    const input = screen.getByLabelText('steps');
    fireEvent.change(input, { target: { value: '42' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(10);
    expect((input as HTMLInputElement).value).toBe('10');
  });

  it('commits on Enter and keeps the key from reaching global shortcuts', () => {
    const onChange = vi.fn();
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    render(<NumberInput value={5} onChange={onChange} min={0} aria-label="cfg" />);
    const input = screen.getByLabelText('cfg');
    fireEvent.change(input, { target: { value: '-3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    window.removeEventListener('keydown', onWindowKey);
    expect(onChange).toHaveBeenCalledWith(0);
    expect(onWindowKey).not.toHaveBeenCalled();
  });

  it('restores the previous value when the field is cleared or not a number', () => {
    const onChange = vi.fn();
    render(<NumberInput value={7} onChange={onChange} min={1} max={10} precision={1} aria-label="steps" />);
    const input = screen.getByLabelText('steps') as HTMLInputElement;
    for (const text of ['', '   ', 'abc']) {
      fireEvent.change(input, { target: { value: text } });
      fireEvent.blur(input);
      expect(input.value).toBe('7.0');
    }
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('7.0');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the value with the given precision', () => {
    const onChange = vi.fn();
    render(<NumberInput value={1.5} onChange={onChange} precision={2} aria-label="weight" />);
    const input = screen.getByLabelText('weight') as HTMLInputElement;
    expect(input.value).toBe('1.50');
    fireEvent.change(input, { target: { value: '2.345' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(2.345);
    expect(input.value).toBe('2.35');
  });

  it('follows value changes from outside', () => {
    function Harness() {
      const [v, setV] = useState(3);
      return (
        <>
          <NumberInput value={v} onChange={setV} aria-label="n" />
          <button type="button" onClick={() => setV(8)}>
            set
          </button>
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByText('set'));
    expect((screen.getByLabelText('n') as HTMLInputElement).value).toBe('8');
  });
});

describe('Button', () => {
  it('is disabled and shows no left icon while loading', () => {
    const onClick = vi.fn();
    render(
      <Button isLoading leftIcon={<span data-testid="icon" />} onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveProperty('disabled', true);
    expect(screen.queryByTestId('icon')).toBeNull();
  });
});

describe('IconButton', () => {
  it('uses the label as accessible name and reports the active state', () => {
    render(
      <TooltipProvider>
        <IconButton label="Pin" icon={<span />} isActive />
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Pin' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Switch and Checkbox', () => {
  it('switch reports the flipped value', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="grid" />);
    const sw = screen.getByRole('switch', { name: 'grid' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('disabled switch does not change', () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} disabled aria-label="grid" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('checkbox reports the new checked state', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Starred" />);
    fireEvent.click(screen.getByLabelText('Starred'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('ProgressBar', () => {
  it('reports the percentage', () => {
    render(<ProgressBar value={0.424} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42');
  });

  it('keeps the bar inside the track', () => {
    const { container } = render(
      <>
        <ProgressBar value={1.7} />
        <ProgressBar value={-1} />
      </>,
    );
    const widths = [...container.querySelectorAll<HTMLElement>('.ui-progress__bar')].map((b) => b.style.width);
    expect(widths).toEqual(['100%', '0%']);
  });

  it('keeps the reported value inside the range', () => {
    render(
      <>
        <ProgressBar value={1.7} />
        <ProgressBar value={-1} />
      </>,
    );
    const values = screen.getAllByRole('progressbar').map((b) => b.getAttribute('aria-valuenow'));
    expect(values).toEqual(['100', '0']);
  });

  it('reports no value while indeterminate', () => {
    render(<ProgressBar value={0.5} indeterminate />);
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
  });
});
