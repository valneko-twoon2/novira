// The stage element: hosts the <canvas> driven by StageController, on the surrounding canvas store.
import { useEffect, useRef } from 'react';
import { useCanvasStoreApi } from '@/state/canvasStoreContext';
import { StageController } from './StageController';

export function CanvasStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useCanvasStoreApi();
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const controller = new StageController(canvas, host, store);
    controller.start();
    return () => controller.dispose();
  }, [store]);
  return (
    <div ref={hostRef} className="canvas-stage">
      <canvas ref={canvasRef} className="canvas-stage__canvas" data-testid="canvas-stage" />
    </div>
  );
}
