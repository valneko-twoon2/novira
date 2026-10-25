// The conversation of the assistant's chat, shared by the floating window, the comic's column and the phone's chat screen:
// the greeting with starting suggestions, each message (thoughts, pictures, text, copy, extension cards, applied-change
// chips with undo), the spinner of a running request, the permission question, and the scroll to the latest.
import { ArrowUUpLeft, CaretDown, CaretUp, Check, Copy, Eye, Globe, Lightbulb, Lightning } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { t, type MessageKey } from '@/i18n';
import { currentMessages, isChange, useAgent, type AgentMessage, type AgentToolLog } from '@/state/agent';
import { addressHost } from '@/state/agentEndpoint';
import { WEB_TOOL } from '@/state/agentTools';
import { comicPanelIds, drawComic } from '@/state/comic/generate';
import { useComic } from '@/state/comic/store';
import { invoke } from '@/state/invoke';
import { findModel } from '@/state/models';
import { toast } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { Button, cx, IconButton, Spinner, writeClipboardText } from '@/ui';
import { SentPictures } from './Attachments';
import { PackSuggestions } from './PackSuggestions';

const SUGGESTIONS = ['agent.suggestion.anime', 'agent.suggestion.photo', 'agent.suggestion.pixel', 'agent.suggestion.howto', 'agent.suggestion.extension'] as const;

/** What a chip says about one tool call that changed something. */
export function toolLabel(log: AgentToolLog): string {
  const model = () => findModel(log.key ?? '')?.name ?? log.key ?? '';
  switch (log.kind) {
    case 'model':
      return t('agent.action.model', { name: model() });
    case 'lora':
      return t('agent.action.lora', { name: model(), weight: log.weight ?? 1 });
    case 'prompt':
      return t('agent.action.prompt');
    case 'params':
      return t('agent.action.params', { summary: log.summary ?? '' });
    case 'workflow':
      return t('agent.action.workflow', { name: log.key ?? '' });
    case 'editText':
      return t('agent.action.editText', { count: log.count ?? 0 });
    case 'editWorkflow':
      return t('agent.action.editWorkflow', { count: log.count ?? 0 });
    case 'editComic':
      return t('agent.action.editComic', { count: log.count ?? 0 });
    case 'video':
      return t('agent.action.video', { fields: log.count ?? 0 });
    case 'music':
      return t('agent.action.music', { fields: log.count ?? 0 });
    case 'voice':
      return t('agent.action.voice', { fields: log.count ?? 0 });
    case 'pose':
      return t('agent.action.pose', { count: log.count ?? 0 });
    case 'queued':
      return t('agent.action.queued', { count: log.count ?? 0 });
    case 'packs':
      return '';
  }
}

/** What the permission question names, by the tool that wants to read (the web look-up has its own text). */
const READ_WHAT: Record<string, MessageKey> = {
  list_gallery_images: 'agent.permission.gallery',
  get_image_info: 'agent.permission.image',
  get_generation_settings: 'agent.permission.prompts',
  view_comic_page: 'agent.permission.comicPage',
};

/**
 * The current session's messages, in a scrolling body that follows the latest one. `onSuggest` sends a starting
 * suggestion; `phone` leaves out what only goes to a screen the phone layout has not (drawing the comic).
 */
