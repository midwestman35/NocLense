# Hybrid Redesign Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the four foundation components (WorkspaceCard, WorkspaceGrid, PhaseHeader, RoomRouter) and the room transition timeline utility. All additive — nothing removed, nothing broken.

**Architecture:** New components live in `src/components/workspace/`. They depend on existing design tokens, the anime.js utility layer (`src/utils/anime.ts`), and standard React patterns. `RoomRouter` will later replace `AppLayout`, but in Phase 1 it is standalone and unused by the running app.

**Tech Stack:** React 19, TypeScript strict, Tailwind 4, anime.js v4 (via existing `src/utils/anime.ts` hooks), Vitest + Testing Library

---

## File Structure

```
src/components/workspace/          # New directory
├── WorkspaceCard.tsx              # Card primitive with expand/collapse
├── WorkspaceGrid.tsx              # CSS grid layout manager per room
├── PhaseHeader.tsx                # Header with phase dots + ticket context
├── PhaseDots.tsx                  # Animated dot stepper (extracted for reuse)
├── RoomRouter.tsx                 # Phase manager orchestrating room transitions
├── types.ts                      # Shared types (Phase, CardId, etc.)
├── __tests__/
│   ├── WorkspaceCard.test.tsx
│   ├── PhaseHeader.test.tsx
│   └── PhaseDots.test.tsx
```

```
src/styles/tokens.css              # Modified — add room + card tokens
src/components/ui/index.ts         # Modified — export WorkspaceCard
```

---

### Task 1: Shared Types

**Files:**
- Create: `src/components/workspace/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/components/workspace/types.ts

export type Phase = 'import' | 'investigate' | 'submit';

export type CardId =
  | 'log-stream'
  | 'ai-assistant'
  | 'evidence'
  | 'similar-tickets'
  | 'correlation-graph'
  | 'datadog-live';

export interface CardState {
  id: CardId;
  expanded: boolean;
}

export const PHASE_ORDER: Phase[] = ['import', 'investigate', 'submit'];

export const PHASE_LABELS: Record<Phase, string> = {
  import: 'Import',
  investigate: 'Investigate',
  submit: 'Submit',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workspace/types.ts
git commit -m "feat(workspace): add shared Phase and CardId types"
```

---

### Task 2: Design Tokens

**Files:**
- Modify: `src/styles/tokens.css` (append new section at end of file)

- [ ] **Step 1: Add room and card tokens**

Append to the end of `src/styles/tokens.css`:

```css
/* ── Room & Card System ── */
:root {
  --room-transition-duration: 600ms;
  --room-transition-ease: cubic-bezier(0.33, 1, 0.68, 1);

  --card-radius: 12px;
  --card-border: #263025;
  --card-border-hover: #3a5030;
  --card-header-height: 40px;
  --card-collapsed-height: 36px;
  --card-expand-duration: 350ms;

  --room-import-glow: radial-gradient(ellipse at center, rgba(118,206,64,0.03) 0%, transparent 70%);
  --room-submit-glow: radial-gradient(ellipse at center, rgba(118,206,64,0.02) 0%, transparent 70%);
  --room-investigate-bg: var(--workspace);

  --phase-dot-size: 8px;
  --phase-dot-inactive: #263025;
  --phase-dot-complete: #51912b;
  --phase-dot-active: #76ce40;
  --phase-dot-glow: 0 0 8px rgba(118,206,64,0.4);
}

[data-theme="light"] {
  --card-border: #e5e5e5;
  --card-border-hover: #d4d4d4;
  --phase-dot-inactive: #d4d4d4;
  --room-import-glow: radial-gradient(ellipse at center, rgba(81,145,43,0.04) 0%, transparent 70%);
  --room-submit-glow: radial-gradient(ellipse at center, rgba(81,145,43,0.03) 0%, transparent 70%);
}
```

- [ ] **Step 2: Verify build**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npm run build 2>&1 | grep -E "error|built"`
Expected: `✓ built in ~4s`

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(tokens): add room transition and card system design tokens"
```

---

### Task 3: PhaseDots Component

