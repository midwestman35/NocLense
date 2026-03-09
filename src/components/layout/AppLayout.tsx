import React, { useState, useCallback, memo } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, toggleTheme } from '../../utils/theme';
import { IconRail, type PanelId } from './IconRail';
import { SidebarPanel } from './SidebarPanel';
import { Button } from '../ui';

const PANEL_TITLES: Record<PanelId, string> = {
  case: 'Case',
  files: 'Files',
  callIds: 'Call IDs',
  reports: 'Reports',
  stations: 'Stations',
  ai: 'AI Analysis',
  filters: 'Filters',
};

interface AppLayoutProps {
  activePanel: PanelId | null;
  onActivePanelChange: (panel: PanelId | null) => void;
  panelContent: Record<PanelId, React.ReactNode>;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  onSettingsClick?: () => void;
}

function LayoutInner({
  activePanel,
  onActivePanelChange,
  panelContent,
  children,
  headerContent,
  rightSidebar,
  onSettingsClick,
}: AppLayoutProps) {
  const [theme, setThemeState] = useState(getTheme);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    setThemeState(getTheme());
  }, []);

  const handlePanelToggle = useCallback((panel: PanelId) => {
    onActivePanelChange(activePanel === panel ? null : panel);
  }, [activePanel, onActivePanelChange]);

  const handlePanelClose = useCallback(() => {
    onActivePanelChange(null);
  }, [onActivePanelChange]);

  const handleSettingsClick = useCallback(() => {
    onSettingsClick?.();
  }, [onSettingsClick]);

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
      <IconRail activePanel={activePanel} onPanelToggle={handlePanelToggle} onSettingsClick={handleSettingsClick} />

      <SidebarPanel title={activePanel ? PANEL_TITLES[activePanel] : ''} isOpen={activePanel !== null} onClose={handlePanelClose}>
        {activePanel && panelContent[activePanel]}
      </SidebarPanel>

      <div className="flex flex-1 min-w-0 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header
            className="relative h-[var(--header-height)] shrink-0 border-b border-[var(--border)]"
            style={{ backgroundImage: 'var(--header-surface)' }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: 'var(--header-highlight)' }}
            />
            <div className="relative flex h-full items-center px-3">
              <div className="mr-4 flex items-center gap-2.5 text-sm font-semibold tracking-tight text-[var(--foreground)]">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] shadow-[var(--shadow-sm)]">
                  <img
                    src="/app-icons/noclense-icon-lens-trace.svg"
                    alt="NocLense icon"
                    className="h-[18px] w-[18px] shrink-0 rounded-[4px]"
                  />
                </div>
                <span className="leading-none">NocLense</span>
              </div>

              <div className="min-w-0 flex-1">{headerContent}</div>

              <Button
                variant="icon"
                onClick={handleThemeToggle}
                aria-label="Toggle theme"
                className="ml-2 border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] text-[var(--foreground)] hover:bg-[var(--button-subtle-hover)]"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
            </div>
          </header>

          <main className="flex flex-1 flex-col overflow-hidden bg-[var(--workspace,var(--accent))]">{children}</main>
        </div>

        {rightSidebar && (
          <aside
            className="relative w-[var(--ai-sidebar-width)] shrink-0 overflow-hidden border-l border-[var(--border)]"
            style={{ backgroundImage: 'var(--sidebar-surface)' }}
          >
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'var(--sidebar-highlight)' }} />
            <div className="relative h-full">{rightSidebar}</div>
          </aside>
        )}
      </div>
    </div>
  );
}

export const AppLayout = memo(function AppLayout(props: AppLayoutProps) {
  return <LayoutInner {...props} />;
});
