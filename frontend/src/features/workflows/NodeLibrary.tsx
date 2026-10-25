// "Nodes" tab of the left panel, laid out like ComfyUI's node library: sections (built-in, ComfyUI's own, extensions)
// of folders that open and close, and a search that lists what matches with where it sits. A double-click (or Enter)
// adds the node to the middle of the canvas and a drag places it where it is dropped, so the canvas is never covered by a dialog.
import { CaretDown, CaretRight, Folder, FolderOpen, GitCommit } from '@phosphor-icons/react';
import { useState, type CSSProperties, type DragEvent } from 'react';
import { t, tCount } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { TextInput, cx } from '@/ui';
import { useComfyWords } from './comfyWords';
import { addLibraryNode, NODE_MIME } from './nodeAdder';
import { matchingTemplates } from './nodeCatalog';
import { nodeTree, pathLabel, type NodeFolder } from './nodeTree';
import { nodeDesc, nodeTitle, type NodeTemplate } from './templates';

/** Folders the user opened, kept while the tab is closed and opened again. */
const opened = new Set<string>();

const indent = (depth: number) => ({ '--wf-nodes-depth': depth }) as CSSProperties;

function startDrag(e: DragEvent, tpl: NodeTemplate) {
  e.dataTransfer.setData(NODE_MIME, tpl.type);
  e.dataTransfer.effectAllowed = 'copy';
}

function NodeItem({ tpl, depth, path }: { tpl: NodeTemplate; depth: number; path?: string }) {
  const desc = nodeDesc(tpl.type);
  return (
    <button
      type="button"
      draggable
      className={cx('wf-nodes__item', path && 'is-flat')}
      style={indent(depth)}
      data-testid="wf-lib-item"
      title={desc || undefined}
      onDragStart={(e) => startDrag(e, tpl)}
      onDoubleClick={() => addLibraryNode(tpl)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        addLibraryNode(tpl);
      }}
    >
      <GitCommit size={14} className="wf-nodes__icon" aria-hidden />
      <span className="wf-nodes__text">
        <span className="wf-nodes__name">{nodeTitle(tpl.type)}</span>
        {path && <span className="wf-nodes__path">{path}</span>}
      </span>
    </button>
  );
}

function FolderRow({ folder, depth, onToggle }: { folder: NodeFolder; depth: number; onToggle: (id: string) => void }) {
  const open = opened.has(folder.id);
  return (
    <>
      <button type="button" className="wf-nodes__folder" style={indent(depth)} aria-expanded={open} data-testid="wf-lib-group" onClick={() => onToggle(folder.id)}>
        {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
        {open ? <FolderOpen size={14} /> : <Folder size={14} />}
        <span className="wf-nodes__label">{folder.label}</span>
        <span className="wf-nodes__count" aria-label={tCount('workflows.nodeLibrary.count', folder.count)}>
          {folder.count}
        </span>
      </button>
      {open && (
        <>
          {folder.folders.map((f) => (
            <FolderRow key={f.id} folder={f} depth={depth + 1} onToggle={onToggle} />
          ))}
          {folder.nodes.map((tpl) => (
            <NodeItem key={tpl.type} tpl={tpl} depth={depth + 1} />
          ))}
        </>
      )}
    </>
  );
}

export function NodeLibrary() {
  const [query, setQuery] = useState('');
  const [, bump] = useState(0);
  // Re-list when ComfyUI's node definitions arrive.
  useComfyNodes((s) => s.defs);
  useComfyWords();
  const matching = matchingTemplates(query);
  const searching = query.trim() !== '';
  const toggle = (id: string) => {
    if (!opened.delete(id)) opened.add(id);
    bump((n) => n + 1);
  };

  return (
    <div className="wf-nodes" data-testid="wf-node-library">
      <TextInput value={query} placeholder={t('workflows.nodeLibrary.placeholder')} aria-label={t('workflows.nodeLibrary.placeholder')} onChange={(e) => setQuery(e.target.value)} />
      <div className="wf-nodes__hint">{t('workflows.nodeLibrary.hint')}</div>
      {matching.length === 0 && <div className="wf-picker__empty">{t('workflows.picker.noResults')}</div>}
      {searching
        ? matching.map((tpl) => <NodeItem key={tpl.type} tpl={tpl} depth={0} path={pathLabel(tpl)} />)
        : nodeTree(matching).map((section) => (
            <section key={section.id} className="wf-nodes__section" data-testid="wf-lib-section">
              <div className="wf-nodes__heading">{section.label}</div>
              {section.folders.map((f) => (
                <FolderRow key={f.id} folder={f} depth={0} onToggle={toggle} />
              ))}
              {section.nodes.map((tpl) => (
                <NodeItem key={tpl.type} tpl={tpl} depth={0} />
              ))}
            </section>
          ))}
    </div>
  );
}
