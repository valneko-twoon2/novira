// Model Manager tab (Stability Matrix style): category rail, toolbar + card grid, detail panel, status bar.
import { useMemo, useState } from 'react';
import { useModels } from '@/state/models';
import { filterModels } from './filterModels';
import { useModelImport } from '@/state/dialogs/modelImport';
import { CoverHint } from './CoverHint';
import { ModelDetail } from './ModelDetail';
import { ModelGrid } from './ModelGrid';
import type { CategoryId } from './modelCategories';
import { ModelRail } from './ModelRail';
import { ModelStatusBar } from './ModelStatusBar';
import { ModelToolbar, type ToolbarState } from './ModelToolbar';
import { useInstallToasts } from './useInstallToasts';
import './models.css';
import './models-cards.css';
import './models-detail.css';
import './models-install.css';

const INITIAL: ToolbarState = { search: '', base: 'all', sort: 'name', view: 'grid', thumb: 180 };

export function ModelManager(_props: { tab?: unknown }) {
  useInstallToasts();
  const models = useModels((s) => s.models);
  const favorites = useModels((s) => s.favorites);
  const selected = useModels((s) => s.models.find((m) => m.key === s.selectedKey) ?? null);
  const [category, setCategory] = useState<CategoryId>('all');
  const [bar, setBar] = useState<ToolbarState>(INITIAL);
  const openImport = () => useModelImport.getState().open();

  const shown = useMemo(
    () => filterModels(models, { category, search: bar.search, base: bar.base, sort: bar.sort, favorites }),
    [models, category, bar.search, bar.base, bar.sort, favorites],
  );

  return (
    <div className="mm" data-testid="model-manager">
      <ModelRail category={category} onCategory={setCategory} models={models} favorites={favorites} />
      <div className="mm__main">
        <ModelToolbar state={bar} onChange={(patch) => setBar((s) => ({ ...s, ...patch }))} onImport={openImport} />
        <CoverHint models={models} />
        <div className="mm__body">
          <ModelGrid models={shown} total={models.length} view={bar.view} thumb={bar.thumb} onImport={openImport} />
          {selected && <ModelDetail key={selected.key} model={selected} />}
        </div>
        <ModelStatusBar models={models} shown={shown.length} />
      </div>
    </div>
  );
}
