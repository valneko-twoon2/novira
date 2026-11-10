// The assistant's message box, shared by the screens' right column, the floating window and the phone's chat screen: the
// pictures attached to the next message (the paperclip, a drop or a paste), the "/" list of ready-made requests, the
// text, and send (stop while the assistant works). The draft lives in the store (`useDraft`), so it stays when the user
// moves to another screen's column, and a starting suggestion goes out the same way. In the window the box's height is the one dragged from its top edge and Enter sends; on a phone the box
// grows with its text and Enter starts a new line, as a phone's keyboard expects.
import { ArrowUp, Stop, Warning } from '@phosphor-icons/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { isImageDrag } from '@/state/dnd';
import { cx, IconButton, Textarea } from '@/ui';
import { AttachButton, AttachedStrip, droppedPictures, storeFiles, withAttached } from './Attachments';
import { InputGrip } from './InputGrip';
import { SlashHelp } from './SlashHelp';
import { SlashMenu } from './SlashMenu';
import { expandCommand, HELP_COMMAND, matchTemplates, parseCommand, slashQuery, type SlashTemplate } from './slashTemplates';

/** The message being written and the pictures that go with it. */
export interface Draft {
  text: string;
  setText: (text: string) => void;
  attached: string[];
  attach: (names: readonly string[]) => void;
  detach: (name: string) => void;
  /** Sends `value` with the attached pictures and clears the draft (while the assistant works it goes in line behind the request; nothing with nothing to send). */
  submit: (value: string) => void;
}

export function useDraft(): Draft {
  const busy = useAgent((s) => s.busy);
  const send = useAgent((s) => s.send);
  const queue = useAgent((s) => s.queue);
  const text = useAgent((s) => s.draftText);
  const attached = useAgent((s) => s.draftAttached);
  const setDraft = useAgent((s) => s.setDraft);
  const current = () => useAgent.getState().draftAttached;
  return {
    text,
    setText: (value) => setDraft({ text: value }),
    attached,
    attach: (names) => setDraft({ attached: withAttached(current(), names) }),
    detach: (name) => setDraft({ attached: current().filter((n) => n !== name) }),
    submit: (value) => {
      if (!value.trim() && !attached.length) return;
      setDraft({ text: '', attached: [] });
      if (busy) queue(value, attached);
      else void send(value, attached);
    },
  };
}

export function Composer({ draft, phone = false }: { draft: Draft; phone?: boolean }) {
  const { text, setText, attached, attach, detach, submit } = draft;
  const busy = useAgent((s) => s.busy);
  const cancel = useAgent((s) => s.cancel);
  const inputHeight = useAgent((s) => s.inputHeight);
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // The window's says Enter sends; on a phone Enter starts a new line.
  const placeholder = phone ? t('phone.agentPlaceholder') : t('agent.placeholder');
  // The "/" list: open while the box starts with a slash, until Escape closes it for that text.
  const [slashActive, setSlashActive] = useState(0);
  const [slashClosedFor, setSlashClosedFor] = useState<string | null>(null);
  const query = slashQuery(text);
  const slashOpen = query !== null && slashClosedFor !== text;
  const slashItems = slashOpen ? matchTemplates(query) : [];
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = () => {
    setText('');
    setSlashActive(0);
    setHelpOpen(true);
  };
  // Only the command stays in the box, like a slash command in a terminal: the rest is written after it.
  const completeTemplate = (tpl: SlashTemplate) => {
    const filled = `/${tpl.id} `;
    setText(filled);
    setSlashActive(0);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(filled.length, filled.length);
    });
  };
  // Choosing `/help` has nothing to complete, so it opens at once; Tab still only completes it, as for any command.
  const pickTemplate = (tpl: SlashTemplate) => {
    if (tpl.id === HELP_COMMAND) showHelp();
    else completeTemplate(tpl);
  };
  const sendText = () => {
    if (parseCommand(text)?.template.id === HELP_COMMAND) showHelp();
    else submit(expandCommand(text));
  };

  // On a phone the box is as tall as its text (phone.css caps it, and it scrolls inside beyond that).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!phone || !el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [phone, text]);

  return (
    <form
      className={cx('agent-win__input', dropping && 'is-dropping')}
      onSubmit={(e) => {
        e.preventDefault();
        sendText();
      }}
      onDragOver={(e) => {
        if (!isImageDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        if (!isImageDrag(e)) return;
        e.preventDefault();
        setDropping(false);
        void droppedPictures(e).then(attach);
      }}
      data-testid="agent-form"
    >
      {!phone && <InputGrip />}
      {dropping && <p className="agent-win__drop">{t('agent.attach.drop')}</p>}
      <AttachedStrip names={attached} onRemove={detach} />
      <AttachButton disabled={false} onPicked={attach} />
      {slashOpen && <SlashMenu items={slashItems} active={Math.min(slashActive, Math.max(0, slashItems.length - 1))} onPick={pickTemplate} onHover={setSlashActive} />}
      {helpOpen && !slashOpen && <SlashHelp onClose={() => setHelpOpen(false)} />}
      <Textarea
        ref={inputRef}
        value={text}
        rows={phone ? 1 : undefined}
        style={phone ? undefined : { height: inputHeight }}
        placeholder={placeholder}
        aria-label={placeholder}
        data-testid="agent-input"
        aria-expanded={slashOpen}
        aria-controls={slashOpen ? 'agent-slash-list' : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setSlashActive(0);
          setHelpOpen(false);
        }}
        onPaste={(e) => {
          const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
          if (!files.length) return;
          e.preventDefault();
          void storeFiles(files).then(attach);
        }}
        onKeyDown={(e) => {
          if (helpOpen && e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setHelpOpen(false);
            return;
          }
          if (slashOpen && !e.nativeEvent.isComposing) {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setSlashClosedFor(text);
              return;
            }
            if (slashItems.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              setSlashActive((i) => (Math.min(i, slashItems.length - 1) + step + slashItems.length) % slashItems.length);
              return;
            }
            const chosen = slashItems[Math.min(slashActive, slashItems.length - 1)];
            if (chosen && e.key === 'Tab') {
              e.preventDefault();
              completeTemplate(chosen);
              return;
            }
            if (chosen && e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              pickTemplate(chosen);
              return;
            }
          }
          if (!phone && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            sendText();
          }
        }}
      />
      {busy && <IconButton type="button" label={t('agent.stop')} icon={<Stop weight="fill" />} variant="solid" onClick={cancel} data-testid="agent-stop" />}
      {(!busy || text.trim() || attached.length > 0) && (
        <IconButton type="submit" label={t('agent.send')} icon={<ArrowUp />} variant="solid" scheme="invoke" disabled={!text.trim() && !attached.length} data-testid="agent-send" />
      )}
    </form>
  );
}

/** Said above the input while the connected server's model cannot use the app's tools: sending would fail. */
export function ToolsBanner() {
  const endpoint = useAgent((s) => (s.status?.provider === 'openai' ? s.status.endpoint : undefined));
  if (endpoint?.tools !== 'unsupported') return null;
  return (
    <p className="agent-tools-banner" role="alert" data-testid="agent-tools-banner">
      <Warning size={14} weight="fill" /> {t('agent.endpoint.tools.unsupported', { reason: endpoint.toolsReason ?? '' })} {t('agent.endpoint.tools.unsupportedHint')}
    </p>
  );
}
