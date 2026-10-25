// The form that connects the assistant to an OpenAI-compatible server (Ollama, LM Studio, ...): the address with one-click
// presets, an optional API key, the model (a list from the server when it gives one, always typeable), "Test connection"
// and "Use this server". The backend makes every call; the key goes there once and is never shown again.
import { ArrowLeft, ArrowsClockwise, CheckCircle, Warning, XCircle } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { backend, type AgentEndpointInput, type AgentEndpointTest } from '@/backend';
import { t } from '@/i18n';
import { addressKind, ENDPOINT_PRESETS } from '@/state/agentEndpoint';
import { useAgent } from '@/state/agent';
import { Button, IconButton, Spinner, TextInput } from '@/ui';

type Busy = 'models' | 'test' | 'save' | null;
type ModelsNote = { kind: 'found'; count: number } | { kind: 'none'; reason: string };

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** One line of the test's result. */
function Line({ ok, children, id }: { ok: boolean; children: ReactNode; id: string }) {
  return (
    <li className={ok ? 'agent-endpoint__ok' : 'agent-endpoint__bad'} data-testid={id}>
      {ok ? <CheckCircle size={14} weight="fill" /> : <XCircle size={14} weight="fill" />}
      <span>{children}</span>
    </li>
  );
}

/** What the test found, as lines. */
export function TestResult({ result }: { result: AgentEndpointTest }) {
  if (!result.reachable) return <Line ok={false} id="agent-endpoint-unreachable">{t('agent.endpoint.result.unreachable', { reason: result.error ?? '' })}</Line>;
  return (
    <>
      <Line ok id="agent-endpoint-reachable">{t('agent.endpoint.result.reachable')}</Line>
      {result.modelFound !== undefined && (
        <Line ok={result.modelFound} id="agent-endpoint-model-found">
          {t(result.modelFound ? 'agent.endpoint.result.modelFound' : 'agent.endpoint.result.modelMissing')}
        </Line>
      )}
      {result.tools === 'supported' && <Line ok id="agent-endpoint-tools">{t('agent.endpoint.result.toolsOk')}</Line>}
      {result.tools === 'unsupported' && <Line ok={false} id="agent-endpoint-tools">{t('agent.endpoint.result.toolsNo', { reason: result.toolsReason ?? '' })}</Line>}
      {result.tools === 'unknown' && result.error && <Line ok={false} id="agent-endpoint-tools">{t('agent.endpoint.result.toolsUnchecked', { reason: result.error })}</Line>}
    </>
  );
}

