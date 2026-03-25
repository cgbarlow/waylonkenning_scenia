/**
 * Embedding entry point for mounting Scenia inside a host application.
 *
 * Usage:
 *   import { mount } from 'scenia/embed';
 *   const unmount = mount({ container, dbAdapter });
 *   // later: unmount();
 */

import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setDbAdapter, type DbAdapter } from './lib/db';

export type { DbAdapter, AppData } from './lib/db';

export interface EmbedOptions {
  /** DOM element to mount the React app into. */
  container: HTMLElement;
  /** External persistence adapter (replaces IndexedDB). */
  dbAdapter: DbAdapter;
  /** Called when Scenia wants to navigate to a URL outside itself. */
  onNavigateExternal?: (url: string) => void;
}

/**
 * Mount the Scenia app into a container element.
 * Returns a cleanup function that unmounts the React tree.
 */
export function mount(options: EmbedOptions): () => void {
  setDbAdapter(options.dbAdapter);

  const root: Root = createRoot(options.container);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}
