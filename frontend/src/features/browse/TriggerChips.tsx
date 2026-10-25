import type { MouseEvent } from 'react';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { writeClipboardText } from '@/ui';

/** Trigger-word chips; clicking copies the word. */
export function TriggerChips({ words, max }: { words: string[]; max?: number }) {
  const shown = max ? words.slice(0, max) : words;
  const copy = async (e: MouseEvent, word: string) => {
    e.stopPropagation();
    try {
      await writeClipboardText(word);
      toast({ status: 'success', title: t('browse.detail.triggerCopied', { word }) }, 1800);
    } catch {
      toast({ status: 'warning', title: t('browse.detail.copyFailed') }, 1800);
    }
  };
  return (
    <div className="browse-chips">
      {shown.map((w) => (
        <button key={w} type="button" className="browse-chip" title={t('browse.detail.copyHint')} onClick={(e) => void copy(e, w)}>
          {w}
        </button>
      ))}
    </div>
  );
}
