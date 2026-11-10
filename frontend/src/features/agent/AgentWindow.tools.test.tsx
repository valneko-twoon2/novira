// @vitest-environment jsdom
// The assistant window's tools: the "/" list of ready-made requests, the model and effort picker, and resizing from any side.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type AgentModelOption } from '@/backend';
import { t } from '@/i18n';
import { AGENT_INPUT_HEIGHT, agentOptions, effectiveModel, useAgent } from '@/state/agent';
import { TooltipProvider } from '@/ui';
import { AgentWindow } from './AgentWindow';
import { expandCommand, groupTemplates, matchTemplates, parseCommand, slashQuery, visibleGroups, visibleTemplates } from './slashTemplates';

const show = () =>
  render(
    <TooltipProvider>
      <AgentWindow />
    </TooltipProvider>,
  );
const claudeModels: AgentModelOption[] = [
  ['claude-opus-5-5', 'Opus 5.5'],
  ['claude-sonnet-5-5', 'Sonnet 5.5'],
].map(([id, name]) => ({ id: id!, name: name!, efforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: 'high' }));
const ready = { provider: 'claude' as const, installed: true, loggedIn: true, models: claudeModels, defaultModel: 'claude-sonnet-5-5' };

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterAll(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(backend, 'agentStatus').mockResolvedValue(ready);
  useAgent.setState({
    sessions: [],
    currentId: null,
    busy: false,
    status: ready,
    pos: null,
    size: null,
    inputHeight: AGENT_INPUT_HEIGHT.default,
    choice: { claude: { model: '', effort: '' }, codex: { model: '', effort: '' }, openai: { model: '', effort: '' } },
    send: vi.fn().mockResolvedValue(undefined),
    setPos: (pos) => useAgent.setState({ pos }),
    setSize: (size) => useAgent.setState({ size }),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('slashQuery and matchTemplates', () => {
  it('reads the words after a slash at the start only, until a line break or a whole command and a space', () => {
    expect(slashQuery('/comic lay')).toBe('comic lay');
    expect(slashQuery('/')).toBe('');
    expect(slashQuery('/pose')).toBe('pose');
    expect(slashQuery('a /comic')).toBeNull();
    expect(slashQuery('/comic\nmore')).toBeNull();
    expect(slashQuery('/pose ')).toBeNull();
    expect(slashQuery('/pose waving')).toBeNull();
  });

  it('keeps every template for no words, and those holding every word in their command, name or sentence', () => {
    expect(matchTemplates('')).toHaveLength(visibleTemplates().length);
    expect(matchTemplates('COMIC').map((x) => x.id)).toEqual(['comic-layout', 'comic-story', 'comic-dialogue']);
    expect(matchTemplates('comic dialogue').map((x) => x.id)).toEqual(['comic-dialogue']);
    expect(matchTemplates(t('agent.template.pose.label')).map((x) => x.id)).toContain('pose');
    expect(matchTemplates('zzzz-no-such')).toEqual([]);
  });

  it('puts the commands that start with the word before a sentence that holds it by chance', () => {
    const chance = { id: 'extension', label: 'agent.template.extension.label', text: 'agent.template.pose.text' } as const;
    const help = { id: 'help', label: 'agent.template.help.label' } as const;
    expect(matchTemplates('he', [chance, help]).map((x) => x.id)).toEqual(['help']);
    expect(matchTemplates('help').map((x) => x.id)).toEqual(['help']);
  });

  it('lists the templates under their feature, in the order the arrow keys walk them', () => {
    const groups = groupTemplates(visibleTemplates());
    expect(groups.map((g) => g.id)).toEqual(['image', 'comic', 'music', 'workflow', 'extensions', 'help']);
    expect(groups.flatMap((g) => g.templates)).toEqual(visibleTemplates());
    expect(groupTemplates(matchTemplates('comic')).map((g) => g.id)).toEqual(['comic']);
    expect(groupTemplates([])).toEqual([]);
  });

  it('leaves out the templates of the screens the app build hides, also as typed commands', () => {
    vi.stubEnv('MODE', 'production');
    try {
      const ids = visibleTemplates().map((x) => x.id);
      expect(ids.filter((id) => id.startsWith('comic') || id === 'music')).toEqual([]);
      expect(ids).toEqual(expect.arrayContaining(['image', 'pose', 'workflow', 'extension', 'help']));
      expect(visibleGroups().map((g) => g.id)).toEqual(['image', 'workflow', 'extensions', 'help']);
      expect(parseCommand('/music calm')).toBeNull();
      expect(expandCommand('/music calm')).toBe('/music calm');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('turns a command into its sentence with what was written after it', () => {
    expect(expandCommand('/pose ')).toBe(t('agent.template.pose.text'));
    expect(expandCommand('/pose waving')).toBe(`${t('agent.template.pose.text')}waving`);
    expect(expandCommand('/POSE a\nb')).toBe(`${t('agent.template.pose.text')}a\nb`);
    // The sentence of /improve ends in a full stop, so the fixed text and the rest stay apart in every language.
    expect(expandCommand('/improve warm').endsWith('warm')).toBe(true);
    expect(expandCommand('/no-such words')).toBe('/no-such words');
    expect(expandCommand('plain /pose')).toBe('plain /pose');
    expect(expandCommand('/help')).toBe('/help');
  });
});

describe('the "/" list', () => {
  it('shows one line per command with no sentence under it, under the heading of its feature', async () => {
    show();
    const input = (await screen.findByTestId('agent-input')) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/' } });
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-labelledby'))).toContain('agent-slash-group-comic');
    expect(screen.getByText(t('media.tab.music'))).toBeTruthy();
    expect(screen.queryByText(t('agent.template.pose.text'))).toBeNull();
  });

  it('opens on a slash, narrows as letters follow, moves with the arrows and leaves the command on Enter without sending', async () => {
    show();
    const input = (await screen.findByTestId('agent-input')) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/' } });
    expect(screen.getByTestId('agent-slash')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(visibleTemplates().length);
    fireEvent.change(input, { target: { value: '/comic' } });
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('agent-slash-comic-story').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('/comic-story ');
    expect(screen.queryByTestId('agent-slash')).toBeNull();
    expect(useAgent.getState().send).not.toHaveBeenCalled();
  });

  it('leaves only the command on Tab, and sends its sentence with what was written after it', async () => {
    show();
    const input = (await screen.findByTestId('agent-input')) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/po' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.value).toBe('/pose ');
    expect(screen.queryByTestId('agent-slash')).toBeNull();
    fireEvent.change(input, { target: { value: '/pose waving' } });
    expect(screen.queryByTestId('agent-slash')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useAgent.getState().send).toHaveBeenCalledWith(`${t('agent.template.pose.text')}waving`, []);
  });

  it('takes a template by a click, and Escape closes the list for that text', async () => {
    show();
    const input = (await screen.findByTestId('agent-input')) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/pose' } });
    fireEvent.click(screen.getByTestId('agent-slash-pose'));
    expect(input.value).toBe('/pose ');
    fireEvent.change(input, { target: { value: '/wor' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('agent-slash')).toBeNull();
  });

  it('opens the help from the list, sends nothing, and closes it with Escape, typing or its button', async () => {
    show();
    const input = (await screen.findByTestId('agent-input')) as HTMLTextAreaElement;
    const openHelp = () => {
      fireEvent.change(input, { target: { value: '/help' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(input.value).toBe('');
      expect(screen.getByTestId('agent-slash-help-panel')).toBeTruthy();
    };
    openHelp();
    expect(screen.getByText('/pose')).toBeTruthy();
    expect(screen.getByText(t('agent.template.pose.text'))).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('agent-slash-help-panel')).toBeNull();
    openHelp();
    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.queryByTestId('agent-slash-help-panel')).toBeNull();
    openHelp();
    fireEvent.click(screen.getByTestId('agent-slash-help-close'));
    expect(screen.queryByTestId('agent-slash-help-panel')).toBeNull();
    expect(useAgent.getState().send).not.toHaveBeenCalled();
  });

  it('opens the help from a typed "/help " too, and never sends it', async () => {
    show();
    const input = (await screen.findByTestId('agent-input')) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/he' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.value).toBe('/help ');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('agent-slash-help-panel')).toBeTruthy();
    expect(useAgent.getState().send).not.toHaveBeenCalled();
  });

  it('names the slash commands and /help in the empty box', async () => {
    show();
    const input = (await screen.findByTestId('agent-input')) as HTMLTextAreaElement;
    expect(input.placeholder).toContain('/help');
  });

  it('says when nothing matches, and Enter then sends the text as it is', async () => {
    show();
    const input = (await screen.findByTestId('agent-input')) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '/zzzz-no-such' } });
    expect(screen.getByText(t('agent.template.none'))).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useAgent.getState().send).toHaveBeenCalledWith('/zzzz-no-such', []);
  });
});

describe('the model and effort', () => {
  it('are chosen per tool in the header, always with an effort, and go with the request of that tool only', async () => {
    show();
    // Before a choice the default model is the one named and pressed: there is no "default" and no typed name.
    expect((await screen.findByTestId('agent-model')).textContent).toContain('Sonnet 5.5');
    fireEvent.click(screen.getByTestId('agent-model'));
    expect((await screen.findByTestId('agent-model-claude-sonnet-5-5')).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('agent-model-default')).toBeNull();
    expect(screen.queryByTestId('agent-model-custom')).toBeNull();
    expect(screen.queryByTestId('agent-model-name')).toBeNull();
    // No "default" effort: the model's own starting effort is the one picked.
    expect(screen.queryByTestId('agent-effort-default')).toBeNull();
    expect(screen.getByTestId('agent-effort-high').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('agent-model-claude-opus-5-5'));
    fireEvent.click(screen.getByTestId('agent-effort-max'));
    await waitFor(() => expect(useAgent.getState().choice.claude).toEqual({ model: 'claude-opus-5-5', effort: 'max' }));
    expect(screen.getByTestId('agent-model').textContent).toContain('Opus 5.5');
    expect(screen.getByTestId('agent-model-claude-sonnet-5-5').getAttribute('aria-pressed')).toBe('false');
    const choice = useAgent.getState().choice;
    expect(agentOptions(ready, choice)).toEqual({ agentModel: 'claude-opus-5-5', effort: 'max' });
    expect(agentOptions({ ...ready, provider: 'codex', models: [] }, choice)).toEqual({ effort: 'medium' });
    expect(agentOptions(null, choice)).toEqual({});
  });

  it('runs the default model, named, until one is chosen, and reads a model saved under an old alias as its listed model', () => {
    const none = { model: '', effort: '' as const };
    expect(effectiveModel(ready, none)).toBe('claude-sonnet-5-5');
    expect(agentOptions(ready, { claude: none, codex: none, openai: none })).toEqual({ agentModel: 'claude-sonnet-5-5', effort: 'high' });
    expect(effectiveModel(ready, { model: 'opus', effort: '' })).toBe('claude-opus-5-5');
    expect(effectiveModel(ready, { model: 'claude-opus-5-5', effort: '' })).toBe('claude-opus-5-5');
    // A name the tool no longer lists runs the default; a tool that lists nothing runs its own.
    expect(effectiveModel(ready, { model: 'claude-x', effort: '' })).toBe('claude-sonnet-5-5');
    expect(effectiveModel({ models: [] }, { model: 'opus', effort: '' })).toBe('');
    expect(effectiveModel(null, none)).toBe('');
  });

  it("offers the models Codex lists with each one's efforts, and falls back to a model's own effort when it lacks the chosen one", async () => {
    useAgent.getState().setChoice('claude', { model: '  claude-opus-5-5 ' });
    expect(useAgent.getState().choice.claude.model).toBe('claude-opus-5-5');
    const models: AgentModelOption[] = [
      { id: 'gpt-pro', name: 'GPT-Pro', efforts: ['low', 'medium', 'high', 'ultra'], defaultEffort: 'medium' },
      { id: 'gpt-mini', name: 'GPT-Mini', efforts: ['low', 'medium'], defaultEffort: 'low' },
    ];
    const codex = { provider: 'codex' as const, installed: true, loggedIn: true, models, defaultModel: 'gpt-mini' };
    vi.spyOn(backend, 'agentStatus').mockResolvedValue(codex);
    useAgent.setState({ status: codex });
    show();
    fireEvent.click(await screen.findByTestId('agent-model'));
    // The default model is named and takes only its own efforts.
    expect((await screen.findByTestId('agent-model-gpt-mini')).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('agent-effort-low').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('agent-effort-high')).toBeNull();
    fireEvent.click(screen.getByTestId('agent-model-gpt-pro'));
    fireEvent.click(await screen.findByTestId('agent-effort-ultra'));
    expect(agentOptions(codex, useAgent.getState().choice)).toEqual({ agentModel: 'gpt-pro', effort: 'ultra' });
    fireEvent.click(screen.getByTestId('agent-model-gpt-mini'));
    await waitFor(() => expect(screen.getByTestId('agent-effort-low').getAttribute('aria-pressed')).toBe('true'));
    expect(screen.queryByTestId('agent-effort-ultra')).toBeNull();
    expect(screen.getByTestId('agent-model').textContent).toContain('GPT-Mini');
    expect(agentOptions(codex, useAgent.getState().choice)).toEqual({ agentModel: 'gpt-mini', effort: 'low' });
  });
});

describe('the message box', () => {
  it('starts taller than two lines, and its top edge changes its height by drag or arrow keys within limits', async () => {
    show();
    const input = await screen.findByTestId('agent-input');
    expect(input.style.height).toBe(`${AGENT_INPUT_HEIGHT.default}px`);
    const grip = screen.getByTestId('agent-input-grip');
    fireEvent.pointerDown(grip, { button: 0, clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(grip, { pointerId: 1 });
    expect(useAgent.getState().inputHeight).toBe(AGENT_INPUT_HEIGHT.default + 100);
    expect(input.style.height).toBe(`${AGENT_INPUT_HEIGHT.default + 100}px`);
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    expect(useAgent.getState().inputHeight).toBe(AGENT_INPUT_HEIGHT.default + 84);
    fireEvent.pointerDown(grip, { button: 0, clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientY: 5000, pointerId: 1 });
    expect(useAgent.getState().inputHeight).toBe(AGENT_INPUT_HEIGHT.min);
    fireEvent.pointerMove(grip, { clientY: -5000, pointerId: 1 });
    expect(useAgent.getState().inputHeight).toBe(AGENT_INPUT_HEIGHT.max);
  });
});

describe('resizing', () => {
  // Inside jsdom's 1024 by 768 window, so only the drags themselves set the size.
  const rect = { left: 300, top: 100, right: 700, bottom: 680, width: 400, height: 580, x: 300, y: 100, toJSON: () => ({}) };

  it('grows from the right edge and the bottom-left corner, keeping the opposite sides in place', async () => {
    show();
    const win = await screen.findByTestId('agent-window');
    win.getBoundingClientRect = () => rect;
    fireEvent.pointerDown(screen.getByTestId('agent-resize-e'), { clientX: 700, clientY: 400 });
    fireEvent.pointerMove(window, { clientX: 750, clientY: 0 });
    expect(useAgent.getState().size).toEqual({ w: 450, h: 580 });
    expect(useAgent.getState().pos).toEqual({ x: 300, y: 100 });
    fireEvent.pointerUp(window);
    fireEvent.pointerDown(screen.getByTestId('agent-resize-sw'), { clientX: 300, clientY: 680 });
    fireEvent.pointerMove(window, { clientX: 250, clientY: 700 });
    expect(useAgent.getState().size).toEqual({ w: 450, h: 600 });
    expect(useAgent.getState().pos).toEqual({ x: 250, y: 100 });
    fireEvent.pointerUp(window);
  });

  it('has a grip on every side and corner', async () => {
    show();
    await screen.findByTestId('agent-window');
    for (const dir of ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']) expect(screen.getByTestId(`agent-resize-${dir}`)).toBeTruthy();
  });
});
