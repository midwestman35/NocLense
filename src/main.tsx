import { createRoot } from 'react-dom/client'
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css'
import App from './App.tsx'
import { loadServiceMappings } from './utils/messageCleanup'
import ErrorBoundary from './components/ErrorBoundary'
import { installGlobalErrorHandlers, reportRuntimeError } from './utils/errorReporting'

installGlobalErrorHandlers();

const _origConsoleError = console.error;
console.error = function(...args: unknown[]) {
  const msg = args.map(a => typeof a === 'string' ? a : '').join(' ');
  if (msg.includes('Component is not a function') || msg.includes('component tree')) {
    console.warn('[DEBUG-COMPONENT-ERROR]', ...args);
  }
  _origConsoleError.apply(console, args);
};

loadServiceMappings()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  })
  .catch((err) => {
    console.error('Failed to bootstrap app:', err);
    void reportRuntimeError({
      source: 'bootstrap',
      message: err instanceof Error ? err.message : 'Failed to bootstrap app',
      stack: err instanceof Error ? err.stack : undefined,
    });
  });
