import { useEffect } from 'react';
import { LogProvider } from './contexts/LogContext';
import { AIProvider } from './contexts/AIContext';
import { EvidenceProvider } from './contexts/EvidenceContext';
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
        <EvidenceProvider>
          <LogProvider>
            <AppShell />
          </LogProvider>
        </EvidenceProvider>
      </CaseProvider>
    </AIProvider>
  </ToastProvider>
);

export default App;
