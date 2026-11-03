// Positive and negative prompt boxes, always visible, each with its own preset row and prompt book button.
import { ArrowsOutSimple, BookOpen, ChatCenteredText, Sparkle, Tag, TextT } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { quickRunTool } from '@/state/imageTools/actions';
import { selectedStill, uploadPicture } from '@/state/imageTools/pickPicture';
import { findImage } from '@/state/gallery';
import { useParams } from '@/state/params';
import { usePromptBook } from '@/state/prompts/promptBook';
import type { PromptKind } from '@/state/prompts/promptBook';
import { toast } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { Button, cx, IconButton, ImageDropZone, Textarea } from '@/ui';
import { useMainModel } from '../model/useMainModel';
import { BigPromptEditor } from './BigPromptEditor';
import { DynamicPromptsButton } from './DynamicPromptsButton';
import { applyRecommendedPrompts, setPrompt } from './promptActions';
import { PromptTagView } from './PromptTagView';
import { TokenCounter } from './TokenCounter';

export function PromptBoxes() {
  const model = useMainModel();
  const [big, setBig] = useState(false);
  return (
    <section className="pp-prompts" data-testid="prompts">
      <header className="pp-prompts__head">
        <h3 className="pp-title">{t('params.prompt.title')}</h3>
        <span className="pp-spacer" />
        <Button
          size="xs"
          variant="ghost"
          scheme="accent"
          leftIcon={<Sparkle weight="fill" />}
          title={t('params.prompt.recommendedHint')}
          data-testid="prompt-recommended"
          onClick={() => {
            applyRecommendedPrompts(model);
            toast({ status: 'success', title: t('params.prompt.recommendedApplied') });
          }}
        >
          {t('params.prompt.recommended')}
        </Button>
        <IconButton size="xs" label={t('params.prompt.expand')} icon={<ArrowsOutSimple />} data-testid="prompt-expand" onClick={() => setBig(true)} />
      </header>
      <PromptField kind="positive" />
      <PromptField kind="negative" />
      {big && <BigPromptEditor onClose={() => setBig(false)} />}
    </section>
  );
}

/**
 * Describes a picture as a prompt at once: one dropped on it, the picture selected in the gallery, or a file picked
 * here. The viewer shows the picture, and its tool band the words with the buttons that put them into the prompt.
 */
function CaptionButton() {
  const fileInput = useRef<HTMLInputElement>(null);
  const describe = (name: string) => void quickRunTool('caption', name);
  const fromFile = (file: File | undefined) => {
    if (file) void uploadPicture(file).then((name) => name && describe(name));
  };
  return (
    <ImageDropZone
      className="pp-prompt__caption"
      label={t('caption.dropHere')}
      onImages={(names) => {
        const picked = findImage(names[0] ?? null);
        if (picked && (picked.mediaType ?? 'image') === 'image') describe(picked.name);
      }}
      onFiles={(files) => fromFile(files[0])}
    >
      <IconButton
        size="xs"
        label={t('caption.fromPrompt')}
        icon={<ChatCenteredText />}
        data-testid="prompt-caption"
        onClick={() => {
          const picked = selectedStill();
          if (picked) describe(picked);
          else fileInput.current?.click();
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        data-testid="prompt-caption-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          fromFile(file);
        }}
      />
    </ImageDropZone>
  );
}

function PromptField({ kind }: { kind: PromptKind }) {
  const text = useParams((s) => (kind === 'positive' ? s.positivePrompt : s.negativePrompt));
  const nonce = useUi((s) => s.focusPromptNonce);
  const openBook = usePromptBook((s) => s.openBook);
  const ref = useRef<HTMLTextAreaElement>(null);
  const positive = kind === 'positive';
  const [tagView, setTagView] = useState(false);

  useEffect(() => {
    if (positive && nonce > 0) ref.current?.focus();
  }, [positive, nonce]);

  return (
    <div className={cx('pp-prompt', `pp-prompt--${kind}`)}>
      <div className="pp-prompt__head">
        <span className="pp-prompt__label">{positive ? t('params.prompt.positive') : t('params.prompt.negative')}</span>
        <TokenCounter text={text} />
        <span className="pp-spacer" />
        <span className="pp-viewswitch" role="group" aria-label={t('params.prompt.view')}>
          <IconButton
            size="xs"
            label={t('params.prompt.textView')}
            icon={<TextT />}
            isActive={!tagView}
            aria-pressed={!tagView}
            data-testid={`${kind}-text-view`}
            onClick={() => setTagView(false)}
          />
          <IconButton
            size="xs"
            label={t('params.prompt.tagView')}
            icon={<Tag />}
            isActive={tagView}
            aria-pressed={tagView}
            data-testid={`${kind}-tag-view`}
            onClick={() => setTagView(true)}
          />
        </span>
        {positive && <CaptionButton />}
        <DynamicPromptsButton kind={kind} />
        <IconButton size="xs" label={t('params.promptBook.open')} icon={<BookOpen />} data-testid={`${kind}-open-book`} onClick={() => openBook(kind)} />
      </div>
      {tagView && <PromptTagView kind={kind} value={text} onChange={(v) => setPrompt(kind, v)} />}
      <Textarea
        ref={ref}
        hidden={tagView}
        className="pp-prompt__input"
        value={text}
        placeholder={positive ? t('params.prompt.positivePlaceholder') : t('params.prompt.negativePlaceholder')}
        aria-label={positive ? t('params.prompt.positive') : t('params.prompt.negative')}
        data-testid={`${kind}-prompt`}
        onChange={(e) => setPrompt(kind, e.target.value)}
      />
    </div>
  );
}
