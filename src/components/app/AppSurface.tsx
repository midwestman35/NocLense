import { useState, type JSX } from 'react';
import { DashboardScreen } from '../dashboard/DashboardScreen';
import { SplashScreen } from '../splash/SplashScreen';
import { NewWorkspaceLayout } from '../workspace/NewWorkspaceLayout';

type Surface = 'splash' | 'dashboard' | 'workspace';

export function AppSurface(): JSX.Element {
  const [surface, setSurface] = useState<Surface>('splash');

  if (surface === 'splash') {
    return <SplashScreen onContinue={() => setSurface('dashboard')} />;
  }

  if (surface === 'dashboard') {
    return <DashboardScreen onOpenWorkspace={() => setSurface('workspace')} />;
  }

  return <NewWorkspaceLayout onBackToDashboard={() => setSurface('dashboard')} />;
}
