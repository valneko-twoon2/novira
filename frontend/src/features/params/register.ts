// Registers the Invoke builders for the Generate and Upscaling tabs and default model selection.
import { registerAgentModelSelector } from '@/state/agent';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { registerInvokeBuilder } from '@/state/invoke';
import { refreshModelParts, useModelParts } from '@/state/modelParts';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useWildcards } from '@/state/prompts/wildcards';
import { buildGenerateRequest, buildUpscaleRequest } from './buildRequest';
import { autoSelectModels } from './model/autoSelect';
import { generateReadiness, generateWarnings, upscaleReadiness } from './readiness';
import { selectMainModel } from './model/selectMainModel';

function subscribeInputs(onChange: () => void): () => void {
  const a = useParams.subscribe(onChange);
  const b = useModels.subscribe(onChange);
  // Reference images wait for their node pack.
  const c = useNodePacks.subscribe((s, prev) => s.packs !== prev.packs && onChange());
  // Wildcards in the prompt need their lists.
  const d = useWildcards.subscribe((s, prev) => s.lists !== prev.lists && onChange());
  // Text encoders and the VAE the model needs.
  const e = useModelParts.subscribe((s, prev) => s.reports !== prev.reports && onChange());
  return () => {
    e();
    a();
    b();
    c();
    d();
  };
}

let registered = false;

export function registerParamsFeature() {
  registerInvokeBuilder('generate', {
    readiness: generateReadiness,
    warnings: generateWarnings,
    build: ({ prepend }) => buildGenerateRequest(prepend),
    subscribe: subscribeInputs,
  });
  registerInvokeBuilder('upscaling', {
    readiness: upscaleReadiness,
    build: ({ prepend }) => buildUpscaleRequest(prepend),
    subscribe: subscribeInputs,
  });
  registerAgentModelSelector((m) => selectMainModel(m, { quiet: true }));
  if (registered) return;
  registered = true;
  // What the chosen model is missing is asked again when the model or the installed files change.
  const checkParts = () => {
    const key = useParams.getState().modelKey;
    if (key && useModels.getState().models.some((m) => m.key === key)) void refreshModelParts(key);
  };
  useModels.subscribe((s, prev) => {
    if (s.models !== prev.models) {
      autoSelectModels();
      checkParts();
    }
  });
  useParams.subscribe((s, prev) => {
    if (s.modelKey !== prev.modelKey) {
      autoSelectModels();
      checkParts();
    }
  });
  autoSelectModels();
  checkParts();
}
