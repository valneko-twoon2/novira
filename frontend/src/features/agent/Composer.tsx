// The assistant's message box, shared by the floating window, the comic's column and the phone's chat screen: the
// pictures attached to the next message (the paperclip, a drop or a paste), the "/" list of ready-made requests, the
// text, and send (stop while the assistant works). The draft lives in `useDraft`, so a starting suggestion goes out the
// same way. In the window the box's height is the one dragged from its top edge and Enter sends; on a phone the box
// grows with its text and Enter starts a new line, as a phone's keyboard expects.
import { ArrowUp, Stop, Warning } from '@phosphor-icons/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { isImageDrag } from '@/state/dnd';
import { cx, IconButton, Textarea } from '@/ui';
import { AttachButton, AttachedStrip, droppedPictures, storeFiles, withAttached } from './Attachments';
import { InputGrip } from './InputGrip';
import { SlashMenu } from './SlashMenu';
import { matchTemplates, slashQuery, type SlashTemplate } from './slashTemplates';

/** The message being written and the pictures that go with it. */
export interface Draft {
  text: string;
  setText: (text: string) => void;
  attached: string[];
  attach: (names: readonly string[]) => void;
  detach: (name: string) => void;
  /** Sends `value` with the attached pictures and clears the draft (nothing while the assistant works or with nothing to send). */
  submit: (value: string) => void;
}

export function useDraft(): Draft {
  const busy = useAgent((s) => s.busy);
  const send = useAgent((s) => s.send);
  const [text, setText] = useState('');
  const [attached, setAttached] = useState<string[]>([]);
  return {
    text,
    setText,
    attached,
    attach: (names) => setAttached((current) => withAttached(current, names)),
    detach: (name) => setAttached((current) => current.filter((n) => n !== name)),
    submit: (value) => {
      if ((!value.trim() && !attached.length) || busy) return;
      setText('');
      setAttached([]);
      void send(value, attached);
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
  const pickTemplate = (tpl: SlashTemplate) => {
    const filled = t(tpl.text);
    setText(filled);
    setSlashActive(0);
    // The sentence is to be finished: the caret goes to its end.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(filled.length, filled.length);
    });
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
        submit(text);
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
      <AttachButton disabled={busy} onPicked={attach} />
      {slashOpen && <SlashMenu items={slashItems} active={Math.min(slashActive, Math.max(0, slashItems.length - 1))} onPick={pickTemplate} onHover={setSlashActive} />}
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
        }}
        onPaste={(e) => {
          const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
          if (!files.length) return;
          e.preventDefault();
          void storeFiles(files).then(attach);
        }}
        onKeyDown={(e) => {
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
            if (chosen && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) {
              e.preventDefault();
              pickTemplate(chosen);
              return;
            }
          }
          if (!phone && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit(text);
          }
        }}
      />
      {busy ? (
        <IconButton type="button" label={t('agent.stop')} icon={<Stop weight="fill" />} variant="solid" onClick={cancel} data-testid="agent-stop" />
      ) : (
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
