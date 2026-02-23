import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadServiceMappings } from './utils/messageCleanup'
import ErrorBoundary from './components/ErrorBoundary'
import { installGlobalErrorHandlers, reportRuntimeError } from './utils/errorReporting'

// Install global handlers before app boot so startup crashes are captured.
installGlobalErrorHandlers();

// Load service mappings before rendering
loadServiceMappings()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
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
