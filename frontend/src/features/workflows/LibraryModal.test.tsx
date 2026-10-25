// @vitest-environment jsdom
// The workflow library dialog: the three lists, search and tag filters, sorting, and opening, copying, deleting, creating and uploading.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedWorkflow } from '@/backend';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { TooltipProvider } from '@/ui';
import { copyToMyWorkflows, deleteLibraryWorkflow, newWorkflow, openLibraryWorkflow } from './actions';
import { useDialogs } from './dialogs';
import { LibraryModal } from './LibraryModal';

vi.mock('./actions', () => ({
  copyToMyWorkflows: vi.fn(),
  deleteLibraryWorkflow: vi.fn(),
  loadWorkflowFile: vi.fn(),
  newWorkflow: vi.fn(),
  openLibraryWorkflow: vi.fn(),
}));

const initial = { workflows: useWorkflows.getState(), ui: useUi.getState(), dialogs: useDialogs.getState() };
const wf = (id: string, name: string, category: SavedWorkflow['category'], over: Partial<SavedWorkflow> = {}): SavedWorkflow => ({
  id,
  name,
  description: `about ${name}`,
  author: '',
  tags: [],
  category,
  updatedAt: Date.UTC(2026, 0, Number(id.replace(/\D/g, '')) || 1),
  graph: {},
  ...over,
});
const library = [
  wf('u1', 'Zebra mine', 'user', { tags: ['photo'], author: 'me' }),
  wf('u2', 'Apple mine', 'user', { tags: ['photo', 'anime'], description: '' }),
  wf('d1', 'Default one', 'default', { tags: ['default', 'starter'] }),
];
const cards = () => screen.getAllByTestId('wf-card').map((c) => c.querySelector('.wf-card__title')!.textContent);
const nav = (label: string) => screen.getByText(label).closest('button') as HTMLButtonElement;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useWorkflows.setState({ ...initial.workflows, library, recentIds: ['d1', 'u1'], nodes: [], isTouched: false }, true);
  useUi.setState({ ...initial.ui, modal: 'workflowLibrary' }, true);
  useDialogs.setState({ ...initial.dialogs, pending: null });
  vi.clearAllMocks();
  render(
    <TooltipProvider>
      <LibraryModal />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the lists', () => {
  it('starts on the user workflows when there are some, with the count of each list', () => {
    // Opened order: the recently opened one first, then by name.
    expect(cards()).toEqual(['Zebra mine', 'Apple mine']);
    expect(within(nav(t('workflows.library.recent'))).getByText('2')).toBeTruthy();
    expect(within(nav(t('workflows.library.yours'))).getByText('2')).toBeTruthy();
    expect(within(nav(t('workflows.library.defaults'))).getByText('1')).toBeTruthy();
  });

  it('switches to the recent list in the order they were opened, and to the defaults', () => {
    fireEvent.click(nav(t('workflows.library.recent')));
    expect(cards()).toEqual(['Default one', 'Zebra mine']);
    fireEvent.click(nav(t('workflows.library.defaults')));
    expect(cards()).toEqual(['Default one']);
    expect(screen.queryByText('default')).toBeNull();
  });

  it('says so when a list is empty', () => {
    act(() => useWorkflows.setState({ library: [] }));
    expect(screen.getByText(t('workflows.library.empty'))).toBeTruthy();
    expect(screen.getByText(t('workflows.library.emptyUser'))).toBeTruthy();
  });

  it('searches the name, the description, the author and the tags', () => {
    const search = screen.getByPlaceholderText(t('workflows.library.search'));
    fireEvent.change(search, { target: { value: 'ZEBRA' } });
    expect(cards()).toEqual(['Zebra mine']);
    fireEvent.change(search, { target: { value: 'anime' } });
    expect(cards()).toEqual(['Apple mine']);
    fireEvent.change(search, { target: { value: 'me' } });
    expect(cards().length).toBe(2);
    fireEvent.change(search, { target: { value: 'nothing' } });
    expect(screen.getByText(t('workflows.library.empty'))).toBeTruthy();
  });

  it('filters by tags, all of the chosen ones, and clears them', () => {
    const photo = screen.getByLabelText('photo');
    fireEvent.click(photo);
    expect(cards()).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('anime'));
    expect(cards()).toEqual(['Apple mine']);
    fireEvent.click(screen.getByText(t('workflows.library.clearTags')));
    expect(cards()).toHaveLength(2);
    fireEvent.click(photo);
    fireEvent.click(photo);
  });

  it('shows the description, the author, the date and which one is open', () => {
    expect(screen.getByText('about Zebra mine')).toBeTruthy();
    const apple = screen.getAllByTestId('wf-card').find((c) => c.textContent?.includes('Apple mine'))!;
    expect(apple.querySelector('.wf-card__desc')).toBeNull();
    expect(screen.getByText(t('workflows.library.by', { author: 'me' }))).toBeTruthy();
    act(() => useWorkflows.setState({ meta: { ...useWorkflows.getState().meta, id: 'u1' } }));
    expect(screen.getByText(t('workflows.library.opened'))).toBeTruthy();
  });
});