export function AgentEndpointForm({ onBack }: { onBack: () => void }) {
  const saved = useAgent((s) => s.status?.endpoint);
  const saveEndpoint = useAgent((s) => s.saveEndpoint);
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? '');
  const [model, setModel] = useState(saved?.model ?? '');
  const [key, setKey] = useState('');
  // The key is sent only once the user has touched the field; untouched, the saved key stays as it is.
  const [keyTouched, setKeyTouched] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [note, setNote] = useState<ModelsNote | null>(null);
  const [test, setTest] = useState<AgentEndpointTest | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const kind = addressKind(baseUrl);
  const input = (address = baseUrl): AgentEndpointInput => ({ baseUrl: address.trim(), model: model.trim(), ...(keyTouched ? { apiKey: key } : {}) });
  const hasSavedKey = !!saved?.hasKey && saved.baseUrl === baseUrl.trim().replace(/\/+$/, '');

  const loadModels = async (address = baseUrl) => {
    setBusy('models');
    setNote(null);
    try {
      const list = await backend.agentEndpointModels(input(address));
      setModels(list);
      setNote({ kind: 'found', count: list.length });
    } catch (err) {
      setModels([]);
      setNote({ kind: 'none', reason: message(err) });
    } finally {
      setBusy(null);
    }
  };

  const choosePreset = (url: string) => {
    setBaseUrl(url);
    setTest(null);
    setError(null);
    void loadModels(url);
  };

  const runTest = async () => {
    setBusy('test');
    setTest(null);
    setError(null);
    try {
      setTest(await backend.agentEndpointTest(input()));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      await saveEndpoint(input());
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  };

  const canSave = kind !== 'invalid' && model.trim() !== '' && busy === null;
  return (
    <div className="agent-setup agent-endpoint" data-testid="agent-endpoint-form">
      <div className="agent-endpoint__head">
        <IconButton size="xs" label={t('agent.changeProvider')} icon={<ArrowLeft />} onClick={onBack} data-testid="agent-endpoint-back" />
        <h3 className="agent-endpoint__title">{t('agent.endpoint.title')}</h3>
      </div>
      <p className="agent-endpoint__hint">{t('agent.endpoint.intro')}</p>
      <div className="agent-endpoint__field">
        <span className="agent-endpoint__label">{t('agent.endpoint.presets')}</span>
        <div className="agent-seg">
          {ENDPOINT_PRESETS.map((p) => (
            <button key={p.id} type="button" className="agent-seg__btn" aria-pressed={baseUrl.trim() === p.url} disabled={busy !== null} onClick={() => choosePreset(p.url)} data-testid={`agent-endpoint-preset-${p.id}`}>
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <label className="agent-endpoint__field">
        <span className="agent-endpoint__label">{t('agent.endpoint.address')}</span>
        <TextInput value={baseUrl} spellCheck={false} placeholder="http://127.0.0.1:11434/v1" onChange={(e) => { setBaseUrl(e.target.value); setTest(null); }} data-testid="agent-endpoint-url" />
        <span className="agent-endpoint__hint">{t('agent.endpoint.addressHint')}</span>
      </label>
      {baseUrl.trim() !== '' && kind === 'invalid' && <p className="agent-endpoint__warn" data-testid="agent-endpoint-warn-invalid"><Warning size={14} weight="fill" /> {t('agent.endpoint.warn.invalid')}</p>}
      {kind === 'remote-http' && <p className="agent-endpoint__warn" data-testid="agent-endpoint-warn-http"><Warning size={14} weight="fill" /> {t('agent.endpoint.warn.http')}</p>}
      {(kind === 'remote-http' || kind === 'remote-https') && <p className="agent-endpoint__warn" data-testid="agent-endpoint-warn-remote"><Warning size={14} weight="fill" /> {t('agent.endpoint.warn.remote')}</p>}
      <label className="agent-endpoint__field">
        <span className="agent-endpoint__label">{t('agent.endpoint.key')}</span>
        <TextInput
          type="password"
          autoComplete="off"
          value={key}
          placeholder={hasSavedKey && !keyTouched ? t('agent.endpoint.keySaved') : ''}
          onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }}
          data-testid="agent-endpoint-key"
        />
        <span className="agent-endpoint__hint">{keyTouched && key === '' && hasSavedKey ? t('agent.endpoint.keyRemoved') : t('agent.endpoint.keyHint')}</span>
      </label>
      {hasSavedKey && !keyTouched && (
        <Button size="xs" variant="ghost" onClick={() => { setKey(''); setKeyTouched(true); }} data-testid="agent-endpoint-key-remove">
          {t('agent.endpoint.keyRemove')}
        </Button>
      )}
      <div className="agent-endpoint__field">
        <span className="agent-endpoint__label">{t('agent.endpoint.model')}</span>
        <div className="agent-endpoint__row">
          <TextInput list="agent-endpoint-models" value={model} spellCheck={false} placeholder={t('agent.endpoint.modelPlaceholder')} onChange={(e) => { setModel(e.target.value); setTest(null); }} data-testid="agent-endpoint-model" />
          <datalist id="agent-endpoint-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <IconButton size="xs" label={t('agent.endpoint.refresh')} icon={busy === 'models' ? <Spinner size={14} /> : <ArrowsClockwise />} disabled={busy !== null || kind === 'invalid'} onClick={() => void loadModels()} data-testid="agent-endpoint-refresh" />
        </div>
        {note?.kind === 'found' && <span className="agent-endpoint__hint" data-testid="agent-endpoint-models-found">{t('agent.endpoint.modelsFound', { count: note.count })}</span>}
        {note?.kind === 'none' && <span className="agent-endpoint__hint" data-testid="agent-endpoint-models-none">{t('agent.endpoint.modelsNone', { reason: note.reason })}</span>}
      </div>
      {busy === 'test' && (
        <p className="agent-setup__wait">
          <Spinner size={14} /> {t('agent.endpoint.testing')}
        </p>
      )}
      {test && (
        <ul className="agent-endpoint__result" data-testid="agent-endpoint-result">
          <TestResult result={test} />
        </ul>
      )}
      {error && <p className="agent-setup__error" data-testid="agent-endpoint-error">{error}</p>}
      <div className="agent-endpoint__buttons">
        <Button size="sm" variant="outline" disabled={busy !== null || kind === 'invalid'} onClick={() => void runTest()} data-testid="agent-endpoint-test">
          {t('agent.endpoint.test')}
        </Button>
        <Button size="sm" variant="solid" scheme="invoke" disabled={!canSave} onClick={() => void save()} data-testid="agent-endpoint-save">
          {t('agent.endpoint.use')}
        </Button>
      </div>
    </div>
  );
}
