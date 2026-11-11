// The Markdown of the assistant's answers: the blocks and inline pieces that models write, and the text that must stay as it is.
import { describe, expect, it } from 'vitest';
import { parseBlocks, parseInline } from './markdownBlocks';

describe('blocks', { tags: [] }, () => {
  it('reads an answer with bold headings and a list, as models write it', { tags: ['equivalence'] }, () => {
    const text = '質感の指定だけを取り入れました。\n\n**足したもの(ポジティブ)**\n- **線と塗り**: clean delicate linework\n- **目**: expressive eyes\n\n**ネガティブ**: flat colors を足しました。';
    expect(parseBlocks(text)).toEqual([
      { kind: 'paragraph', text: '質感の指定だけを取り入れました。' },
      { kind: 'paragraph', text: '**足したもの(ポジティブ)**' },
      {
        kind: 'list',
        ordered: false,
        start: 1,
        items: [[{ kind: 'paragraph', text: '**線と塗り**: clean delicate linework' }], [{ kind: 'paragraph', text: '**目**: expressive eyes' }]],
      },
      { kind: 'paragraph', text: '**ネガティブ**: flat colors を足しました。' },
    ]);
  });

  it('keeps the line breaks inside a paragraph and ends it at a block', { tags: ['condition'] }, () => {
    expect(parseBlocks('one\ntwo\n# Head\nthree')).toEqual([
      { kind: 'paragraph', text: 'one\ntwo' },
      { kind: 'heading', level: 1, text: 'Head' },
      { kind: 'paragraph', text: 'three' },
    ]);
    expect(parseBlocks('a\r\nb')).toEqual([{ kind: 'paragraph', text: 'a\nb' }]);
  });

  it('reads headings of every level, rules, quotes and code with its text untouched', { tags: ['equivalence'] }, () => {
    expect(parseBlocks('###### six ##\n---\n> quoted\n> **two**\n```ts\nconst a = **b**;\n\n# not a heading\n```')).toEqual([
      { kind: 'heading', level: 6, text: 'six' },
      { kind: 'rule' },
      { kind: 'quote', blocks: [{ kind: 'paragraph', text: 'quoted\n**two**' }] },
      { kind: 'code', text: 'const a = **b**;\n\n# not a heading' },
    ]);
    // A fence that is never closed runs to the end.
    expect(parseBlocks('```\nopen')).toEqual([{ kind: 'code', text: 'open' }]);
  });

  it('reads numbered lists from their first number, nested lists and items split by blank lines', { tags: ['boundary'] }, () => {
    expect(parseBlocks('3. three\n4. four\n   - inner\n\n5. five')).toEqual([
      {
        kind: 'list',
        ordered: true,
        start: 3,
        items: [
          [{ kind: 'paragraph', text: 'three' }],
          [
            { kind: 'paragraph', text: 'four' },
            { kind: 'list', ordered: false, start: 1, items: [[{ kind: 'paragraph', text: 'inner' }]] },
          ],
          [{ kind: 'paragraph', text: 'five' }],
        ],
      },
    ]);
    // A bullet list after a numbered one is a list of its own, and a line after the list ends it.
    const [first, second, after] = parseBlocks('1) a\n- b\n\nend');
    expect(first).toMatchObject({ kind: 'list', ordered: true, items: [[{ text: 'a' }]] });
    expect(second).toMatchObject({ kind: 'list', ordered: false, items: [[{ text: 'b' }]] });
    expect(after).toEqual({ kind: 'paragraph', text: 'end' });
  });

  it('reads a table with its header and rows, an escaped pipe kept in its cell', { tags: ['equivalence'] }, () => {
    expect(parseBlocks('| a | b |\n|---|:-:|\n| 1 | x \\| y |\n| 2 |\n\nafter')).toEqual([
      {
        kind: 'table',
        head: ['a', 'b'],
        rows: [
          ['1', 'x | y'],
          ['2'],
        ],
      },
      { kind: 'paragraph', text: 'after' },
    ]);
  });

  it('leaves plain text that only looks like Markdown as a paragraph', { tags: ['error-guessing'] }, () => {
    for (const text of ['1.5倍にしました', '*強調*で始まる文', 'a | b', '#タグ', '-1 は負の数']) {
      expect(parseBlocks(text)).toEqual([{ kind: 'paragraph', text }]);
    }
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks('\n \n')).toEqual([]);
  });
});

describe('inline pieces', { tags: [] }, () => {
  it('reads bold, italics, strike-through, code and links, nested where models nest them', { tags: ['equivalence'] }, () => {
    expect(parseInline('**bold *and em* here** `a**b**` ~~gone~~ [Wiki](https://ja.wikipedia.org/wiki/A)')).toEqual([
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'bold ' },
          { kind: 'em', children: [{ kind: 'text', text: 'and em' }] },
          { kind: 'text', text: ' here' },
        ],
      },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'a**b**' },
      { kind: 'text', text: ' ' },
      { kind: 'del', children: [{ kind: 'text', text: 'gone' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', children: [{ kind: 'text', text: 'Wiki' }], href: 'https://ja.wikipedia.org/wiki/A' },
    ]);
    expect(parseInline('__under__ and _em_')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'under' }] },
      { kind: 'text', text: ' and ' },
      { kind: 'em', children: [{ kind: 'text', text: 'em' }] },
    ]);
  });

  it('leaves names, arithmetic, lone markers and escapes as text', { tags: ['error-guessing'] }, () => {
    for (const text of ['snake_case_name', '2 * 3 * 4', '** not bold **', 'a_b and c_d', 'price: 5*']) {
      expect(parseInline(text)).toEqual([{ kind: 'text', text }]);
    }
    expect(parseInline('\\*not em\\*')).toEqual([{ kind: 'text', text: '*not em*' }]);
    expect(parseInline('')).toEqual([]);
  });
});
