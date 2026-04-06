import { useEffect } from 'react';
import { LogProvider } from './contexts/LogContext';
import { AIProvider } from './contexts/AIContext';
import { CaseProvider } from './store/caseContext';
import { initTheme } from './utils/theme';
import { ToastProvider } from './components/ui';
import { NewWorkspaceLayout } from './components/workspace/NewWorkspaceLayout';

function AppShell() {
  useEffect(() => {
    initTheme();
  }, []);

  return <NewWorkspaceLayout />;
}

const App = () => (
  <ToastProvider>
    <AIProvider>
      <CaseProvider>
        <LogProvider>
          <AppShell />
        </LogProvider>
      </CaseProvider>
    </AIProvider>
  </ToastProvider>
);

export default App;
