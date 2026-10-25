// Positive and negative prompt boxes, always visible, each with its own preset row and prompt book button.
import { ArrowsOutSimple, BookOpen, ChatCenteredText, Sparkle, Tag, TextT } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useCaptionDialog } from '@/state/dialogs/caption';
import { findImage, useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
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

/** Opens "describe as a prompt" on a picture dropped on it, or on the picture selected in the gallery. */
function CaptionButton() {
  const showCaption = (name: string | null) => useCaptionDialog.getState().show(name);
  return (
    <ImageDropZone
      className="pp-prompt__caption"
      label={t('caption.dropHere')}
      onImages={(names) => showCaption(findImage(names[0] ?? null)?.name ?? null)}
      onFiles={(files) => {
        const f = files[0];
        if (!f) return;
        void backend.uploadImage(f, { boardId: autoAddBoardId(), category: 'user' }).then((image) => {
          useGallery.getState().addImage(image);
          showCaption(image.name);
        });
      }}
    >
      <Button
        size="xs"
        variant="ghost"
        leftIcon={<ChatCenteredText />}
        title={t('caption.fromPromptHint')}
        data-testid="prompt-caption"
        onClick={() => {
          const { selection } = useGallery.getState();
          const picked = selection.length === 1 ? findImage(selection[0] ?? null) : undefined;
          showCaption(picked && (picked.mediaType ?? 'image') === 'image' ? picked.name : null);
        }}
      >
        {t('caption.fromPrompt')}
      </Button>
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
        <IconButton
          size="xs"
          label={tagView ? t('params.prompt.textView') : t('params.prompt.tagView')}
          icon={tagView ? <TextT /> : <Tag />}
          aria-pressed={tagView}
          data-testid={`${kind}-tag-view`}
          onClick={() => setTagView(!tagView)}
        />
        {positive && <CaptionButton />}
        {positive && <DynamicPromptsButton />}
        <Button
          size="xs"
          variant="ghost"
          leftIcon={<BookOpen />}
          title={t('params.promptBook.openHint')}
          data-testid={`${kind}-open-book`}
          onClick={() => openBook(kind)}
        >
          {t('params.promptBook.open')}
        </Button>
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
