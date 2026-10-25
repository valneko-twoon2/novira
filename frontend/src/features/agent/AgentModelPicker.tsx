// The model and the thinking effort the assistant's tool runs on, chosen beside the chat's title. The models are the ones the
// tool offers (Claude's aliases, the models Codex lists for the account), and Claude also takes a typed name. The efforts are
// the chosen model's, one of them always picked. The choice is kept for each tool and goes with every message from the next one on.
import { Brain, CaretDown, Warning } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { backend, type AgentEndpointTest, type AgentProvider } from '@/backend';
import { t } from '@/i18n';
import { effectiveEffort, effortsFor, useAgent } from '@/state/agent';
import { Button, Popover, PopoverContent, PopoverTrigger, Spinner, TextInput } from '@/ui';
import { TestResult } from './AgentEndpointForm';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The model of the connected server (from its list, or typed), what is known about its tool calls, and "Test connection". */
function EndpointPicker() {
  const endpoint = useAgent((s) => s.status?.endpoint);
  const saveEndpoint = useAgent((s) => s.saveEndpoint);
  const refreshStatus = useAgent((s) => s.refreshStatus);
  const changeProvider = useAgent((s) => s.changeProvider);
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [typed, setTyped] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<AgentEndpointTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = endpoint?.baseUrl;
  const model = endpoint?.model ?? '';

  // The list is read when the popover opens (the saved key is used by the backend).
  useEffect(() => {
    if (!open || !baseUrl) return;
    let current = true;
    setModels(null);
    backend
      .agentEndpointModels({ baseUrl, model: '' })
      .then((list) => current && setModels(list))
      .catch(() => current && setModels([]));
    return () => {
      current = false;
    };
  }, [open, baseUrl]);

  if (!endpoint) return null;
  const pick = async (next: string) => {
    const name = next.trim();
    if (!name || name === model) return;
    setError(null);
    setResult(null);
    try {
      await saveEndpoint({ baseUrl: endpoint.baseUrl, model: name });
      setTyped('');
    } catch (err) {
      setError(message(err));
    }
  };
  const runTest = async () => {
    setTesting(true);
    setError(null);
    try {
      setResult(await backend.agentEndpointTest({ baseUrl: endpoint.baseUrl, model }));
      await refreshStatus();
    } catch (err) {
      setError(message(err));
    } finally {
      setTesting(false);
    }
  };
  const unsupported = endpoint.tools === 'unsupported';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="agent-model" title={t('agent.model.title')} data-testid="agent-model" data-truncate-ok="model name in a fixed-width chip">
          {unsupported ? <Warning size={12} weight="fill" /> : <Brain size={12} />}
          <span className="agent-model__text">{model}</span>
          <CaretDown size={10} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="agent-model-pop">
        <div className="agent-model-pop__body" data-testid="agent-model-pop">
          <h3 className="agent-model-pop__title">{t('agent.model.label')}</h3>
          {models === null && <Spinner size={14} />}
          {models !== null && models.length > 0 && (
            <div className="agent-seg" role="group" aria-label={t('agent.model.label')}>
              {models.map((m) => (
                <button key={m} type="button" className="agent-seg__btn" aria-pressed={model === m} onClick={() => void pick(m)} data-testid={`agent-model-${m}`}>
                  {m}
                </button>
              ))}
            </div>
          )}
          {models !== null && models.length === 0 && <p className="agent-model-pop__hint" data-testid="agent-model-nolist">{t('agent.endpoint.noModels')}</p>}
          <TextInput
            value={typed}
            placeholder={t('agent.model.customPlaceholder')}
            aria-label={t('agent.model.custom')}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) void pick(typed);
            }}
            data-testid="agent-model-name"
          />
          <p className="agent-model-pop__hint" data-testid="agent-endpoint-tools-state">
            {endpoint.tools === 'unsupported' ? t('agent.endpoint.tools.unsupported', { reason: endpoint.toolsReason ?? '' }) : t(`agent.endpoint.tools.${endpoint.tools}`)}
          </p>
          {unsupported && <p className="agent-model-pop__hint">{t('agent.endpoint.tools.unsupportedHint')}</p>}
          {result && (
            <ul className="agent-endpoint__result" data-testid="agent-endpoint-result">
              <TestResult result={result} />
            </ul>
          )}
          {error && <p className="agent-setup__error" data-testid="agent-endpoint-error">{error}</p>}
          <div className="agent-endpoint__buttons">
            <Button size="xs" variant="outline" disabled={testing} onClick={() => void runTest()} data-testid="agent-endpoint-test">
              {testing ? t('agent.endpoint.testing') : t('agent.endpoint.test')}
            </Button>
            <Button size="xs" variant="ghost" onClick={changeProvider} data-testid="agent-endpoint-edit">
              {t('agent.endpoint.edit')}
            </Button>
          </div>
          <p className="agent-model-pop__hint">{t('agent.model.endpointHint')}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AgentModelPicker({ provider }: { provider: AgentProvider }) {
  return provider === 'openai' ? <EndpointPicker /> : <CliModelPicker provider={provider} />;
}

