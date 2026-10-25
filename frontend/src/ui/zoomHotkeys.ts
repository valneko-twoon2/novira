// Zoom shortcuts, the same on the canvas and in the image viewer (also listed in the hotkeys modal). Ctrl with + and -
// zooms the whole app instead (app/UiZoom.tsx), so the view steps with the bare keys.
export const ZOOM_HOTKEYS = {
  fit: 'mod+0',
  actualSize: 'mod+1',
  zoomIn: 'plus',
  zoomOut: 'minus',
} as const;