**Files:**
- Create: `src/components/workspace/PhaseDots.tsx`
- Create: `src/components/workspace/__tests__/PhaseDots.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/workspace/__tests__/PhaseDots.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhaseDots } from '../PhaseDots';

describe('PhaseDots', () => {
  it('renders three phase dots', () => {
    render(<PhaseDots current="import" onNavigate={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('marks the current phase as active', () => {
    render(<PhaseDots current="investigate" onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    // Investigate is index 1
    expect(buttons[1].getAttribute('aria-current')).toBe('step');
  });

  it('marks completed phases', () => {
    render(<PhaseDots current="submit" onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    // Import and Investigate are completed (before Submit)
    expect(buttons[0].getAttribute('data-completed')).toBe('true');
    expect(buttons[1].getAttribute('data-completed')).toBe('true');
    expect(buttons[2].getAttribute('aria-current')).toBe('step');
  });

  it('calls onNavigate when clicking a completed phase', () => {
    const onNavigate = vi.fn();
    render(<PhaseDots current="investigate" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // Click Import (completed)
    expect(onNavigate).toHaveBeenCalledWith('import');
  });

  it('does not call onNavigate when clicking future phase', () => {
    const onNavigate = vi.fn();
    render(<PhaseDots current="import" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]); // Click Submit (future)
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not call onNavigate when clicking current phase', () => {
    const onNavigate = vi.fn();
    render(<PhaseDots current="investigate" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // Click Investigate (current)
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npx vitest run src/components/workspace/__tests__/PhaseDots.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PhaseDots**

```typescript
// src/components/workspace/PhaseDots.tsx
import { clsx } from 'clsx';
import type { Phase } from './types';
import { PHASE_ORDER, PHASE_LABELS } from './types';

interface PhaseDotsProps {
  current: Phase;
  onNavigate: (phase: Phase) => void;
  className?: string;
}

