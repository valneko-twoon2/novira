// @vitest-environment jsdom
// The media tabs show icons only: each name is the button's accessible label, not visible text.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { MEDIA_KINDS, useUi } from '@/state/ui';
import { TooltipProvider } from '@/ui';
import { MediaTabs } from './MediaTabs';

const initial = useUi.getState();
beforeEach(() => useUi.setState(initial, true));
afterEach(cleanup);

describe('MediaTabs', () => {
  it('labels every icon tab and switches the media kind', () => {
    render(
      <TooltipProvider>
        <MediaTabs />
      </TooltipProvider>,
    );
    const tabs = screen.getAllByRole('tab');
    // One tab for each kind of media, then the comic (a mode of the Generate entry, shown as the last icon).
    expect(tabs).toHaveLength(MEDIA_KINDS.length + 1);
    for (const tab of tabs) {
      expect(tab.getAttribute('aria-label')).toBeTruthy();
      expect(tab.textContent).toBe('');
    }
    fireEvent.click(screen.getByRole('tab', { name: t('media.tab.music') }));
    expect(useUi.getState().media).toBe('music');
    expect(screen.getByRole('tab', { name: t('media.tab.music') }).getAttribute('aria-selected')).toBe('true');
  });

  it('opens the comic from its icon, and a media icon brings Generate back', () => {
    render(
      <TooltipProvider>
        <MediaTabs />
      </TooltipProvider>,
    );
    const comic = screen.getByRole('tab', { name: t('app.tabs.comic') });
    fireEvent.click(comic);
    expect(useUi.getState().activeTab).toBe('comic');
    expect(comic.getAttribute('aria-selected')).toBe('true');
    // No media kind is lit while the comic is shown.
    expect(screen.getByRole('tab', { name: t('media.tab.image') }).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('tab', { name: t('media.tab.video') }));
    expect(useUi.getState().activeTab).toBe('generate');
    expect(useUi.getState().media).toBe('video');
    expect(comic.getAttribute('aria-selected')).toBe('false');
  });
});
