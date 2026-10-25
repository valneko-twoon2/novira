// Global CSS is imported before the app so feature styles come later in the cascade and can override shared primitives.
import './theme/tokens.css';
import './theme/base.css';
import './ui/ui.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { backendReady, perf } from '@/backend';
import { hideToken } from '@/backend/http/hideToken';
import { localeReady } from '@/i18n';
import { adoptBackendUiState } from '@/state/uiStateSync';

// The app is loaded once the backend is set (the browser mock is a chunk of its own), and its first render waits for the
// saved language's messages (ja and en are built in; another language is a chunk).
async function start(root: HTMLElement) {
  await backendReady;
  hideToken();
  perf.mark('backend-ready');
  // Before the app is loaded: its stores read the saved state from the browser storage as they are made.
  await adoptBackendUiState();
  const { App } = await import('@/app/App');
  perf.mark('app-loaded');
  await localeReady();
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const root = document.getElementById('root');
// Nothing in the page can show a failure this early, so it goes to the console.
if (root) start(root).catch((err: unknown) => console.error('novira: the app could not start', err));