function CliModelPicker({ provider }: { provider: AgentProvider }) {
  const choice = useAgent((s) => s.choice[provider]);
  const models = useAgent((s) => s.status?.models) ?? [];
  const setChoice = useAgent((s) => s.setChoice);
  const canType = provider === 'claude';
  const listed = models.find((m) => m.id === choice.model);
  const [typing, setTyping] = useState(canType && choice.model !== '' && !listed);
  const pick = (model: string) => {
    setTyping(false);
    setChoice(provider, { model });
  };
  const { efforts } = effortsFor(provider, models, choice.model);
  const effort = effectiveEffort(provider, models, choice);
  const modelName = listed?.name ?? (choice.model || t('agent.model.default'));
  const summary = `${modelName} · ${t(`agent.effort.${effort}`)}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="agent-model" title={t('agent.model.title')} data-testid="agent-model" data-truncate-ok="model name in a fixed-width chip">
          <Brain size={12} />
          <span className="agent-model__text">{summary}</span>
          <CaretDown size={10} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="agent-model-pop">
        <div className="agent-model-pop__body" data-testid="agent-model-pop">
          <h3 className="agent-model-pop__title">{t('agent.model.label')}</h3>
          <div className="agent-seg" role="group" aria-label={t('agent.model.label')}>
            <button type="button" className="agent-seg__btn" aria-pressed={choice.model === '' && !typing} onClick={() => pick('')} data-testid="agent-model-default">
              {t('agent.model.default')}
            </button>
            {models.map((m) => (
              <button key={m.id} type="button" className="agent-seg__btn" aria-pressed={choice.model === m.id && !typing} onClick={() => pick(m.id)} data-testid={`agent-model-${m.id}`}>
                {m.name}
              </button>
            ))}
            {canType && (
              <button type="button" className="agent-seg__btn" aria-pressed={typing} onClick={() => setTyping(true)} data-testid="agent-model-custom">
                {t('agent.model.custom')}
              </button>
            )}
          </div>
          {typing && (
            <TextInput
              value={choice.model}
              placeholder={t('agent.model.customPlaceholder')}
              aria-label={t('agent.model.custom')}
              onChange={(e) => setChoice(provider, { model: e.target.value })}
              data-testid="agent-model-name"
            />
          )}
          <h3 className="agent-model-pop__title">{t('agent.effort.label')}</h3>
          <div className="agent-seg" role="group" aria-label={t('agent.effort.label')}>
            {efforts.map((e) => (
              <button key={e} type="button" className="agent-seg__btn" aria-pressed={effort === e} onClick={() => setChoice(provider, { effort: e })} data-testid={`agent-effort-${e}`}>
                {t(`agent.effort.${e}`)}
              </button>
            ))}
          </div>
          <p className="agent-model-pop__hint">{t('agent.model.hint')}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
