// The page side of the contrast check (a11yContrast.spec.ts): text on a solid background, measured from computed styles. axe
// leaves colour contrast out because it cannot judge gradients and images, so this reads only text whose background is a plain
// colour all the way up, and skips the rest. Runs in the browser, so it uses nothing from outside its own body.
import type { Page } from '@playwright/test';

export interface LowContrast {
  /** A stable name of the element: tag, first class and test id. */
  key: string;
  text: string;
  ratio: number;
  /** The ratio the text needed: 3 for large text, 4.5 otherwise. */
  needed: number;
}

export interface ContrastResult {
  low: LowContrast[];
  /** How many pieces of text were measured, and how many were skipped because of a gradient, an image or a picture behind them. */
  measured: number;
  skipped: number;
}

export function measureContrast(page: Page): Promise<ContrastResult> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    /** Any CSS colour as [r, g, b, a] (a 0..1); the canvas understands every syntax the browser does. */
    const parse = (value: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const over = (top: [number, number, number, number], bottom: [number, number, number, number]): [number, number, number, number] => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      return [0, 1, 2].map((i) => (top[i]! * top[3] + bottom[i]! * bottom[3] * (1 - top[3])) / a).concat(a) as [number, number, number, number];
    };
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const lum = (c: number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
    const ratioOf = (a: number[], b: number[]) => {
      const [hi, lo] = lum(a) >= lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
      return (hi + 0.05) / (lo + 0.05);
    };
    const keyOf = (el: Element) => {
      const id = el.getAttribute('data-testid');
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean)[0] ?? '' : '';
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${id ? `[${id}]` : ''}`;
    };

    const low: LowContrast[] = [];
    let measured = 0;
    let skipped = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg, canvas, [aria-hidden="true"], .sr-only, [data-layout-ignore]')) continue;
      let text = '';
      for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) text += n.textContent ?? '';
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      // A control that is switched off is exempt from the contrast rule.
      if (el.closest(':disabled, [aria-disabled="true"], [data-disabled]')) continue;

      // Walk up to the first opaque background; an image or gradient on the way, or a hidden ancestor, ends the measurement.
      let bg: [number, number, number, number] = [0, 0, 0, 0];
      let opacity = 1;
      let unknown = false;
      let hidden = false;
      for (let p: Element | null = el; p; p = p.parentElement) {
        const pcs = getComputedStyle(p);
        if (pcs.display === 'none' || pcs.visibility === 'hidden') hidden = true;
        opacity *= parseFloat(pcs.opacity);
        if (pcs.backgroundImage !== 'none') {
          unknown = true;
          break;
        }
        bg = over(bg, parse(pcs.backgroundColor));
        if (bg[3] >= 0.999) break;
      }
      if (hidden || opacity < 0.05) continue;
      if (unknown || bg[3] < 0.999) {
        skipped++;
        continue;
      }
      const fg = parse(cs.color);
      const seen = over([fg[0], fg[1], fg[2], fg[3] * opacity], bg);
      const px = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const needed = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
      measured++;
      const ratio = ratioOf(seen, bg);
      if (ratio < needed) low.push({ key: keyOf(el), text: text.slice(0, 30), ratio: Math.round(ratio * 100) / 100, needed });
    }
    return { low, measured, skipped };
  });
}
