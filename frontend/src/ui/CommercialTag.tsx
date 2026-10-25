// Tag showing whether a model may be used commercially (summary of its license terms). Clicking it lists each use
// the license allows or forbids, as the site states it.
import { Check, Prohibit, Question, SealCheck, Warning, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CommercialUse, ModelPermission, ModelSource } from '@/backend';
import { t } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from './overlays';

const ICONS: Record<CommercialUse, ReactNode> = {
  allowed: <SealCheck size={12} weight="fill" />,
  limited: <Warning size={12} weight="fill" />,
  denied: <Prohibit size={12} weight="bold" />,
};

function Mark({ allowed }: { allowed: boolean | null }) {
  if (allowed === true)
    return <Check size={14} weight="bold" aria-label={t('browse.permission.yes')} />;
  if (allowed === false)
    return <X size={14} weight="bold" aria-label={t('browse.permission.no')} />;
  return <Question size={14} weight="bold" aria-label={t('browse.permission.unknown')} />;
}

/** Closes the list that is open now: only one tag's list is shown at a time (a press on another tag does not count as
 * outside for the open one, so it would otherwise stay). */
let closeOpen: (() => void) | null = null;

function stateOf(allowed: boolean | null): string {
  return allowed === true ? 'yes' : allowed === false ? 'no' : 'unknown';
}

export function CommercialTag({
  value,
  permissions,
  license = [],
  source,
  ariaLabel,
}: {
  value: CommercialUse;
  permissions?: ModelPermission[];
  license?: string[];
  source?: ModelSource;
  /** Accessible name when the label may be hidden (the model cards show only the icon when narrow). */
  ariaLabel?: string;
}) {
  const fromHf = source === 'huggingface';
  const [open, setOpen] = useState(false);
  // Closed because another tag opened: focus must stay on that one, or its list would close at once.
  const replaced = useRef(false);
  useEffect(() => {
    if (!open) return;
    const close = () => {
      replaced.current = true;
      setOpen(false);
    };
    closeOpen?.();
    closeOpen = close;
    return () => {
      if (closeOpen === close) closeOpen = null;
    };
  }, [open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`browse-commercial browse-commercial--${value}`}
          data-testid="commercial-tag"
          data-commercial={value}
          title={t(`browse.commercial.${value}.hint`)}
          aria-label={ariaLabel}
          // Cards open the detail drawer on click; the tag opens only its own list.
          onClick={(e) => e.stopPropagation()}
        >
          {ICONS[value]}
          <span className="browse-commercial__label">{t(`browse.commercial.${value}`)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="browse-perm"
        onCloseAutoFocus={(e) => {
          if (replaced.current) e.preventDefault();
          replaced.current = false;
        }}
      >
        <div data-testid="commercial-permissions" onClick={(e) => e.stopPropagation()}>
          <div className="browse-perm__title">{t('browse.permission.title')}</div>
          {permissions && permissions.length > 0 ? (
            <ul className="browse-perm__list">
              {permissions.map((p) => (
                <li
                  key={p.key}
                  className={`browse-perm__row is-${stateOf(p.allowed)}`}
                  data-permission={p.key}
                  data-allowed={stateOf(p.allowed)}
                >
                  <span className="browse-perm__mark">
                    <Mark allowed={p.allowed} />
                  </span>
                  <span>{t(`browse.permission.${p.key}`)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="browse-perm__note">{t('browse.permission.none')}</p>
          )}
          <p className="browse-perm__note">
            {fromHf
              ? t('browse.permission.sourceHf', {
                  license: license[0] ?? t('browse.permission.noLicense'),
                })
              : t('browse.permission.sourceCivitai')}
          </p>
          <p className="browse-perm__note">{t('browse.permission.disclaimer')}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