describe('opening, creating and uploading', () => {
  it('opens a workflow from its card or its button', () => {
    fireEvent.click(screen.getAllByText(t('workflows.library.open'))[0]!);
    expect(openLibraryWorkflow).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringMatching(/^u/) }));
    fireEvent.click(screen.getByText('Zebra mine'));
    expect(openLibraryWorkflow).toHaveBeenCalledTimes(2);
  });

  it('asks before discarding unsaved changes, and goes on only when confirmed', () => {
    useWorkflows.setState({ nodes: [{ id: 'n' } as never], isTouched: true });
    fireEvent.click(screen.getAllByText(t('workflows.library.open'))[0]!);
    expect(openLibraryWorkflow).not.toHaveBeenCalled();
    expect(useDialogs.getState().pending).not.toBeNull();
    act(() => useDialogs.getState().resolve(true));
    expect(openLibraryWorkflow).toHaveBeenCalledTimes(1);
  });

  it('creates a workflow and closes the library', () => {
    fireEvent.click(screen.getByText(t('workflows.library.new')));
    expect(newWorkflow).toHaveBeenCalled();
    expect(useUi.getState().modal).toBeNull();
  });

  it('hands a chosen file to the store, which asks before discarding (registerWorkflowsFeature)', () => {
    const loadFile = vi.fn();
    useWorkflows.setState({ loadFile });
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByText(t('workflows.library.upload')));
    expect(click).toHaveBeenCalled();
    const file = new File(['{}'], 'flow.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    expect(loadFile).toHaveBeenCalledWith(file);
    Object.defineProperty(input, 'files', { value: [], configurable: true });
    fireEvent.change(input);
    expect(loadFile).toHaveBeenCalledTimes(1);
  });
});

describe('copying and deleting', () => {
  it('copies a default workflow to the user list', () => {
    fireEvent.click(nav(t('workflows.library.defaults')));
    fireEvent.click(screen.getByLabelText(t('workflows.library.copyToMine')));
    expect(copyToMyWorkflows).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });

  it('deletes a user workflow only after a second click, and can back out', () => {
    expect(screen.queryByLabelText(t('workflows.library.copyToMine'))).toBeNull();
    const card = () => screen.getAllByTestId('wf-card')[0]!;
    fireEvent.click(within(card()).getByLabelText(t('common.delete')));
    fireEvent.click(within(card()).getByText(t('common.cancel')));
    expect(deleteLibraryWorkflow).not.toHaveBeenCalled();
    fireEvent.click(within(card()).getByLabelText(t('common.delete')));
    fireEvent.click(within(card()).getByText(t('common.delete')));
    expect(deleteLibraryWorkflow).toHaveBeenCalledTimes(1);
  });
});
