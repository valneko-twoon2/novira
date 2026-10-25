// When the start-up screen goes away: the backend is up, the screen has been seen long enough, and the app is ready to
// use: the image engine is no longer being installed or started, and the node list the editors need has been read (or
// the user chose to go ahead without waiting).
import { useCallback, useEffect, useState } from 'react';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useEngine } from '@/state/engine';

/** The screen stays at least this long, so the bubbles are seen even when everything is already in place. */
export const MIN_SPLASH_MS = 1800;
/** The engine reports `idle` for a moment before it starts; the screen waits this long for it to begin. */
export const ENGINE_START_GRACE_MS = 12_000;
/** Preparing never keeps the screen longer than this (a slow ComfyUI still opens the app, with the banner). */
export const MAX_PREPARE_MS = 40_000;

export function useSplashGate(backendReady: boolean): { showSplash: boolean; preparing: boolean; open: () => void } {
  const status = useEngine((s) => s.status);
  const nodes = useComfyNodes((s) => s.status);
  const [seenLongEnough, setSeen] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [released, setReleased] = useState(false);
  const [graceOver, setGraceOver] = useState(false);
  const [giveUp, setGiveUp] = useState(false);
  useEffect(() => {
    const timers = [setTimeout(() => setSeen(true), MIN_SPLASH_MS), setTimeout(() => setGraceOver(true), ENGINE_START_GRACE_MS), setTimeout(() => setGiveUp(true), MAX_PREPARE_MS)];
    return () => timers.forEach(clearTimeout);
  }, []);
  const engineReady = status.state === 'ready';
  // Read the node list as soon as the engine can answer, so the editors do not wait for it later.
  useEffect(() => {
    if (backendReady && engineReady) void useComfyNodes.getState().load();
  }, [backendReady, engineReady]);
  const working = status.state === 'downloading' || status.state === 'extracting' || status.state === 'starting' || status.state === 'error';
  const waitingForEngine = status.state === 'idle' && !graceOver;
  const readingNodes = engineReady && (nodes === 'idle' || nodes === 'loading');
  const preparing = backendReady && !giveUp && (waitingForEngine || readingNodes);
  const hold = !backendReady || !seenLongEnough || (working && !skipped) || (preparing && !skipped);
  useEffect(() => {
    // Once the app is shown it stays: a later engine message goes to the banner, not back to this screen.
    if (!hold) setReleased(true);
  }, [hold]);
  const open = useCallback(() => setSkipped(true), []);
  return { showSplash: !released && hold, preparing, open };
}
