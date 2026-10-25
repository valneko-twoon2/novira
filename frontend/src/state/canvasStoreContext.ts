// Which canvas store the canvas feature's components act on: the Image tab's global `useCanvas` by default, or another
// instance (a comic page) given by a `CanvasStoreProvider` above them. Non-React canvas code takes the store as an
// argument instead.
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useCanvas, type CanvasState, type CanvasStore } from './canvas';

const CanvasStoreContext = createContext<CanvasStore>(useCanvas);

/** Makes the canvas components below act on `store` instead of the global `useCanvas`. */
export function CanvasStoreProvider({ store, children }: { store: CanvasStore; children?: ReactNode }) {
  return createElement(CanvasStoreContext.Provider, { value: store }, children);
}

/** The store the surrounding provider gives (the global `useCanvas` without one), for handlers and actions. */
export function useCanvasStoreApi(): CanvasStore {
  return useContext(CanvasStoreContext);
}

/** Reads a slice of the surrounding canvas store and re-renders when it changes. */
export function useCanvasStore<T>(selector: (s: CanvasState) => T): T {
  return useStore(useContext(CanvasStoreContext), selector);
}