export function PhaseDots({ current, onNavigate, className }: PhaseDotsProps) {
  const currentIdx = PHASE_ORDER.indexOf(current);

  return (
    <div className={clsx('flex items-center gap-1', className)} role="navigation" aria-label="Investigation phases">
      {PHASE_ORDER.map((phase, i) => {
        const isActive = phase === current;
        const isCompleted = i < currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={phase} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className="w-5 h-px transition-colors duration-300"
                style={{ backgroundColor: isCompleted || isActive ? 'var(--phase-dot-complete)' : 'var(--phase-dot-inactive)' }}
              />
            )}
            <button
              role="button"
              aria-label={PHASE_LABELS[phase]}
              aria-current={isActive ? 'step' : undefined}
              data-completed={isCompleted ? 'true' : undefined}
              onClick={() => {
                if (isCompleted) onNavigate(phase);
              }}
              className={clsx(
                'flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-300',
                isActive && 'text-[var(--phase-dot-active)]',
                isCompleted && 'text-[var(--phase-dot-complete)] cursor-pointer hover:text-[var(--phase-dot-active)]',
                isFuture && 'text-[var(--phase-dot-inactive)] cursor-default',
              )}
              disabled={isFuture}
            >
              <span
                className={clsx(
                  'block rounded-full transition-all duration-300',
                  isActive && 'shadow-[var(--phase-dot-glow)]',
                )}
                style={{
                  width: 'var(--phase-dot-size)',
                  height: 'var(--phase-dot-size)',
                  backgroundColor: isActive
                    ? 'var(--phase-dot-active)'
                    : isCompleted
                      ? 'var(--phase-dot-complete)'
                      : 'var(--phase-dot-inactive)',
                }}
              />
              {PHASE_LABELS[phase]}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npx vitest run src/components/workspace/__tests__/PhaseDots.test.tsx`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/PhaseDots.tsx src/components/workspace/__tests__/PhaseDots.test.tsx
git commit -m "feat(workspace): add PhaseDots animated stepper component"
```

---

### Task 4: PhaseHeader Component

**Files:**
- Create: `src/components/workspace/PhaseHeader.tsx`
- Create: `src/components/workspace/__tests__/PhaseHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/workspace/__tests__/PhaseHeader.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseHeader } from '../PhaseHeader';

// Mock theme utils
vi.mock('../../../utils/theme', () => ({
  getTheme: vi.fn(() => 'dark'),
  toggleTheme: vi.fn(),
}));

describe('PhaseHeader', () => {
  it('renders logo and phase dots', () => {
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} />);
    expect(screen.getByText('NocLense')).toBeInTheDocument();
    expect(screen.getByLabelText('Import')).toBeInTheDocument();
    expect(screen.getByLabelText('Investigate')).toBeInTheDocument();
    expect(screen.getByLabelText('Submit')).toBeInTheDocument();
  });

  it('shows ticket context when ticketId is provided', () => {
    render(<PhaseHeader phase="investigate" onPhaseChange={() => {}} ticketId="45892" />);
    expect(screen.getByText('#45892')).toBeInTheDocument();
  });

  it('does not show ticket context in import phase without ticketId', () => {
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} />);
    expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} />);
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
  });

  it('renders settings button', () => {
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} onSettingsClick={() => {}} />);
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npx vitest run src/components/workspace/__tests__/PhaseHeader.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PhaseHeader**

```typescript
// src/components/workspace/PhaseHeader.tsx
import { useState, useCallback } from 'react';
import { Sun, Moon, Settings } from 'lucide-react';
import { getTheme, toggleTheme } from '../../utils/theme';
import { Button } from '../ui/Button';
import { PhaseDots } from './PhaseDots';
import type { Phase } from './types';

const APP_ICON_SRC = `${import.meta.env.BASE_URL}app-icons/noclense-icon-lens-trace.svg`;

interface PhaseHeaderProps {
  phase: Phase;
  onPhaseChange: (phase: Phase) => void;
  ticketId?: string;
  priorityLabel?: string;
  statusLabel?: string;
  onSettingsClick?: () => void;
}

export function PhaseHeader({
  phase,
  onPhaseChange,
  ticketId,
  priorityLabel,
  statusLabel,
  onSettingsClick,
}: PhaseHeaderProps) {
  const [theme, setThemeState] = useState(getTheme);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    setThemeState(getTheme());
  }, []);

  return (
    <header
      className="relative h-[var(--header-height)] shrink-0 border-b border-[var(--border)]"
      style={{ backgroundImage: 'var(--header-surface)' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'var(--header-highlight)' }}
      />
      <div className="relative flex h-full items-center px-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-[var(--foreground)]">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] shadow-[var(--shadow-sm)]">
            <img
              src={APP_ICON_SRC}
              alt="NocLense icon"
              className="h-[18px] w-[18px] shrink-0 rounded-[4px]"
            />
          </div>
          <span className="leading-none">NocLense</span>
        </div>

        {/* Center: Ticket context (investigate + submit only) */}
        {ticketId && phase !== 'import' && (
          <div className="ml-6 flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--muted-foreground)]">#{ticketId}</span>
            {priorityLabel && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--destructive)]/12 text-[var(--destructive)] border border-[var(--destructive)]/20">
                {priorityLabel}
              </span>
            )}
            {statusLabel && (
              <span className="text-[10px] text-[var(--muted-foreground)]">{statusLabel}</span>
            )}
          </div>
        )}

        {/* Right: Phase dots + controls */}
        <div className="ml-auto flex items-center gap-3">
          <PhaseDots current={phase} onNavigate={onPhaseChange} />

          <div className="w-px h-5 bg-[var(--border)]" />

          <Button
            variant="icon"
            size="sm"
            onClick={handleThemeToggle}
            aria-label="Toggle theme"
            className="border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] text-[var(--foreground)] hover:bg-[var(--button-subtle-hover)]"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </Button>

          {onSettingsClick && (
            <Button
              variant="icon"
              size="sm"
              onClick={onSettingsClick}
              aria-label="Settings"
              className="border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] text-[var(--foreground)] hover:bg-[var(--button-subtle-hover)]"
            >
              <Settings size={14} />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npx vitest run src/components/workspace/__tests__/PhaseHeader.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/PhaseHeader.tsx src/components/workspace/__tests__/PhaseHeader.test.tsx
git commit -m "feat(workspace): add PhaseHeader with ticket context and phase dots"
```

---

### Task 5: WorkspaceCard Component

**Files:**
- Create: `src/components/workspace/WorkspaceCard.tsx`
- Create: `src/components/workspace/__tests__/WorkspaceCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/workspace/__tests__/WorkspaceCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceCard } from '../WorkspaceCard';

describe('WorkspaceCard', () => {
  it('renders title and children', () => {
    render(
      <WorkspaceCard id="test" title="Test Card" icon={<span data-testid="icon">T</span>} accentColor="#76ce40">
        <p>Card content</p>
      </WorkspaceCard>
    );
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Card content')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders meta and badge in header', () => {
    render(
      <WorkspaceCard
        id="test"
        title="AI"
        icon={<span>A</span>}
        accentColor="#76ce40"
        meta={<span>5,000 logs</span>}
        badge={<span>Unleashed</span>}
      >
        Content
      </WorkspaceCard>
    );
    expect(screen.getByText('5,000 logs')).toBeInTheDocument();
    expect(screen.getByText('Unleashed')).toBeInTheDocument();
  });

  it('starts expanded by default', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40">
        <p>Visible content</p>
      </WorkspaceCard>
    );
    expect(screen.getByText('Visible content')).toBeVisible();
  });

  it('collapses on double-click of header', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40">
        <p>Content to hide</p>
      </WorkspaceCard>
    );
    const header = screen.getByText('Card').closest('[data-card-header]')!;
    fireEvent.doubleClick(header);
    // After collapse, the body should be hidden via overflow + height
    const body = screen.getByText('Content to hide').closest('[data-card-body]')!;
    expect(body.style.height).toBe('0px');
  });

  it('calls onExpandChange when toggled', () => {
    const onExpandChange = vi.fn();
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40" onExpandChange={onExpandChange}>
        Content
      </WorkspaceCard>
    );
    const header = screen.getByText('Card').closest('[data-card-header]')!;
    fireEvent.doubleClick(header);
    expect(onExpandChange).toHaveBeenCalledWith(false);
  });

  it('respects defaultExpanded=false', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40" defaultExpanded={false}>
        <p>Hidden content</p>
      </WorkspaceCard>
    );
    const body = screen.getByText('Hidden content').closest('[data-card-body]')!;
    expect(body.style.height).toBe('0px');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npx vitest run src/components/workspace/__tests__/WorkspaceCard.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement WorkspaceCard**

