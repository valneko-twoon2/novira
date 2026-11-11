// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu, ContextMenuContent, ContextMenuSplitItem, ContextMenuTrigger, Modal, Section, Tab, TabList, TabPanel, Tabs } from './overlays';

afterEach(cleanup);

describe('Section', { tags: [] }, () => {
  it('shows its body when open and hides it after toggling', { tags: ['state-transition'] }, () => {
    render(
      <Section title="Advanced" badges={['2', '']}>
        <p>body</p>
      </Section>,
    );
    const toggle = screen.getByRole('button', { name: /Advanced/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('body')).toBeTruthy();
    // Empty badges are left out.
    expect(toggle.querySelectorAll('.ui-badge')).toHaveLength(1);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('body')).toBeNull();
  });

  it('can start closed', { tags: ['condition'] }, () => {
    render(
      <Section title="Closed" defaultOpen={false}>
        <p>hidden</p>
      </Section>,
    );
    expect(screen.queryByText('hidden')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Closed/ }));
    expect(screen.getByText('hidden')).toBeTruthy();
  });
});

describe('Modal', { tags: [] }, () => {
  it('renders the title, body and footer and closes with the labelled close button', { tags: ['equivalence'] }, () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Settings" closeLabel="Close" footer={<span>footer</span>}>
        <p>content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog.textContent).toContain('content');
    expect(dialog.textContent).toContain('footer');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape and renders nothing while closed', { tags: ['state-transition', 'condition'] }, () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Modal open={open} onOpenChange={setOpen} title="About" closeLabel="Close">
          <p>about</p>
        </Modal>
      );
    }
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Tabs', { tags: [] }, () => {
  it('shows the panel of the chosen tab', { tags: ['equivalence'] }, () => {
    function Harness() {
      const [tab, setTab] = useState('a');
      return (
        <Tabs value={tab} onValueChange={setTab}>
          <TabList>
            <Tab value="a">First</Tab>
            <Tab value="b">Second</Tab>
            <Tab value="c" disabled>
              Third
            </Tab>
          </TabList>
          <TabPanel value="a">panel a</TabPanel>
          <TabPanel value="b">panel b</TabPanel>
          <TabPanel value="c">panel c</TabPanel>
        </Tabs>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('tabpanel').textContent).toBe('panel a');
    // Radix tabs switch on mouse down.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Second' }), { button: 0 });
    expect(screen.getByRole('tabpanel').textContent).toBe('panel b');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Third' }), { button: 0 });
    expect(screen.getByRole('tabpanel').textContent).toBe('panel b');
  });
});

describe('ContextMenuSplitItem', { tags: [] }, () => {
  const show = (disabled = false) => {
    const main = vi.fn();
    const side = vi.fn();
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="target">target</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSplitItem onSelect={main} disabled={disabled} side={{ icon: <span>gear</span>, label: 'Settings', onSelect: side, testId: 'side' }}>
            Run
          </ContextMenuSplitItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('target'));
    return { main, side };
  };

  it('runs the item or its side action, each on its own, and closes the menu', { tags: ['condition'] }, () => {
    const first = show();
    fireEvent.click(screen.getByText('Run'));
    expect(first.main).toHaveBeenCalledTimes(1);
    expect(first.side).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.contextMenu(screen.getByTestId('target'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(first.side).toHaveBeenCalledTimes(1);
    expect(first.main).toHaveBeenCalledTimes(1);
  });

  it('turns both off together', { tags: ['decision-table'] }, () => {
    show(true);
    expect(screen.getByTestId('side').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Run').closest('[role=menuitem]')?.getAttribute('aria-disabled')).toBe('true');
  });
});
