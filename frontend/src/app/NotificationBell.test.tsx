// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/ui';
import { toast, useToasts } from '@/state/toasts';
import { t } from '@/i18n';
import { NotificationBell } from './NotificationBell';

beforeEach(() => useToasts.setState({ toasts: [], history: [], unread: 0, bells: 0 }));
afterEach(cleanup);

const renderBell = () =>
  render(
    <TooltipProvider>
      <NotificationBell />
    </TooltipProvider>,
  );

describe('notification bell', () => {
  it('counts quiet notifications without showing toasts, and lists them when opened', { tags: ['scenario'] }, () => {
    renderBell();
    act(() => {
      toast({ status: 'success', title: 'Deleted 1 image', quiet: true });
      toast({ status: 'success', title: 'Deleted 2 images', quiet: true });
    });
    expect(useToasts.getState().toasts).toEqual([]);
    expect(screen.getByTestId('notification-count').textContent).toBe('2');
    fireEvent.click(screen.getByTestId('notification-bell'));
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('Deleted 2 images');
    expect(items[1]).toContain('Deleted 1 image');
    expect(useToasts.getState().unread).toBe(0);
    expect(screen.queryByTestId('notification-count')).toBeNull();
  });

  it('runs an action from the history once and can clear the history', { tags: ['scenario'] }, () => {
    const run = vi.fn();
    renderBell();
    act(() => void toast({ status: 'success', title: 'Deleted', quiet: true, actions: [{ label: 'Undo', run }] }));
    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('app.notifications.clear') }));
    expect(screen.queryByText(t('app.notifications.empty'))).toBeNull();
    expect(screen.queryByTestId('notification-list')).toBeNull();
    expect(useToasts.getState().history).toEqual([]);
  });

  it('stops holding quiet notifications back once it is unmounted', { tags: ['condition'] }, () => {
    const { unmount } = renderBell();
    expect(useToasts.getState().bells).toBe(1);
    unmount();
    expect(useToasts.getState().bells).toBe(0);
  });
});