```typescript
// src/components/workspace/WorkspaceCard.tsx
import { useState, useCallback, type ReactNode } from 'react';
import { clsx } from 'clsx';

interface WorkspaceCardProps {
  id: string;
  title: string;
  icon: ReactNode;
  accentColor: string;
  meta?: ReactNode;
  badge?: ReactNode;
  defaultExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function WorkspaceCard({
  id,
  title,
  icon,
  accentColor,
  meta,
  badge,
  defaultExpanded = true,
  onExpandChange,
  children,
  className,
}: WorkspaceCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleDoubleClick = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  }, [expanded, onExpandChange]);

  return (
    <div
      data-card-id={id}
      className={clsx(
        'flex flex-col overflow-hidden transition-all',
        'rounded-[var(--card-radius)] border bg-[var(--card)]',
        expanded ? 'border-[var(--card-border)]' : 'border-[var(--card-border)]',
        className,
      )}
      style={{
        transitionDuration: 'var(--card-expand-duration)',
        transitionTimingFunction: 'var(--room-transition-ease)',
      }}
    >
      {/* Header */}
      <div
        data-card-header
        onDoubleClick={handleDoubleClick}
        className={clsx(
          'flex items-center gap-2 px-3.5 shrink-0 cursor-pointer select-none',
          'border-b transition-colors',
          expanded ? 'border-[var(--card-border)]' : 'border-transparent',
          'hover:border-[var(--card-border-hover)]',
        )}
        style={{ height: expanded ? 'var(--card-header-height)' : 'var(--card-collapsed-height)' }}
      >
        <span
          className="block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span className="flex items-center gap-2 shrink-0">{icon}</span>
        <span className="text-[11px] font-semibold text-[var(--foreground)] uppercase tracking-[0.5px]">
          {title}
        </span>
        {badge && <span className="ml-1">{badge}</span>}
        {meta && <span className="ml-auto text-[10px] font-mono text-[var(--muted-foreground)]">{meta}</span>}
      </div>

      {/* Body */}
      <div
        data-card-body
        className="overflow-hidden transition-all"
        style={{
          height: expanded ? 'auto' : '0px',
          opacity: expanded ? 1 : 0,
          transitionDuration: 'var(--card-expand-duration)',
          transitionTimingFunction: 'var(--room-transition-ease)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npx vitest run src/components/workspace/__tests__/WorkspaceCard.test.tsx`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/WorkspaceCard.tsx src/components/workspace/__tests__/WorkspaceCard.test.tsx
