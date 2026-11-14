// Left panel of the Text tab, in the order of the Generate screen: the preset card, the seed row, the Generate bar and the model
// card in the header, then the prompts, the folded details and the section of the selected layer.
// Adding layers and the background are in the canvas toolbar, the layer stack in the right column, the candidates under the canvas.
import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { useTextEditor } from '@/state/text/textEditor';
import { Section } from '@/ui';
import { LayerProperties } from './LayerProperties';
import { RichDetails, RichHeader } from './RichSection';
import { TextPresetBar } from './TextPresetBar';
import { TextScenePresetBar } from './TextScenePresetBar';
import './text.css';

/** `prompts` is the Generate screen's prompt section, put in by the app (a feature does not import another). */
export function TextPanel({ prompts }: { prompts?: ReactNode }) {
  const scene = useTextEditor((s) => s.scene);
  const selectedId = useTextEditor((s) => s.selectedId);
  const selected = scene.layers.find((l) => l.id === selectedId) ?? null;
  return (
    <div className="tx-panel" data-testid="text-panel">
      <header className="pp-head">
        <TextScenePresetBar />
        <RichHeader />
      </header>
      <div className="pp-body">
        {prompts}
        <RichDetails />
        {selected && (
          <Section title={t(selected.type === 'text' ? 'text.layer.text' : 'text.layer.bubble')}>
            {selected.type === 'text' && <TextPresetBar />}
            <LayerProperties key={selected.id} layer={selected} />
          </Section>
        )}
      </div>
    </div>
  );
}
