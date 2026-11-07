// The layer stack of the Text tab, in the right column under the gallery (where the Canvas tab keeps its layers).
import { ArrowDown, ArrowUp, ChatCircle, Copy, Eye, EyeSlash, Lock, LockOpen, TextT, Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useTextEditor } from '@/state/text/textEditor';
import { cx, IconButton } from '@/ui';
import './text.css';

export function TextLayersPanel() {
  const layers = useTextEditor((s) => s.scene.layers);
  const selectedId = useTextEditor((s) => s.selectedId);
  const { select, update, remove, duplicate, reorder, clear } = useTextEditor.getState();
  return (
    <section className="panel tx-layerpanel" data-testid="text-layers">
      <h3 className="tx-layerpanel__title">
        {t('text.layers.title')}
        {layers.length > 0 && (
          <button type="button" className="tx-link" onClick={() => clear()}>
            {t('text.layers.clear')}
          </button>
        )}
      </h3>
      <div className="panel__scroll tx-layerpanel__scroll">
        {layers.length === 0 && <p className="tx-note">{t('text.layers.empty')}</p>}
        <ul className="tx-layers">
          {[...layers].reverse().map((l) => (
            <li key={l.id} className={cx('tx-layer', l.id === selectedId && 'is-selected', !l.visible && 'is-hidden')}>
              <button type="button" className="tx-layer__main" onClick={() => select(l.id)} data-testid={`text-layer-${l.id}`}>
                {l.type === 'text' ? <TextT size={14} /> : <ChatCircle size={14} />}
                <span className="tx-layer__name">{l.text.split('\n')[0] || t(l.type === 'text' ? 'text.layer.text' : 'text.layer.bubble')}</span>
              </button>
              <IconButton label={t(l.visible ? 'text.layer.hide' : 'text.layer.show')} icon={l.visible ? <Eye /> : <EyeSlash />} size="xs" onClick={() => update(l.id, { visible: !l.visible })} />
              <IconButton label={t(l.locked ? 'text.layer.unlock' : 'text.layer.lock')} icon={l.locked ? <Lock /> : <LockOpen />} size="xs" onClick={() => update(l.id, { locked: !l.locked })} />
              <IconButton label={t('text.layer.up')} icon={<ArrowUp />} size="xs" onClick={() => reorder(l.id, 'up')} />
              <IconButton label={t('text.layer.down')} icon={<ArrowDown />} size="xs" onClick={() => reorder(l.id, 'down')} />
              <IconButton label={t('text.layer.duplicate')} icon={<Copy />} size="xs" onClick={() => duplicate(l.id)} />
              <IconButton label={t('text.layer.delete')} icon={<Trash />} size="xs" onClick={() => remove(l.id)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