git commit -m "feat(workspace): add WorkspaceCard with expand/collapse and accent dot"
```

---

### Task 6: WorkspaceGrid Component

**Files:**
- Create: `src/components/workspace/WorkspaceGrid.tsx`

- [ ] **Step 1: Create WorkspaceGrid**

```typescript
// src/components/workspace/WorkspaceGrid.tsx
import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import type { Phase } from './types';

interface WorkspaceGridProps {
  layout: Phase;
  children: ReactNode;
  className?: string;
}

export function WorkspaceGrid({ layout, children, className }: WorkspaceGridProps) {
  return (
    <div
      className={clsx(
        'flex-1 min-h-0 overflow-hidden transition-all',
        layout === 'import' && 'flex items-center justify-center',
        layout === 'investigate' && 'grid gap-2 p-2',
        layout === 'submit' && 'flex items-start justify-center gap-6 p-10',
        className,
      )}
      style={{
        ...(layout === 'import' && { background: 'var(--room-import-glow)' }),
        ...(layout === 'investigate' && {
          gridTemplateColumns: '1fr 1fr 340px',
          gridTemplateRows: 'auto 1fr auto',
          background: 'var(--room-investigate-bg)',
        }),
        ...(layout === 'submit' && { background: 'var(--room-submit-glow)' }),
        transitionDuration: 'var(--room-transition-duration)',
        transitionTimingFunction: 'var(--room-transition-ease)',
      }}
      data-room={layout}
    >
      {children}
    </div>
  );
}

/** CSS class names for card grid positions in the Investigate layout */
export const CARD_GRID_CLASSES: Record<string, string> = {
  'log-stream': 'col-span-2 row-span-2',       // col 1-2, row 1-2
  'ai-assistant': 'col-start-3 row-start-1',    // col 3, row 1
  'evidence': 'col-start-3 row-start-2',        // col 3, row 2
  'similar-tickets': 'col-start-1 row-start-3',  // col 1, row 3
  'correlation-graph': 'col-start-2 row-start-3', // col 2, row 3
  'datadog-live': 'col-start-3 row-start-3',     // col 3, row 3
};
```

- [ ] **Step 2: Verify build**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npm run build 2>&1 | grep -E "error|built"`
Expected: `✓ built in ~4s`

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/WorkspaceGrid.tsx
git commit -m "feat(workspace): add WorkspaceGrid with CSS grid layouts per room"
```

---

### Task 7: RoomRouter Component

**Files:**
- Create: `src/components/workspace/RoomRouter.tsx`

- [ ] **Step 1: Create RoomRouter**

```typescript
// src/components/workspace/RoomRouter.tsx
import { useState, useCallback, useRef, type ReactNode } from 'react';
import { PhaseHeader } from './PhaseHeader';
import { WorkspaceGrid } from './WorkspaceGrid';
import { useAnimeTimeline, type TimelineStep } from '../../utils/anime';
import type { Phase } from './types';

