import React, { useState, useCallback, useRef, memo } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, toggleTheme } from '../../utils/theme';
import { IconRail, type PanelId } from './IconRail';
import { SidebarPanel } from './SidebarPanel';
import { Button } from '../ui';

const AI_SIDEBAR_STORAGE_KEY = 'noclense-ai-sidebar-width';
const AI_SIDEBAR_DEFAULT = 340;
const AI_SIDEBAR_MIN = 280;
const AI_SIDEBAR_MAX_VW = 0.65; // 65% of viewport

function loadSidebarWidth(): number {
  try {
    const saved = localStorage.getItem(AI_SIDEBAR_STORAGE_KEY);
    if (saved) {
      const w = parseInt(saved, 10);
      if (w >= AI_SIDEBAR_MIN && w <= window.innerWidth * AI_SIDEBAR_MAX_VW) return w;
    }
  } catch { /* ignore */ }
  return AI_SIDEBAR_DEFAULT;
}

function saveSidebarWidth(w: number): void {
  try { localStorage.setItem(AI_SIDEBAR_STORAGE_KEY, String(Math.round(w))); } catch { /* ignore */ }
}

const APP_ICON_SRC = `${import.meta.env.BASE_URL}app-icons/noclense-icon-lens-trace.svg`;

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
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const draggingSidebar = useRef(false);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    setThemeState(getTheme());
  }, []);

  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!draggingSidebar.current) return;
      // Sidebar is on the right, so width = viewport right edge - mouse X
      const newWidth = window.innerWidth - ev.clientX;
      const clamped = Math.min(window.innerWidth * AI_SIDEBAR_MAX_VW, Math.max(AI_SIDEBAR_MIN, newWidth));
      setSidebarWidth(clamped);
    };

    const onMouseUp = () => {
      draggingSidebar.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Persist on release
      setSidebarWidth(prev => { saveSidebarWidth(prev); return prev; });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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
                    src={APP_ICON_SRC}
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
            className="relative shrink-0 overflow-hidden flex"
            style={{ width: sidebarWidth }}
          >
            {/* Drag handle on the left edge of the sidebar */}
            <div
              onMouseDown={handleSidebarDragStart}
              className="group relative flex w-1 shrink-0 cursor-col-resize items-center justify-center border-l border-[var(--border)] hover:bg-[var(--ring)]/20 transition-colors"
              title="Drag to resize sidebar"
            >
              <div className="absolute flex flex-col gap-1 opacity-0 group-hover:opacity-60 transition-opacity">
                {[0,1,2].map(i => (
                  <div key={i} className="h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--muted-foreground)' }} />
                ))}
              </div>
              <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
            </div>
            <div
              className="relative flex-1 min-w-0 overflow-hidden"
              style={{ backgroundImage: 'var(--sidebar-surface)' }}
            >
              <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'var(--sidebar-highlight)' }} />
              <div className="relative h-full">{rightSidebar}</div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export const AppLayout = memo(function AppLayout(props: AppLayoutProps) {
  return <LayoutInner {...props} />;
});
