// While the comic screen is open, the prompt boxes of the left panel are the selected panel's prompts: choosing a panel puts
// its prompts in the boxes, and what is typed, picked from a preset or the prompt presets goes into the panel. With no panel
// selected, the boxes keep the panel selected last (or the page's first; see workPanel), so they always belong to one. The
// boxes' own text (the Generate tab's) is kept aside while the comic screen is open, and put back when another screen opens;
// it is also what the saved form holds meanwhile, so closing the app on the comic screen keeps the Generate tab's prompts.
import { keepPromptsForSaving, useParams } from '@/state/params';
import { useUi } from '@/state/ui';
import { useComic, workPanel } from './store';

/** The Generate tab's prompts, kept while the comic screen has the boxes; null while another screen has them. */
let kept: { positive: string; negative: string } | null = null;
/** Set while the sync itself writes the boxes, so that write is not taken for the user's. */
let writing = false;

const onComic = () => useUi.getState().activeTab === 'comic';

/** Puts the work panel's prompts in the boxes (empty boxes when the page has no panel). */
function showSelected() {
  const panel = workPanel(useComic.getState())?.panel;
  const positivePrompt = panel?.prompt ?? '';
  const negativePrompt = panel?.negativePrompt ?? '';
  const p = useParams.getState();
  if (p.positivePrompt === positivePrompt && p.negativePrompt === negativePrompt) return;
  writing = true;
  try {
    p.set({ positivePrompt, negativePrompt });
  } finally {
    writing = false;
  }
}

function followTab() {
  if (onComic() && !kept) {
    const p = useParams.getState();
    kept = { positive: p.positivePrompt, negative: p.negativePrompt };
    keepPromptsForSaving({ positivePrompt: kept.positive, negativePrompt: kept.negative });
    showSelected();
  } else if (!onComic() && kept) {
    const back = kept;
    kept = null;
    keepPromptsForSaving(null);
    writing = true;
    try {
      useParams.getState().set({ positivePrompt: back.positive, negativePrompt: back.negative });
    } finally {
      writing = false;
    }
  }
}

/** Starts tying the prompt boxes to the selected panel while the comic screen is open. Returns the function that stops it. */
export function startComicPromptSync(): () => void {
  const stopUi = useUi.subscribe(followTab);
  const stopComic = useComic.subscribe(() => {
    if (!kept) return;
    showSelected();
  });
  const stopParams = useParams.subscribe((p, before) => {
    if (!kept || writing) return;
    const s = useComic.getState();
    const panel = workPanel(s)?.panel;
    if (!panel) return;
    if (p.positivePrompt !== before.positivePrompt && p.positivePrompt !== panel.prompt) s.setPrompt(panel.id, p.positivePrompt);
    if (p.negativePrompt !== before.negativePrompt && p.negativePrompt !== panel.negativePrompt) s.setPanelNegative(panel.id, p.negativePrompt);
  });
  followTab();
  return () => {
    stopUi();
    stopComic();
    stopParams();
    if (kept) {
      keepPromptsForSaving(null);
      useParams.getState().set({ positivePrompt: kept.positive, negativePrompt: kept.negative });
      kept = null;
    }
  };
}
