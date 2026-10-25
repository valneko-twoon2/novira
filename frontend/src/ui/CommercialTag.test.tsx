// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelPermission } from '@/backend';
import { t } from '@/i18n';
import { CommercialTag } from './CommercialTag';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const permission = (key: string, allowed: boolean | null) => ({ key, allowed }) as unknown as ModelPermission;
const tag = (n = 0) => screen.getAllByTestId('commercial-tag')[n]!;

describe('CommercialTag', () => {
  it('names the use in its label and hint', () => {
    render(<CommercialTag value="limited" />);
    expect(tag().textContent).toBe(t('browse.commercial.limited'));
    expect(tag().getAttribute('title')).toBe(t('browse.commercial.limited.hint'));
    expect(tag().getAttribute('data-commercial')).toBe('limited');
  });

  it('lists every permission as allowed, not allowed or not stated, with the Civitai note', () => {
    render(<CommercialTag value="allowed" permissions={[permission('sellImages', true), permission('sellModel', false), permission('noCredit', null)]} />);
    fireEvent.click(tag());
    const rows = [...document.querySelectorAll('[data-permission]')];
    expect(rows.map((r) => [r.getAttribute('data-permission'), r.getAttribute('data-allowed')])).toEqual([
      ['sellImages', 'yes'],
      ['sellModel', 'no'],
      ['noCredit', 'unknown'],
    ]);
    expect(screen.getByLabelText(t('browse.permission.yes'))).toBeTruthy();
    expect(screen.getByLabelText(t('browse.permission.no'))).toBeTruthy();
    expect(screen.getByLabelText(t('browse.permission.unknown'))).toBeTruthy();
    expect(screen.getByText(t('browse.permission.sourceCivitai'))).toBeTruthy();
    expect(screen.getByText(t('browse.permission.disclaimer'))).toBeTruthy();
  });

  it('says there is no item-by-item information, and gives a Hugging Face license (or that none is shown)', () => {
    render(<CommercialTag value="denied" source="huggingface" license={['apache-2.0']} permissions={[]} />);
    fireEvent.click(tag());
    expect(screen.getByText(t('browse.permission.none'))).toBeTruthy();
    expect(screen.getByText(t('browse.permission.sourceHf', { license: 'apache-2.0' }))).toBeTruthy();
    cleanup();
    render(<CommercialTag value="denied" source="huggingface" />);
    fireEvent.click(tag());
    expect(screen.getByText(t('browse.permission.sourceHf', { license: t('browse.permission.noLicense') }))).toBeTruthy();
  });

  it('does not pass the click on to the card around it, and shows one list at a time', () => {
    const onCard = vi.fn();
    render(
      <div onClick={onCard}>
        <CommercialTag value="allowed" />
        <CommercialTag value="denied" />
      </div>,
    );
    fireEvent.click(tag(0));
    expect(onCard).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('commercial-permissions')).toHaveLength(1);
    fireEvent.click(tag(1));
    expect(screen.getAllByTestId('commercial-permissions')).toHaveLength(1);
  });
});
