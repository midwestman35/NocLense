import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { LogProvider } from './contexts/LogContext';
import { AIProvider } from './contexts/AIContext';
import { EvidenceProvider } from './contexts/EvidenceContext';
import { CaseProvider } from './store/caseContext';
import { initTheme } from './utils/theme';
import { ToastProvider } from './components/ui';
import { NewWorkspaceLayout } from './components/workspace/NewWorkspaceLayout';
import './services/caseLibraryBootstrap';

function AppShell() {
  useEffect(() => {
    initTheme();
  }, []);

  return <NewWorkspaceLayout />;
}

const App = () => (
  <MotionConfig reducedMotion="user">
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
  </MotionConfig>
);

export default App;
