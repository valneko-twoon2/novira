// Draws the comparison grid: the pictures in rows and columns, the values above and beside them, and a line that says
// what each axis varies. The picture is drawn on white with dark text whatever the app's theme, since it is a file.

/** The longest side of one cell, in pixels. */
export const MAX_CELL = 512;
const GAP = 8;
const MARGIN = 16;
const LABEL_WIDTH = 200;
const LABEL_HEIGHT = 44;
const TITLE_HEIGHT = 52;

export interface GridLayout {
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  /** Top-left corner of the cell in a column and row. */
  cell: (column: number, row: number) => { x: number; y: number };
  /** Where the column labels start (their top) and the row labels start (their left). */
  labelsTop: number;
  labelsLeft: number;
  /** The widths the label areas take; 0 when the axis is not used. */
  columnLabelsHeight: number;
  rowLabelsWidth: number;
}

/** The size of the whole picture and where each cell goes. A cell is the first picture's size shrunk to `MAX_CELL`. */
export function gridLayout(columns: number, rows: number, picture: { width: number; height: number }, uses: { x: boolean; y: boolean }): GridLayout {
  const scale = Math.min(1, MAX_CELL / Math.max(picture.width, picture.height, 1));
  const cellWidth = Math.max(1, Math.round(picture.width * scale));
  const cellHeight = Math.max(1, Math.round(picture.height * scale));
  const columnLabelsHeight = uses.x ? LABEL_HEIGHT : 0;
  const rowLabelsWidth = uses.y ? LABEL_WIDTH : 0;
  const labelsTop = MARGIN + TITLE_HEIGHT;
  const labelsLeft = MARGIN;
  const originX = MARGIN + rowLabelsWidth;
  const originY = labelsTop + columnLabelsHeight;
  return {
    width: originX + columns * cellWidth + (columns - 1) * GAP + MARGIN,
    height: originY + rows * cellHeight + (rows - 1) * GAP + MARGIN,
    cellWidth,
    cellHeight,
    cell: (column, row) => ({ x: originX + column * (cellWidth + GAP), y: originY + row * (cellHeight + GAP) }),
    labelsTop,
    labelsLeft,
    columnLabelsHeight,
    rowLabelsWidth,
  };
}

/** The text cut with an ellipsis so that it fits `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export interface GridContent {
  columns: number;
  rows: number;
  /** One entry per cell, row by row; null for a cell whose picture could not be made. */
  images: (CanvasImageSource | null)[];
  /** The first picture's size. */
  picture: { width: number; height: number };
  /** The line above the grid, and the label of each column and row (empty lists for an axis that is not used). */
  title: string;
  columnLabels: string[];
  rowLabels: string[];
}

/** Draws the grid at its full size and returns it as a PNG. */
export async function drawGrid(content: GridContent): Promise<Blob> {
  const layout = gridLayout(content.columns, content.rows, content.picture, { x: content.columnLabels.length > 0, y: content.rowLabels.length > 0 });
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#1a1a1a';
  ctx.font = '600 26px "Segoe UI", "Yu Gothic UI", sans-serif';
  ctx.fillText(fit(ctx, content.title, layout.width - 2 * layout.labelsLeft), layout.labelsLeft, layout.labelsTop - TITLE_HEIGHT / 2);

  ctx.font = '24px "Segoe UI", "Yu Gothic UI", sans-serif';
  ctx.fillStyle = '#333333';
  ctx.textAlign = 'center';
  content.columnLabels.forEach((label, column) => {
    const { x } = layout.cell(column, 0);
    ctx.fillText(fit(ctx, label, layout.cellWidth), x + layout.cellWidth / 2, layout.labelsTop + layout.columnLabelsHeight / 2);
  });
  ctx.textAlign = 'right';
  content.rowLabels.forEach((label, row) => {
    const { y } = layout.cell(0, row);
    ctx.fillText(fit(ctx, label, layout.rowLabelsWidth - GAP), layout.labelsLeft + layout.rowLabelsWidth - GAP, y + layout.cellHeight / 2);
  });

  content.images.forEach((image, index) => {
    const { x, y } = layout.cell(index % content.columns, Math.floor(index / content.columns));
    if (image) ctx.drawImage(image, x, y, layout.cellWidth, layout.cellHeight);
    else {
      ctx.fillStyle = '#eeeeee';
      ctx.fillRect(x, y, layout.cellWidth, layout.cellHeight);
      ctx.fillStyle = '#999999';
      ctx.textAlign = 'center';
      ctx.font = '32px sans-serif';
      ctx.fillText('×', x + layout.cellWidth / 2, y + layout.cellHeight / 2);
    }
  });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('empty image');
  return blob;
}
