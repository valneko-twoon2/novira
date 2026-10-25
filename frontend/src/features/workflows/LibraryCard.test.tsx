// @vitest-environment jsdom
// The card above the Generate button on the Workflows tab: the open workflow's name under "Library", the unsaved mark,
// and the way into the workflow library dialog.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { WorkflowLibraryCard } from './LibraryCard';

const initial = { workflows: useWorkflows.getState(), ui: useUi.getState() };
beforeEach(() => {
  useWorkflows.setState(initial.workflows, true);
  useUi.setState({ ...initial.ui, modal: null }, true);
});
afterEach(cleanup);

describe('the library card', () => {
  it('names the library and the open workflow, and says so when it has no name yet', () => {
    useWorkflows.getState().setMeta({ name: 'My flow' });
    render(<WorkflowLibraryCard />);
    expect(screen.getByTestId('wf-open-library').textContent).toContain(t('workflows.library.button'));
    expect(screen.getByTestId('wf-library-name').textContent).toBe('My flow');
    act(() => useWorkflows.getState().setMeta({ name: '' }));
    expect(screen.getByTestId('wf-library-name').textContent).toBe(t('workflows.untitled'));
  });

  it('marks unsaved changes', () => {
    render(<WorkflowLibraryCard />);
    act(() => useWorkflows.setState({ isTouched: false }));
    expect(screen.queryByTestId('wf-library-unsaved')).toBeNull();
    act(() => useWorkflows.setState({ isTouched: true }));
    expect(screen.getByTestId('wf-library-unsaved')).toBeTruthy();
  });

  it('opens the library dialog, not a list of presets', () => {
    render(<WorkflowLibraryCard />);
    fireEvent.click(screen.getByTestId('wf-open-library'));
    expect(useUi.getState().modal).toBe('workflowLibrary');
    expect(screen.queryByTestId('preset-list')).toBeNull();
  });
});
