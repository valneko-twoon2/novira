// API key / token of a model site: saved encrypted by the backend and never read back, so only a mask is shown.
import { useEffect, useState } from 'react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { Button, TextInput } from '@/ui';

const MASK = '*'.repeat(10);

type Service = 'civitai' | 'huggingface';

const SERVICES: Record<Service, { has: () => Promise<boolean>; set: (v: string | null) => Promise<void> }> = {
  civitai: { has: () => backend.hasCivitaiKey(), set: (v) => backend.setCivitaiKey(v) },
  huggingface: { has: () => backend.hasHuggingFaceToken(), set: (v) => backend.setHuggingFaceToken(v) },
};

export function CivitaiKeyControl() {
  return <ApiKeyControl service="civitai" />;
}

export function HuggingFaceTokenControl() {
  return <ApiKeyControl service="huggingface" />;
}

function ApiKeyControl({ service }: { service: Service }) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void SERVICES[service].has().then((v) => alive && setSaved(v));
    return () => {
      alive = false;
    };
  }, [service]);

  const apply = async (key: string | null) => {
    setBusy(true);
    try {
      await SERVICES[service].set(key);
      setSaved(!!key);
      setEditing(false);
      setDraft('');
      toast({ status: 'success', title: t(key ? 'settings.civitaiKey.saved' : 'settings.civitaiKey.removed') });
    } catch (err) {
      toast({ status: 'error', title: t('settings.civitaiKey.failed'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  if (saved === null) return null;
  if (saved && !editing) {
    return (
      <div className="st-inline">
        <TextInput className="st-key" value={MASK} readOnly aria-label={t(service === 'civitai' ? 'settings.civitaiKey.label' : 'settings.hfToken.label')} data-testid="civitai-key-mask" />
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          {t('settings.civitaiKey.change')}
        </Button>
        <Button size="sm" scheme="danger" variant="outline" isLoading={busy} onClick={() => void apply(null)}>
          {t('settings.civitaiKey.remove')}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="st-inline"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) void apply(draft);
      }}
    >
      <TextInput
        className="st-key"
        type="password"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('settings.civitaiKey.placeholder')}
        aria-label={t(service === 'civitai' ? 'settings.civitaiKey.label' : 'settings.hfToken.label')}
        data-testid="civitai-key-input"
      />
      <Button size="sm" type="submit" scheme="accent" isLoading={busy} disabled={!draft.trim()}>
        {t('settings.civitaiKey.save')}
      </Button>
      {saved && (
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          {t('common.cancel')}
        </Button>
      )}
    </form>
  );
}