interface RoomRouterProps {
  initialPhase?: Phase;
  ticketId?: string;
  priorityLabel?: string;
  statusLabel?: string;
  onSettingsClick?: () => void;
  importContent: ReactNode;
  investigateContent: ReactNode;
  submitContent: ReactNode;
}

export function RoomRouter({
  initialPhase = 'import',
  ticketId,
  priorityLabel,
  statusLabel,
  onSettingsClick,
  importContent,
  investigateContent,
  submitContent,
}: RoomRouterProps) {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build transition timeline steps (placeholder — Phase 4 will implement the full choreography)
  const transitionSteps: TimelineStep[] = [];
  const { play } = useAnimeTimeline(transitionSteps, [phase]);

  const handlePhaseChange = useCallback((nextPhase: Phase) => {
    setPhase(nextPhase);
    // Phase 4 will trigger play() with the morph timeline here
  }, []);

  const roomContent: Record<Phase, ReactNode> = {
    import: importContent,
    investigate: investigateContent,
    submit: submitContent,
  };

  return (
    <div ref={containerRef} className="flex h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <PhaseHeader
        phase={phase}
        onPhaseChange={handlePhaseChange}
        ticketId={ticketId}
        priorityLabel={priorityLabel}
        statusLabel={statusLabel}
        onSettingsClick={onSettingsClick}
      />
      <WorkspaceGrid layout={phase}>
        {roomContent[phase]}
      </WorkspaceGrid>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npm run build 2>&1 | grep -E "error|built"`
Expected: `✓ built in ~4s`

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/RoomRouter.tsx
git commit -m "feat(workspace): add RoomRouter phase manager with transition hooks"
```

---

### Task 8: Barrel Export + Full Test Run

**Files:**
- Create: `src/components/workspace/index.ts`
- Modify: `src/components/ui/index.ts` (add workspace re-export)

- [ ] **Step 1: Create workspace barrel export**

```typescript
// src/components/workspace/index.ts
export { WorkspaceCard } from './WorkspaceCard';
export { WorkspaceGrid, CARD_GRID_CLASSES } from './WorkspaceGrid';
export { PhaseHeader } from './PhaseHeader';
export { PhaseDots } from './PhaseDots';
export { RoomRouter } from './RoomRouter';
export type { Phase, CardId, CardState } from './types';
export { PHASE_ORDER, PHASE_LABELS } from './types';
```

- [ ] **Step 2: Run full test suite**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npx vitest run`
Expected: All existing 174 tests PASS + 11 new tests (PhaseDots: 6, PhaseHeader: 5, WorkspaceCard: 6) = ~191 total, 0 failures

- [ ] **Step 3: Run full build**

Run: `cd "C:\Users\envelazquez\New folder\NocLense" && npm run build 2>&1 | grep -E "error|built"`
Expected: `✓ built in ~5s`

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/index.ts
git commit -m "feat(workspace): add barrel export for workspace components"
```

---

## Summary

After all 8 tasks, the workspace contains:

| File | Lines | Purpose |
|------|-------|---------|
| `workspace/types.ts` | ~20 | Phase, CardId, CardState types + constants |
| `workspace/PhaseDots.tsx` | ~65 | Animated phase stepper with navigation |
| `workspace/PhaseHeader.tsx` | ~90 | Header bar with logo, ticket context, phase dots, controls |
| `workspace/WorkspaceCard.tsx` | ~85 | Expandable card primitive with accent dot + header |
| `workspace/WorkspaceGrid.tsx` | ~50 | CSS grid layout manager for import/investigate/submit |
| `workspace/RoomRouter.tsx` | ~60 | Top-level phase manager with transition hooks |
| `workspace/index.ts` | ~10 | Barrel export |
| `workspace/__tests__/PhaseDots.test.tsx` | ~55 | 6 tests |
| `workspace/__tests__/PhaseHeader.test.tsx` | ~40 | 5 tests |
| `workspace/__tests__/WorkspaceCard.test.tsx` | ~65 | 6 tests |

**Total:** ~540 lines of new code, 17 new tests, 0 existing code modified (except tokens.css append).

**Nothing in the running app changes.** These components are built, tested, and ready for Phase 2 integration.
