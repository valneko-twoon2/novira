// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal, Section, Tab, TabList, TabPanel, Tabs } from './overlays';

afterEach(cleanup);

describe('Section', () => {
  it('shows its body when open and hides it after toggling', () => {
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

  it('can start closed', () => {
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

describe('Modal', () => {
  it('renders the title, body and footer and closes with the labelled close button', () => {
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

  it('closes on Escape and renders nothing while closed', () => {
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

describe('Tabs', () => {
  it('shows the panel of the chosen tab', () => {
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