export function ChatMessages({ onSuggest, phone = false, className }: { onSuggest: (text: string) => void; phone?: boolean; className?: string }) {
  const messages = useAgent(currentMessages);
  const thinking = useAgent((s) => s.busy && s.busySessionId === s.currentId);
  const onComic = useUi((s) => s.activeTab === 'comic') && !phone;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, thinking]);

  return (
    <div className={cx('agent-win__body', className)} data-testid="agent-messages">
      {messages.length === 0 && (
        <div className="agent-empty">
          <p>{onComic ? t('comic.side.hello') : t('agent.greeting')}</p>
          {!onComic && (
            <div className="agent-empty__chips">
              {SUGGESTIONS.map((k) => (
                <button key={k} type="button" className="agent-chip" onClick={() => onSuggest(t(k))}>
                  {t(k)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {messages.map((m) => (
        <Bubble key={m.id} m={m} phone={phone} />
      ))}
      {thinking && <Working />}
      {thinking && <PermissionPrompt />}
      <div ref={endRef} />
    </div>
  );
}

/** What the assistant says about how it read the request: one line, opened to the whole account on demand. */
function Thoughts({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="agent-thoughts" data-testid="agent-thoughts">
      <button type="button" className="agent-thoughts__row" aria-expanded={open} title={open ? t('agent.thoughts.hide') : t('agent.thoughts.show')} onClick={() => setOpen(!open)}>
        <Lightbulb size={12} className="agent-thoughts__icon" />
        <span className="agent-thoughts__line">{open ? t('agent.thoughts.label') : lines[0]}</span>
        {open ? <CaretUp size={11} /> : <CaretDown size={11} />}
      </button>
      {open && (
        <ul className="agent-thoughts__list" data-testid="agent-thoughts-list">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The spinner while the assistant works, with what it has changed so far. */
function Working() {
  const working = useAgent((s) => s.working);
  const changes = working.filter(isChange);
  return (
    <div className="agent-msg agent-msg--assistant agent-msg--thinking" data-testid="agent-working">
      <Spinner size={14} /> {t('agent.thinking')}
      {changes.length > 0 && (
        <ul className="agent-acts">
          {changes.map((log, i) => (
            <li key={i}>{toolLabel(log)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The assistant wants to read pictures or prompts: allow once, always allow, or decline. */
function PermissionPrompt() {
  const permission = useAgent((s) => s.permission);
  const answer = useAgent((s) => s.answerPermission);
  const endpoint = useAgent((s) => (s.status?.provider === 'openai' ? s.status.endpoint : undefined));
  if (!permission) return null;
  const web = permission.tool === WEB_TOOL;
  const title = t(web ? 'agent.permission.webTitle' : 'agent.permission.title');
  return (
    <div className="agent-permission" role="alertdialog" aria-label={title} data-testid="agent-permission">
      <p className="agent-permission__title">
        {web ? <Globe size={14} /> : <Eye size={14} />} {title}
      </p>
      <p className="agent-permission__what">
        {web ? t('agent.permission.web', { query: permission.query ?? '', site: `${permission.language ?? 'ja'}.wikipedia.org` }) : t(READ_WHAT[permission.tool] ?? 'agent.permission.prompts')}
      </p>
      {endpoint && !web && (
        <p className="agent-permission__what" data-testid="agent-permission-sent">
          {endpoint.remote ? t('agent.permission.sentRemote', { host: addressHost(endpoint.baseUrl) }) : t('agent.permission.sentLocal')}
        </p>
      )}
      <div className="agent-permission__buttons">
        <Button size="xs" variant="solid" scheme="invoke" onClick={() => answer('once')} data-testid="agent-permission-once">
          {t('agent.permission.once')}
        </Button>
        <Button size="xs" variant="outline" onClick={() => answer('always')} data-testid="agent-permission-always">
          {t('agent.permission.always')}
        </Button>
        <Button size="xs" variant="ghost" onClick={() => answer('deny')} data-testid="agent-permission-deny">
          {t('agent.permission.deny')}
        </Button>
      </div>
      <p className="agent-permission__hint">{t('agent.permission.hint')}</p>
    </div>
  );
}

async function copyMessage(text: string) {
  try {
    await writeClipboardText(text);
    toast({ status: 'success', title: t('agent.copied') });
  } catch {
    toast({ status: 'error', title: t('agent.copyFailed') });
  }
}

function Bubble({ m, phone }: { m: AgentMessage; phone: boolean }) {
  const undo = useAgent((s) => s.undo);
  const changes = m.tools.filter(isChange);
  const packIds = m.tools.flatMap((log) => log.ids ?? []);
  const canUndo = !!m.snapshot || !!m.editSnapshots;
  const undoable = changes.some((log) => log.kind !== 'queued');
  // The whole comic's panels (every page) when a comic is open; a separate button, so drawing everything is the user's choice.
  const comicPanels = useComic((s) => (s.activeProjectId && !phone ? comicPanelIds().length : 0));
  const onComic = useUi((s) => s.activeTab === 'comic') && !phone;
  return (
    <div className={cx('agent-msg', `agent-msg--${m.role}`, m.error && 'is-error')} data-testid={`agent-msg-${m.role}`}>
      {m.thoughts?.length ? <Thoughts lines={m.thoughts} /> : null}
      {m.images?.length ? <SentPictures names={m.images} /> : null}
      <p className="agent-msg__text">{m.text}</p>
      <IconButton className="agent-msg__copy" size="xs" label={t('agent.copy')} icon={<Copy />} onClick={() => void copyMessage(m.text)} data-testid="agent-copy" />
      {packIds.length > 0 && <PackSuggestions ids={packIds} />}
      {changes.length > 0 && (
        <div className="agent-msg__actions">
          <span className="agent-msg__applied">
            <Check size={12} weight="bold" /> {m.undone ? t('agent.undone') : t('agent.applied')}
          </span>
          <ul className={cx('agent-acts', m.undone && 'is-undone')}>
            {changes.map((log, i) => (
              <li key={i}>{toolLabel(log)}</li>
            ))}
          </ul>
          <div className="agent-msg__buttons">
            {!onComic && (
              <Button size="xs" variant="solid" scheme="invoke" leftIcon={<Lightning weight="fill" />} onClick={() => void invoke()} data-testid="agent-generate">
                {t('agent.generate')}
              </Button>
            )}
            {comicPanels > 0 && (
              <Button size="xs" variant="outline" leftIcon={<Lightning />} onClick={() => void drawComic()} data-testid="agent-generate-comic">
                {t('agent.generateComic', { count: comicPanels })}
              </Button>
            )}
            {/* Queued work is not undone (it is cancelled in the queue), so a request that only queued has no undo. */}
            {undoable && (
              <Button
                size="xs"
                variant="outline"
                leftIcon={<ArrowUUpLeft />}
                disabled={m.undone || !canUndo}
                title={!m.undone && !canUndo ? t('agent.undoExpired') : undefined}
                data-testid="agent-undo"
                onClick={() => undo(m.id)}
              >
                {t('agent.undo')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
