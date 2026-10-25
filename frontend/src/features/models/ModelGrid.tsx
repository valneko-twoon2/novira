// Scrollable grid (or list) of model cards with the empty state.
import { Cube, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useState, type CSSProperties } from 'react';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useUi } from '@/state/ui';
import { Button, EmptyState } from '@/ui';
import { DeleteModelDialog } from './DeleteModelDialog';
import { ModelCard } from './ModelCard';

export type ViewMode = 'grid' | 'list';

export function ModelGrid({ models, total, view, thumb, onImport }: { models: ModelConfig[]; total: number; view: ViewMode; thumb: number; onImport: () => void }) {
  const selectedKey = useModels((s) => s.selectedKey);
  const setSelectedKey = useModels((s) => s.setSelectedKey);
  const favorites = useModels((s) => s.favorites);
  const toggleFavorite = useModels((s) => s.toggleFavorite);
  const [deleting, setDeleting] = useState<ModelConfig | null>(null);

  if (models.length === 0) {
    const none = total === 0;
    return (
      <div className="mm-grid-empty">
        <EmptyState
          icon={none ? <Cube size={36} weight="light" /> : <MagnifyingGlass size={36} weight="light" />}
          title={none ? t('models.empty.title') : t('models.noMatch')}
          description={none ? t('models.empty.description') : undefined}
        >
          {none && (
            <div className="mm-empty__actions">
              <Button scheme="accent" leftIcon={<MagnifyingGlass size={14} />} onClick={() => useUi.getState().setTab('browse')}>
                {t('models.find')}
              </Button>
              <Button variant="outline" leftIcon={<Plus size={14} />} onClick={onImport}>
                {t('models.import')}
              </Button>
            </div>
          )}
        </EmptyState>
      </div>
    );
  }
  const style = { '--mm-thumb': `${thumb}px` } as CSSProperties;
  return (
    <div className="mm-grid-scroll">
      <div className={`mm-grid mm-grid--${view}`} style={style} data-testid="mm-grid">
        {models.map((m) => (
          <ModelCard
            key={m.key}
            model={m}
            selected={m.key === selectedKey}
            favorite={favorites.includes(m.key)}
            onSelect={() => setSelectedKey(m.key === selectedKey ? null : m.key)}
            onToggleFavorite={() => toggleFavorite(m.key)}
            onDelete={() => setDeleting(m)}
          />
        ))}
      </div>
      <DeleteModelDialog model={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
