// The assistant's answer as the Markdown it was written in (`markdownBlocks.ts`), built from React elements so every piece
// stays text. A link shows its words and then its address; it is not followed from the chat.
import { Fragment, type ReactNode } from 'react';
import { cx } from '@/ui';
import { parseBlocks, parseInline, type MdBlock, type MdInline } from './markdownBlocks';

function inlineNodes(pieces: readonly MdInline[]): ReactNode[] {
  return pieces.map((p, i) => {
    switch (p.kind) {
      case 'text':
        return <Fragment key={i}>{p.text}</Fragment>;
      case 'code':
        return <code key={i}>{p.text}</code>;
      case 'strong':
        return <strong key={i}>{inlineNodes(p.children)}</strong>;
      case 'em':
        return <em key={i}>{inlineNodes(p.children)}</em>;
      case 'del':
        return <del key={i}>{inlineNodes(p.children)}</del>;
      case 'link': {
        const label = p.children.map((c) => (c.kind === 'text' || c.kind === 'code' ? c.text : '')).join('');
        return (
          <Fragment key={i}>
            {inlineNodes(p.children)}
            {label === p.href ? null : ` (${p.href})`}
          </Fragment>
        );
      }
    }
  });
}

/** One line of Markdown text (bold, italics, code, links), for places that hold no blocks. */
export function InlineMarkdown({ text }: { text: string }) {
  return <>{inlineNodes(parseInline(text))}</>;
}

function blockNode(block: MdBlock, key: number): ReactNode {
  switch (block.kind) {
    case 'paragraph':
      return <p key={key}>{inlineNodes(parseInline(block.text))}</p>;
    case 'heading':
      return (
        <p key={key} className={cx('agent-md__heading', block.level <= 2 && 'is-major')} role="heading" aria-level={Math.min(6, block.level + 2)}>
          {inlineNodes(parseInline(block.text))}
        </p>
      );
    case 'list': {
      const items = block.items.map((item, i) => <li key={i}>{item.map(blockNode)}</li>);
      return block.ordered ? (
        <ol key={key} start={block.start}>
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }
    case 'quote':
      return <blockquote key={key}>{block.blocks.map(blockNode)}</blockquote>;
    case 'code':
      return (
        <pre key={key} className="agent-md__code">
          <code>{block.text}</code>
        </pre>
      );
    case 'table':
      return (
        <div key={key} className="agent-md__table">
          <table>
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i}>{inlineNodes(parseInline(cell))}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {block.head.map((_, c) => (
                    <td key={c}>{inlineNodes(parseInline(row[c] ?? ''))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'rule':
      return <hr key={key} />;
  }
}

/** A whole answer in Markdown. */
export function ChatMarkdown({ text, className }: { text: string; className?: string }) {
  return <div className={cx('agent-md', className)}>{parseBlocks(text).map(blockNode)}</div>;
}
