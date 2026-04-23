import { useState, type JSX } from 'react';
import { AuthScreen } from '../auth/AuthScreen';
import { DashboardScreen } from '../dashboard/DashboardScreen';
import { NewWorkspaceLayout } from '../workspace/NewWorkspaceLayout';

type Surface = 'auth' | 'dashboard' | 'workspace';

export function AppSurface(): JSX.Element {
  const [surface, setSurface] = useState<Surface>('auth');

  if (surface === 'auth') {
    return <AuthScreen onSuccess={() => setSurface('dashboard')} />;
  }

  if (surface === 'dashboard') {
    return (
      <DashboardScreen
        onOpenWorkspace={() => setSurface('workspace')}
        onResetAuth={() => setSurface('auth')}
      />
    );
  }

  return <NewWorkspaceLayout />;
}
