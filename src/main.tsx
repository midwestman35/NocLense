import { createRoot } from 'react-dom/client'
import '@fontsource/inter-tight/300.css';
import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/inter-tight/700.css';
import '@fontsource/geist-mono/300.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';
import '@fontsource/instrument-serif/400-italic.css';
import './index.css'
import App from './App.tsx'
import { loadServiceMappings } from './utils/messageCleanup'
import ErrorBoundary from './components/ErrorBoundary'
import { installGlobalErrorHandlers, reportRuntimeError } from './utils/errorReporting'
import { initCredentials } from './services/credentials'

installGlobalErrorHandlers();
initCredentials();

// Phase 07A: lock dark theme; clear legacy light-mode preference
try {
  localStorage.removeItem('noclense-theme');
} catch {
  // ignore (sandbox, private mode)
}
document.documentElement.setAttribute('data-theme', 'dark');

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
