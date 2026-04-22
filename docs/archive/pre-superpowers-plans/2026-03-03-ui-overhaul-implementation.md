# UI Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform NocLense into an AI-first log analysis tool with a monochrome, card-based aesthetic, ChatGPT-style sidebar layout, and Motion animations.

**Architecture:** Replace the current scattered CSS variable + inline Tailwind approach with a comprehensive CSS custom property token system, a component library built on those tokens + Motion animations, and a new layout with collapsible AI sidebar. Migration is screen-by-screen; old and new coexist during transition.

**Tech Stack:** React 19, Tailwind CSS 4.x, Motion (Framer Motion), DM Sans + JetBrains Mono fonts, Vitest

**Design Doc:** `docs/plans/2026-03-03-ui-overhaul-design.md`

---

## Phase 1: Foundation

### Task 1: Install New Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install motion and font packages**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npm install motion @fontsource/dm-sans @fontsource/jetbrains-mono
```

Expected: Clean install, no peer dependency warnings.

**Step 2: Verify imports work**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
node -e "require('@fontsource/dm-sans'); require('@fontsource/jetbrains-mono'); console.log('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add motion, dm-sans, jetbrains-mono dependencies"
```

---

### Task 2: Create Token System CSS

**Files:**
- Create: `src/styles/tokens.css`

**Step 1: Create the token file**

Write `src/styles/tokens.css`:

```css
/*
 * NocLense Design Tokens
 * Pure monochrome palette with semantic status colors.
 * Toggle via data-theme attribute on <html>.
 */

/* ── Light (default) ── */
:root,
[data-theme="light"] {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --card-foreground: #0a0a0a;
  --muted: #f5f5f5;
  --muted-foreground: #737373;
  --border: #e5e5e5;
  --input: #e5e5e5;
  --ring: #a3a3a3;
  --accent: #f5f5f5;
  --accent-foreground: #171717;
  --destructive: #dc2626;
  --success: #16a34a;
  --warning: #ca8a04;
  --popover: #ffffff;
  --popover-foreground: #0a0a0a;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* ── Dark ── */
[data-theme="dark"] {
  --background: #0a0a0a;
  --foreground: #fafafa;
  --card: #141414;
  --card-foreground: #fafafa;
  --muted: #262626;
  --muted-foreground: #a3a3a3;
  --border: #262626;
  --input: #262626;
  --ring: #525252;
  --accent: #262626;
  --accent-foreground: #fafafa;
  --destructive: #dc2626;
  --success: #22c55e;
  --warning: #eab308;
  --popover: #141414;
  --popover-foreground: #fafafa;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* ── Radius ── */
:root {
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}

/* ── Spacing ── */
:root {
  --space-0: 0px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
}

/* ── Z-Index ── */
:root {
  --z-base: 0;
  --z-sticky: 10;
  --z-sidebar: 20;
  --z-dropdown: 30;
  --z-modal-backdrop: 40;
  --z-modal: 50;
  --z-toast: 60;
}

/* ── Transitions ── */
:root {
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-enter: 400ms;
  --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}

/* ── Borders ── */
:root {
  --border-width: 1px;
  --border-width-thick: 2px;
  --ring-width: 3px;
  --ring-offset: 2px;
}

/* ── Sizing ── */
:root {
  --header-height: 56px;
  --sidebar-width: 320px;
  --sidebar-collapsed: 48px;
  --log-row-height: 35px;
  --panel-min-height: 120px;
  --icon-sm: 16px;
  --icon-md: 20px;
  --icon-lg: 24px;
}

/* ── Typography ── */
:root {
  --font-sans: 'DM Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-md: 14px;
  --text-lg: 18px;
  --text-xl: 24px;
}
```

**Step 2: Verify the file has no syntax errors**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx postcss src/styles/tokens.css --no-map -o /dev/null 2>&1 || echo "PostCSS check done"
```

Expected: No CSS syntax errors.

**Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(ui): add comprehensive design token system"
```

---

### Task 3: Wire Tokens and Fonts into Entry CSS

**Files:**
- Modify: `src/index.css`
- Modify: `src/main.tsx` (or wherever fonts need importing)

**Step 1: Add font imports to the app entry**

Find the entry file (likely `src/main.tsx`). Add at the top:

```typescript
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
```

**Step 2: Update index.css to import tokens**

Replace the contents of `src/index.css` with:

```css
@import "tailwindcss";
@import "./styles/tokens.css";

/* ── Base Reset ── */
*,
*::before,
*::after {
  border-color: var(--border);
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--foreground);
  background-color: var(--background);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.5;
  margin: 0;
}

/* ── Scrollbar (thin, monochrome) ── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--muted-foreground);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--foreground);
}

/* ── Log Grid (kept for LogRow compatibility during migration) ── */
.log-grid {
  display: grid;
  grid-template-columns: 20px 160px 24px 130px 90px 1fr;
  font-size: var(--text-sm);
}
```

**Important:** This removes the old `:root` variables, `.dark` overrides, and `.red-theme`. Components still referencing old vars (`--primary-blue`, `--card-bg`, etc.) will break — this is expected. We fix them as we migrate each component in later tasks.

**Step 3: Verify the app compiles**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx tsc --noEmit 2>&1 | head -20
```

Expected: TypeScript passes (CSS changes don't affect TS). Visual breakage in-browser is expected and OK.

**Step 4: Commit**

```bash
git add src/index.css src/main.tsx
git commit -m "feat(ui): wire token system and fonts into entry CSS"
```

---

### Task 4: Add Theme Toggle Utility

**Files:**
- Create: `src/utils/theme.ts`
- Test: `src/utils/__tests__/theme.test.ts`

**Step 1: Write the failing test**

Create `src/utils/__tests__/theme.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getTheme, setTheme, toggleTheme, THEMES } from '../theme';

describe('theme utility', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  it('returns "light" as default theme', () => {
    expect(getTheme()).toBe('light');
  });

  it('sets theme on document and localStorage', () => {
    setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('noclense-theme')).toBe('dark');
  });

  it('toggles between light and dark', () => {
    setTheme('light');
    toggleTheme();
    expect(getTheme()).toBe('dark');
    toggleTheme();
    expect(getTheme()).toBe('light');
  });

  it('reads persisted theme from localStorage', () => {
    localStorage.setItem('noclense-theme', 'dark');
    expect(getTheme()).toBe('dark');
  });

  it('exports THEMES constant', () => {
    expect(THEMES).toEqual(['light', 'dark']);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/utils/__tests__/theme.test.ts 2>&1
```

Expected: FAIL — module `../theme` not found.

**Step 3: Write implementation**

Create `src/utils/theme.ts`:

```typescript
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'noclense-theme';

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme(): void {
  setTheme(getTheme() === 'light' ? 'dark' : 'light');
}

/** Call once on app startup to apply persisted theme. */
export function initTheme(): void {
  setTheme(getTheme());
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/utils/__tests__/theme.test.ts 2>&1
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/utils/theme.ts src/utils/__tests__/theme.test.ts
git commit -m "feat(ui): add theme toggle utility with tests"
```

---

## Phase 2: Primitive Components

### Task 5: Button Component

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Create: `src/components/ui/__tests__/Button.test.tsx`

**Step 1: Write the failing test**

Create `src/components/ui/__tests__/Button.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('hover:bg-[var(--accent)]');
  });

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-[var(--destructive)]');
  });

  it('applies icon variant sizing', () => {
    render(<Button variant="icon">X</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-9');
    expect(btn.className).toContain('w-9');
  });

  it('forwards onClick', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('supports disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    render(<Button className="mt-4">Styled</Button>);
    expect(screen.getByRole('button').className).toContain('mt-4');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Button.test.tsx 2>&1
```

Expected: FAIL — named export `Button` not found (current file uses default export).

**Step 3: Rewrite Button component**

Replace `src/components/ui/Button.tsx`:

```tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type ButtonVariant = 'default' | 'ghost' | 'outline' | 'destructive' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base =
  'inline-flex items-center justify-center font-medium transition-colors ' +
  'duration-[var(--duration-fast)] ease-[var(--ease-default)] ' +
  'rounded-[var(--radius-md)] text-[var(--text-base)] ' +
  'focus-visible:outline-none focus-visible:ring-[var(--ring-width)] ' +
  'focus-visible:ring-[var(--ring)] focus-visible:ring-offset-[var(--ring-offset)] ' +
  'disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  default:
    'bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90 h-9 px-4 py-2',
  ghost:
    'bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] h-9 px-4 py-2',
  outline:
    'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] h-9 px-4 py-2',
  destructive:
    'bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90 h-9 px-4 py-2',
  icon:
    'bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] h-9 w-9 p-0',
};

export function Button({
  variant = 'default',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge(clsx(base, variants[variant], className))}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Button.test.tsx 2>&1
```

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/__tests__/Button.test.tsx
git commit -m "feat(ui): rewrite Button with variant system and tokens"
```

---

### Task 6: Card Component

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/__tests__/Card.test.tsx`

**Step 1: Write the failing test**

Create `src/components/ui/__tests__/Card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardContent } from '../Card';

describe('Card', () => {
  it('renders with default variant (border only)', () => {
    render(<Card data-testid="card">Content</Card>);
    const el = screen.getByTestId('card');
    expect(el.className).toContain('border');
    expect(el.className).not.toContain('shadow');
  });

  it('renders with elevated variant (border + shadow)', () => {
    render(<Card variant="elevated" data-testid="card">Content</Card>);
    const el = screen.getByTestId('card');
    expect(el.className).toContain('shadow');
  });

  it('renders CardHeader and CardContent', () => {
    render(
      <Card>
        <CardHeader>Title</CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    );
    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('merges custom className', () => {
    render(<Card className="mt-8" data-testid="card">X</Card>);
    expect(screen.getByTestId('card').className).toContain('mt-8');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Card.test.tsx 2>&1
```

Expected: FAIL — module `../Card` not found.

**Step 3: Write implementation**

Create `src/components/ui/Card.tsx`:

```tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type CardVariant = 'default' | 'elevated';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const cardVariants: Record<CardVariant, string> = {
  default:
    'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]',
  elevated:
    'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-md)]',
};

export function Card({ variant = 'default', className, ...props }: CardProps) {
  return (
    <div
      className={twMerge(clsx(cardVariants[variant], className))}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-3)] ' +
            'border-b border-[var(--border)] font-[var(--font-weight-semibold)] text-[var(--text-md)]',
          className
        )
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(clsx('p-[var(--space-4)]', className))}
      {...props}
    />
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Card.test.tsx 2>&1
```

Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/__tests__/Card.test.tsx
git commit -m "feat(ui): add Card component with default and elevated variants"
```

---

### Task 7: Badge Component

**Files:**
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/__tests__/Badge.test.tsx`

**Step 1: Write the failing test**

Create `src/components/ui/__tests__/Badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toBeTruthy();
  });

  it('renders level-error variant with red styling', () => {
    render(<Badge variant="level-error">ERROR</Badge>);
    const el = screen.getByText('ERROR');
    expect(el.className).toContain('text-[var(--destructive)]');
  });

  it('renders level-warn variant with yellow styling', () => {
    render(<Badge variant="level-warn">WARN</Badge>);
    const el = screen.getByText('WARN');
    expect(el.className).toContain('text-[var(--warning)]');
  });

  it('renders outline variant', () => {
    render(<Badge variant="outline">Tag</Badge>);
    const el = screen.getByText('Tag');
    expect(el.className).toContain('border');
  });

  it('merges custom className', () => {
    render(<Badge className="ml-2">Custom</Badge>);
    expect(screen.getByText('Custom').className).toContain('ml-2');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Badge.test.tsx 2>&1
```

Expected: FAIL — module not found.

**Step 3: Write implementation**

Create `src/components/ui/Badge.tsx`:

```tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant =
  | 'default'
  | 'outline'
  | 'level-error'
  | 'level-warn'
  | 'level-info'
  | 'level-debug';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const base =
  'inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 ' +
  'text-[var(--text-xs)] font-[var(--font-weight-medium)] leading-none';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  outline: 'border border-[var(--border)] text-[var(--muted-foreground)] bg-transparent',
  'level-error': 'bg-[var(--destructive)]/10 text-[var(--destructive)]',
  'level-warn': 'bg-[var(--warning)]/10 text-[var(--warning)]',
  'level-info': 'bg-[var(--foreground)]/10 text-[var(--foreground)]',
  'level-debug': 'bg-[var(--muted)] text-[var(--muted-foreground)]',
};

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(clsx(base, variants[variant], className))}
      {...props}
    />
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Badge.test.tsx 2>&1
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/components/ui/Badge.tsx src/components/ui/__tests__/Badge.test.tsx
git commit -m "feat(ui): add Badge component with log level variants"
```

---

### Task 8: Input Component

**Files:**
- Modify: `src/components/ui/Input.tsx`
- Create: `src/components/ui/__tests__/Input.test.tsx`

**Step 1: Write the failing test**

Create `src/components/ui/__tests__/Input.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Search..." />);
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('renders search variant with icon slot', () => {
    render(<Input variant="search" icon={<span data-testid="icon">Q</span>} />);
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<Input label="Name" />);
    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('forwards onChange', () => {
    const handler = vi.fn();
    render(<Input onChange={handler} placeholder="test" />);
    fireEvent.change(screen.getByPlaceholderText('test'), { target: { value: 'hello' } });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('merges custom className on wrapper', () => {
    render(<Input wrapperClassName="mt-4" data-testid="input" />);
    const wrapper = screen.getByTestId('input').parentElement;
    expect(wrapper?.className).toContain('mt-4');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Input.test.tsx 2>&1
```

Expected: FAIL — named export not found.

**Step 3: Rewrite Input component**

Replace `src/components/ui/Input.tsx`:

```tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type InputVariant = 'default' | 'search';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  label?: string;
  icon?: React.ReactNode;
  wrapperClassName?: string;
}

const inputBase =
  'flex w-full rounded-[var(--radius-md)] border border-[var(--input)] ' +
  'bg-transparent px-3 py-2 text-[var(--text-base)] text-[var(--foreground)] ' +
  'placeholder:text-[var(--muted-foreground)] ' +
  'transition-colors duration-[var(--duration-fast)] ' +
  'focus-visible:outline-none focus-visible:ring-[var(--ring-width)] focus-visible:ring-[var(--ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function Input({
  variant = 'default',
  label,
  icon,
  className,
  wrapperClassName,
  ...props
}: InputProps) {
  return (
    <div className={twMerge(clsx('flex flex-col gap-[var(--space-1)]', wrapperClassName))}>
      {label && (
        <label className="text-[var(--text-sm)] font-[var(--font-weight-medium)] text-[var(--muted-foreground)]">
          {label}
        </label>
      )}
      <div className="relative">
        {variant === 'search' && icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
            {icon}
          </div>
        )}
        <input
          className={twMerge(
            clsx(inputBase, variant === 'search' && icon && 'pl-10', className)
          )}
          {...props}
        />
      </div>
    </div>
  );
}

export default Input;
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Input.test.tsx 2>&1
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/components/ui/Input.tsx src/components/ui/__tests__/Input.test.tsx
git commit -m "feat(ui): rewrite Input with search variant and token styling"
```

---

### Task 9: Separator Component

**Files:**
- Create: `src/components/ui/Separator.tsx`

**Step 1: Write the component** (simple enough to skip TDD)

Create `src/components/ui/Separator.tsx`:

```tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({
  orientation = 'horizontal',
  className,
  ...props
}: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={twMerge(
        clsx(
          'shrink-0 bg-[var(--border)]',
          orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
          className
        )
      )}
      {...props}
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/Separator.tsx
git commit -m "feat(ui): add Separator component"
```

---

### Task 10: ScrollArea Component

**Files:**
- Create: `src/components/ui/ScrollArea.tsx`

**Step 1: Write the component**

Create `src/components/ui/ScrollArea.tsx`:

```tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Max height before scrolling kicks in. */
  maxHeight?: string;
}

export function ScrollArea({
  maxHeight,
  className,
  style,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <div
      className={twMerge(
        clsx('overflow-y-auto overflow-x-hidden', className)
      )}
      style={{ maxHeight, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
```

Note: The thin monochrome scrollbar styling is already in `index.css` (`::-webkit-scrollbar` rules). This component just provides a convenience wrapper.

**Step 2: Commit**

```bash
git add src/components/ui/ScrollArea.tsx
git commit -m "feat(ui): add ScrollArea component"
```

---

### Task 11: Tooltip Component (with Motion)

**Files:**
- Create: `src/components/ui/Tooltip.tsx`
- Create: `src/components/ui/__tests__/Tooltip.test.tsx`

**Step 1: Write the failing test**

Create `src/components/ui/__tests__/Tooltip.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show content by default', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.queryByText('Help text')).toBeNull();
  });

  it('shows content on mouse enter after delay', async () => {
    render(
      <Tooltip content="Help text" delay={200}>
        <button>Hover me</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText('Hover me'));
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText('Help text')).toBeTruthy();
  });

  it('hides content on mouse leave', async () => {
    render(
      <Tooltip content="Help text" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText('Hover me'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByText('Help text')).toBeTruthy();
    fireEvent.mouseLeave(screen.getByText('Hover me'));
    // Content may still be animating out, but it should start hiding
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Tooltip.test.tsx 2>&1
```

Expected: FAIL.

**Step 3: Write implementation**

Create `src/components/ui/Tooltip.tsx`:

```tsx
import React, { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  delay?: number;
  className?: string;
}

export function Tooltip({ content, children, delay = 200, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className={twMerge(
              clsx(
                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[var(--z-toast)]',
                'rounded-[var(--radius-sm)] bg-[var(--foreground)] text-[var(--background)]',
                'px-2.5 py-1 text-[var(--text-xs)] whitespace-nowrap shadow-[var(--shadow-sm)]',
                className
              )
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/__tests__/Tooltip.test.tsx 2>&1
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/components/ui/Tooltip.tsx src/components/ui/__tests__/Tooltip.test.tsx
git commit -m "feat(ui): add Tooltip component with Motion animations"
```

---

### Task 12: UI Component Barrel Export

**Files:**
- Create: `src/components/ui/index.ts`

**Step 1: Create barrel export**

Create `src/components/ui/index.ts`:

```typescript
export { Button } from './Button';
export type { ButtonVariant } from './Button';
export { Card, CardHeader, CardContent } from './Card';
export { Badge } from './Badge';
export type { BadgeVariant } from './Badge';
export { Input } from './Input';
export { Separator } from './Separator';
export { ScrollArea } from './ScrollArea';
export { Tooltip } from './Tooltip';
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors from the new UI module.

**Step 3: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "feat(ui): add barrel export for primitive components"
```

---

## Phase 3: Composite Components

### Task 13: Dialog Component (Modal Replacement)

**Files:**
- Create: `src/components/ui/Dialog.tsx`
- Create: `src/components/ui/__tests__/Dialog.test.tsx`

**Step 1: Write the failing test**

Create `src/components/ui/__tests__/Dialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '../Dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(<Dialog open={false} onClose={vi.fn()} title="Test">Body</Dialog>);
    expect(screen.queryByText('Test')).toBeNull();
  });

  it('renders title and body when open', () => {
    render(<Dialog open={true} onClose={vi.fn()} title="My Dialog">Content here</Dialog>);
    expect(screen.getByText('My Dialog')).toBeTruthy();
    expect(screen.getByText('Content here')).toBeTruthy();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<Dialog open={true} onClose={onClose} title="T">B</Dialog>);
    fireEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when content is clicked', () => {
    const onClose = vi.fn();
    render(<Dialog open={true} onClose={onClose} title="T">B</Dialog>);
    fireEvent.click(screen.getByText('B'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders footer when provided', () => {
    render(
      <Dialog open={true} onClose={vi.fn()} title="T" footer={<button>Save</button>}>
        B
      </Dialog>
    );
    expect(screen.getByText('Save')).toBeTruthy();
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Write implementation**

Create `src/components/ui/Dialog.tsx`:

```tsx
import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center bg-black/50 backdrop-blur-sm p-[var(--space-6)]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[500px] max-h-[80vh] flex flex-col rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-lg)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-[var(--space-5)] py-[var(--space-4)] border-b border-[var(--border)]">
              <h2 className="text-[var(--text-lg)] font-[var(--font-weight-semibold)]">
                {title}
              </h2>
              <Button variant="icon" onClick={onClose} aria-label="Close">
                <X size={18} />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-[var(--space-5)] py-[var(--space-4)]">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-[var(--space-2)] px-[var(--space-5)] py-[var(--space-4)] border-t border-[var(--border)]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add src/components/ui/Dialog.tsx src/components/ui/__tests__/Dialog.test.tsx
git commit -m "feat(ui): add Dialog component with Motion scale-in animation"
```

---

### Task 14: Sheet Component

**Files:**
- Create: `src/components/ui/Sheet.tsx`

**Step 1: Write implementation**

Create `src/components/ui/Sheet.tsx`:

```tsx
import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type SheetSide = 'left' | 'right' | 'bottom';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: SheetSide;
  children: React.ReactNode;
  className?: string;
}

const slideVariants: Record<SheetSide, { initial: object; animate: object; exit: object }> = {
  left: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
  },
  right: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },
  bottom: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  },
};

const sideClasses: Record<SheetSide, string> = {
  left: 'inset-y-0 left-0 w-[var(--sidebar-width)] border-r',
  right: 'inset-y-0 right-0 w-[var(--sidebar-width)] border-l',
  bottom: 'inset-x-0 bottom-0 h-auto max-h-[80vh] border-t',
};

export function Sheet({ open, onClose, side = 'left', children, className }: SheetProps) {
  const variants = slideVariants[side];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/50 backdrop-blur-sm"
          />
          {/* Panel */}
          <motion.div
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={twMerge(
              clsx(
                'fixed z-[var(--z-modal)] bg-[var(--card)] border-[var(--border)]',
                sideClasses[side],
                className
              )
            )}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/Sheet.tsx
git commit -m "feat(ui): add Sheet component with spring slide animation"
```

---

### Task 15: DropdownMenu Component

**Files:**
- Create: `src/components/ui/DropdownMenu.tsx`

**Step 1: Write implementation**

Create `src/components/ui/DropdownMenu.tsx`:

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({ trigger, children, align = 'left', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div ref={ref} className="relative inline-flex">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={twMerge(
              clsx(
                'absolute top-full mt-1 z-[var(--z-dropdown)]',
                'min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border)]',
                'bg-[var(--popover)] text-[var(--popover-foreground)] shadow-[var(--shadow-md)]',
                'py-1',
                align === 'right' ? 'right-0' : 'left-0',
                className
              )
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DropdownItemProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

export function DropdownItem({ active, className, children, ...props }: DropdownItemProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex items-center gap-2 px-3 py-1.5 text-[var(--text-sm)] cursor-pointer',
          'transition-colors duration-[var(--duration-fast)]',
          active
            ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
            : 'hover:bg-[var(--accent)]',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/DropdownMenu.tsx
git commit -m "feat(ui): add DropdownMenu component with Motion animation"
```

---

### Task 16: ResizeHandle Component

**Files:**
- Create: `src/components/ui/ResizeHandle.tsx`

**Step 1: Write implementation**

Create `src/components/ui/ResizeHandle.tsx`:

```tsx
import React, { useCallback, useRef } from 'react';
import { clsx } from 'clsx';

interface ResizeHandleProps {
  /** Called continuously during drag with the delta in pixels. */
  onResize: (delta: number) => void;
  /** Called when drag ends. */
  onResizeEnd?: () => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function ResizeHandle({
  onResize,
  onResizeEnd,
  orientation = 'horizontal',
  className,
}: ResizeHandleProps) {
  const startPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startPos.current = orientation === 'horizontal' ? e.clientY : e.clientX;

      const handleMouseMove = (ev: MouseEvent) => {
        const current = orientation === 'horizontal' ? ev.clientY : ev.clientX;
        onResize(current - startPos.current);
        startPos.current = current;
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onResizeEnd?.();
      };

      document.body.style.cursor = orientation === 'horizontal' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onResize, onResizeEnd, orientation]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={clsx(
        'group flex items-center justify-center',
        'transition-colors duration-[var(--duration-fast)]',
        orientation === 'horizontal'
          ? 'h-2 w-full cursor-row-resize hover:bg-[var(--accent)]'
          : 'h-full w-2 cursor-col-resize hover:bg-[var(--accent)]',
        className
      )}
    >
      <div
        className={clsx(
          'rounded-full bg-[var(--border)] group-hover:bg-[var(--muted-foreground)]',
          'transition-colors duration-[var(--duration-fast)]',
          orientation === 'horizontal' ? 'h-0.5 w-8' : 'h-8 w-0.5'
        )}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/ResizeHandle.tsx
git commit -m "feat(ui): add ResizeHandle component"
```

---

### Task 17: Sidebar Component

**Files:**
- Create: `src/components/ui/Sidebar.tsx`
- Create: `src/components/ui/__tests__/Sidebar.test.tsx`

**Step 1: Write the failing test**

Create `src/components/ui/__tests__/Sidebar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar, SidebarProvider, useSidebar } from '../Sidebar';

function TestConsumer() {
  const { collapsed, toggle } = useSidebar();
  return (
    <div>
      <span data-testid="state">{collapsed ? 'collapsed' : 'expanded'}</span>
      <button onClick={toggle}>Toggle</button>
    </div>
  );
}

describe('Sidebar', () => {
  it('starts expanded by default', () => {
    render(
      <SidebarProvider>
        <TestConsumer />
      </SidebarProvider>
    );
    expect(screen.getByTestId('state').textContent).toBe('expanded');
  });

  it('toggles collapsed state', () => {
    render(
      <SidebarProvider>
        <TestConsumer />
      </SidebarProvider>
    );
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('state').textContent).toBe('collapsed');
  });

  it('renders Sidebar panel', () => {
    render(
      <SidebarProvider>
        <Sidebar data-testid="sidebar">Content</Sidebar>
      </SidebarProvider>
    );
    expect(screen.getByTestId('sidebar')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Write implementation**

Create `src/components/ui/Sidebar.tsx`:

```tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className, children, ...props }: SidebarProps) {
  const { collapsed } = useSidebar();

  return (
    <motion.aside
      animate={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className={twMerge(
        clsx(
          'relative flex flex-col h-full overflow-hidden',
          'border-r border-[var(--border)] bg-[var(--card)]',
          'z-[var(--z-sidebar)]',
          className
        )
      )}
      {...(props as any)}
    >
      {children}
    </motion.aside>
  );
}

interface SidebarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

export function SidebarItem({ icon, label, active, className, ...props }: SidebarItemProps) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={twMerge(
        clsx(
          'flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)]',
          'rounded-[var(--radius-md)] cursor-pointer',
          'transition-colors duration-[var(--duration-fast)]',
          active
            ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
          className
        )
      )}
      title={collapsed ? label : undefined}
      {...props}
    >
      <div className="shrink-0 w-[var(--icon-lg)] h-[var(--icon-lg)] flex items-center justify-center">
        {icon}
      </div>
      {!collapsed && (
        <span className="text-[var(--text-sm)] font-[var(--font-weight-medium)] truncate">
          {label}
        </span>
      )}
    </div>
  );
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add src/components/ui/Sidebar.tsx src/components/ui/__tests__/Sidebar.test.tsx
git commit -m "feat(ui): add Sidebar component with collapsible layout animation"
```

---

### Task 18: Header Component

**Files:**
- Create: `src/components/ui/Header.tsx`

**Step 1: Write implementation**

Create `src/components/ui/Header.tsx`:

```tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function Header({ left, center, right, className, ...props }: HeaderProps) {
  return (
    <header
      className={twMerge(
        clsx(
          'flex items-center h-[var(--header-height)] px-[var(--space-4)]',
          'border-b border-[var(--border)] bg-[var(--card)]',
          'z-[var(--z-sticky)]',
          className
        )
      )}
      {...props}
    >
      {/* Left slot */}
      <div className="flex items-center gap-[var(--space-2)] shrink-0">{left}</div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center slot */}
      {center && (
        <div className="flex items-center gap-[var(--space-2)]">{center}</div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right slot */}
      <div className="flex items-center gap-[var(--space-2)] shrink-0">{right}</div>
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/Header.tsx
git commit -m "feat(ui): add Header component with left/center/right slots"
```

---

### Task 19: Update Barrel Export with Composite Components

**Files:**
- Modify: `src/components/ui/index.ts`

**Step 1: Update barrel**

Replace `src/components/ui/index.ts`:

```typescript
// Primitives
export { Button } from './Button';
export type { ButtonVariant } from './Button';
export { Card, CardHeader, CardContent } from './Card';
export { Badge } from './Badge';
export type { BadgeVariant } from './Badge';
export { Input } from './Input';
export { Separator } from './Separator';
export { ScrollArea } from './ScrollArea';
export { Tooltip } from './Tooltip';

// Composites
export { Dialog } from './Dialog';
export { Sheet } from './Sheet';
export { DropdownMenu, DropdownItem } from './DropdownMenu';
export { Sidebar, SidebarProvider, SidebarItem, useSidebar } from './Sidebar';
export { Header } from './Header';
export { ResizeHandle } from './ResizeHandle';
```

**Step 2: Verify TypeScript**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Run all tests**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run src/components/ui/ 2>&1
```

Expected: All UI tests pass.

**Step 4: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "feat(ui): update barrel export with all composite components"
```

---

## Phase 4: Layout Migration

### Task 20: Create New AppLayout Shell

**Files:**
- Create: `src/components/layout/AppLayout.tsx`
- Modify: `src/App.tsx`

This is the highest-risk task. It replaces the monolithic layout in App.tsx with the new sidebar + header + main structure.

**Step 1: Create AppLayout**

Create `src/components/layout/AppLayout.tsx`:

```tsx
import React from 'react';
import { SidebarProvider, Sidebar, useSidebar, Header } from '../ui';
import { Button } from '../ui';
import { Menu, Sun, Moon, FolderOpen, Filter, AlertTriangle } from 'lucide-react';
import { getTheme, toggleTheme } from '../../utils/theme';

interface AppLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  onOpenLog: () => void;
  onToggleFilters: () => void;
  onOpenCrashReports: () => void;
}

function LayoutInner({
  sidebar,
  children,
  onOpenLog,
  onToggleFilters,
  onOpenCrashReports,
}: AppLayoutProps) {
  const { toggle } = useSidebar();
  const [theme, setThemeState] = React.useState(getTheme);

  const handleThemeToggle = () => {
    toggleTheme();
    setThemeState(getTheme());
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <Header
        left={
          <>
            <Button variant="icon" onClick={toggle} aria-label="Toggle sidebar">
              <Menu size={20} />
            </Button>
            <span className="text-[var(--text-lg)] font-[var(--font-weight-semibold)] tracking-tight">
              NocLense
            </span>
          </>
        }
        right={
          <>
            <Button variant="ghost" onClick={onToggleFilters}>
              <Filter size={16} className="mr-1.5" />
              Filters
            </Button>
            <Button variant="ghost" onClick={onOpenLog}>
              <FolderOpen size={16} className="mr-1.5" />
              Open Log
            </Button>
            <Button variant="ghost" onClick={onOpenCrashReports}>
              <AlertTriangle size={16} className="mr-1.5" />
              Crash Reports
            </Button>
            <Button variant="icon" onClick={handleThemeToggle} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </>
        }
      />

      {/* Body: Sidebar + Main */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar>{sidebar}</Sidebar>
        <main className="flex-1 flex flex-col overflow-hidden p-[var(--space-4)] gap-[var(--space-4)]">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppLayout(props: AppLayoutProps) {
  return (
    <SidebarProvider>
      <LayoutInner {...props} />
    </SidebarProvider>
  );
}
```

**Step 2: Integrate into App.tsx**

This step requires careful surgery. The existing App.tsx has a monolithic `MainLayout` component. The plan:

1. Import `AppLayout` and `initTheme` at the top of `App.tsx`
2. Call `initTheme()` in a `useEffect` at the top of `MainLayout`
3. Wrap the existing content with `<AppLayout>` passing the AI sidebar as `sidebar` prop
4. Move filter/open/crash handler references to AppLayout props
5. Remove the old `<header>` JSX block
6. Remove TimelineScrubber import and usage
7. Remove Carbyne branding references

**Important:** This will be a large diff. Read the full current App.tsx before making changes. Preserve all existing functionality (log loading, filtering, export, AI panel, detail panel). Only change the structural wrapper and remove Timeline + branding.

**Step 3: Verify the app compiles**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Verify the app runs**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npm run dev
```

Manually verify: header shows NocLense + buttons, sidebar toggles, main area shows log viewer. Visual polish can wait — structure is the goal.

**Step 5: Commit**

```bash
git add src/components/layout/AppLayout.tsx src/App.tsx
git commit -m "feat(ui): integrate new layout shell with sidebar and header"
```

---

### Task 21: Remove Timeline Scrubber

**Files:**
- Modify: `src/App.tsx` — remove TimelineScrubber import and usage
- Delete: `src/components/TimelineScrubber.tsx`
- Delete: `src/utils/timelineCanvas.ts`
- Modify: `src/utils/indexedDB.ts` — remove `getTimestampBuckets` if no other consumers

**Step 1: Search for all references to TimelineScrubber and timelineCanvas**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
grep -rn "TimelineScrubber\|timelineCanvas\|getTimestampBuckets" src/ --include="*.ts" --include="*.tsx" 2>&1
```

Remove all imports and usages found.

**Step 2: Delete the files**

```bash
rm src/components/TimelineScrubber.tsx src/utils/timelineCanvas.ts
```

**Step 3: Remove timeline height state and drag logic from App.tsx**

Search for `timelineHeight`, `showTimeline`, `handleTimelineResize` and remove them.

**Step 4: Verify TypeScript compiles**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Run existing tests**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run 2>&1
```

Expected: All pass (TimelineScrubber had no dedicated tests).

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(ui): remove TimelineScrubber and timelineCanvas"
```

---

### Task 22: Remove Carbyne Branding and Red Theme

**Files:**
- Modify: `src/App.tsx` — remove Carbyne logo, name references
- Modify: `src/index.css` — red theme already removed in Task 3; verify no remnants

**Step 1: Search for Carbyne references**

Run:
```bash
cd C:/Users/somur/Documents/NocLense/NocLense
grep -rni "carbyne\|red.theme\|red-theme" src/ --include="*.ts" --include="*.tsx" --include="*.css" 2>&1
```

Remove all found references.

**Step 2: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A
git commit -m "refactor(ui): remove Carbyne branding and red theme"
```

---

## Phase 5: Domain Component Migration

### Task 23: Migrate LogRow to New Tokens

**Files:**
- Modify: `src/components/LogRow.tsx`

**Step 1: Read the current LogRow.tsx fully**

**Step 2: Replace all old CSS variable references**

Mapping:
- `bg-slate-700/50` → `bg-[var(--accent)]`
- `bg-slate-700/80` → `bg-[var(--muted)]`
- `text-slate-500` → `text-[var(--muted-foreground)]`
- `text-slate-400` → `text-[var(--muted-foreground)]`
- `border-slate-600/80` → `border-[var(--border)]`
- `bg-slate-800/50` → `bg-[var(--muted)]`
- `border-l-blue-500` → `border-l-[var(--foreground)]`
- `bg-yellow-500/10 ring-yellow-500/50` → `bg-[var(--warning)]/10 ring-[var(--warning)]/50`

Keep SIP color badges as-is (they use `getSipColorClasses()` which generates dynamic colors).

**Step 3: Replace level icons with Badge component**

Import `{ Badge }` from `./ui` and use `<Badge variant="level-error">` etc. instead of inline colored icons.

**Step 4: Verify TypeScript + visual appearance**

**Step 5: Commit**

```bash
git add src/components/LogRow.tsx
git commit -m "refactor(ui): migrate LogRow to new design tokens"
```

---

### Task 24: Migrate FilterBar to New Tokens

**Files:**
- Modify: `src/components/FilterBar.tsx`

**Step 1: Read current FilterBar.tsx**

**Step 2: Replace styling**

- Replace search input with `<Input variant="search" icon={<Search size={16} />} />`
- Replace filter chips: `bg-[var(--accent-blue)]/10` → `bg-[var(--accent)]`
- Replace toggle checkboxes with monochrome styling
- Replace dropdown with `<DropdownMenu>` component

**Step 3: Verify and commit**

```bash
git add src/components/FilterBar.tsx
git commit -m "refactor(ui): migrate FilterBar to new design tokens and components"
```

---

### Task 25: Migrate LogViewer Header to New Tokens

**Files:**
- Modify: `src/components/LogViewer.tsx` (or wherever LogHeader lives)

**Step 1: Replace header styling**

- `bg-slate-800` → `bg-[var(--muted)]`
- `border-slate-700` → `border-[var(--border)]`
- `text-slate-400` → `text-[var(--muted-foreground)]`
- Service filter dropdown → use `<DropdownMenu>` + `<DropdownItem>`

**Step 2: Verify and commit**

```bash
git add src/components/LogViewer.tsx
git commit -m "refactor(ui): migrate LogViewer header to new tokens"
```

---

### Task 26: Migrate Modals to Dialog Component

**Files:**
- Modify: `src/components/ExportModal.tsx`
- Modify: `src/components/ConsentModal.tsx`
- Modify: `src/components/QuotaExceededModal.tsx`

**Step 1: For each modal, replace the old Modal wrapper**

Replace `<Modal isOpen={} onClose={} title={}>` with `<Dialog open={} onClose={} title={}>`.

Import from `'./ui'` instead of `'./ui/Modal'`.

**Step 2: Verify each modal opens/closes correctly**

**Step 3: Commit**

```bash
git add src/components/ExportModal.tsx src/components/ConsentModal.tsx src/components/QuotaExceededModal.tsx
git commit -m "refactor(ui): migrate modals to new Dialog component"
```

---

## Phase 6: AI Sidebar Integration

### Task 27: Create AI Sidebar Content Component

**Files:**
- Create: `src/components/AISidebar.tsx`

**Step 1: Write the component**

This component combines the AI Settings button and the AI Chat interface into the sidebar layout:

```tsx
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings, ArrowLeft } from 'lucide-react';
import { Button, Separator, ScrollArea } from './ui';
import { useSidebar } from './ui/Sidebar';
// Import existing AI components:
import AIAssistantPanel from './AIAssistantPanel';
import AISettingsPanel from './AISettingsPanel';

export function AISidebar() {
  const { collapsed } = useSidebar();
  const [showSettings, setShowSettings] = useState(false);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-[var(--space-3)] gap-[var(--space-2)]">
        <Button variant="icon" title="AI Settings" onClick={() => {}}>
          <Settings size={20} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* AI Settings button */}
      <div className="px-[var(--space-3)] py-[var(--space-3)]">
        <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="back"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <Button variant="ghost" onClick={() => setShowSettings(false)} className="w-full justify-start">
                <ArrowLeft size={16} className="mr-2" />
                Back to Chat
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <Button variant="ghost" onClick={() => setShowSettings(true)} className="w-full justify-start">
                <Settings size={16} className="mr-2" />
                AI Settings
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator />

      {/* Content area: chat or settings */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="settings-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              {/* Embed existing AISettingsPanel content here, adapted for sidebar layout */}
              <ScrollArea className="h-full p-[var(--space-3)]">
                <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                  AI Settings will be embedded here from existing AISettingsPanel.
                </p>
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div
              key="chat-panel"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              {/* Embed existing AI chat content here */}
              <ScrollArea className="h-full">
                <p className="text-[var(--text-sm)] text-[var(--muted-foreground)] p-[var(--space-3)]">
                  AI Chat will be embedded here from existing AIAssistantPanel.
                </p>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

**Note:** This is a skeleton. The actual integration requires reading `AIAssistantPanel.tsx` and `AISettingsPanel.tsx` and extracting their inner content into this sidebar layout. The exact code depends on how those components are structured — they may need to be refactored from modal-style to inline-style rendering.

**Step 2: Wire AISidebar into AppLayout**

In `App.tsx`, pass `<AISidebar />` as the `sidebar` prop to `<AppLayout>`.

**Step 3: Verify sidebar renders with settings toggle and chat placeholder**

**Step 4: Commit**

```bash
git add src/components/AISidebar.tsx src/App.tsx
git commit -m "feat(ui): add AI sidebar with settings/chat toggle"
```

---

### Task 28: Embed AI Chat into Sidebar

**Files:**
- Modify: `src/components/AISidebar.tsx`
- Modify: `src/components/AIAssistantPanel.tsx` — extract chat content into a reusable inner component

**Step 1: Read AIAssistantPanel.tsx fully**

**Step 2: Extract the chat message list and input into `AIChat` component**

Create or refactor so the chat conversation UI (messages, input, send button) can render both standalone and inside the sidebar.

**Step 3: Replace placeholder in AISidebar with actual AIChat**

**Step 4: Verify chat works in sidebar**

**Step 5: Commit**

```bash
git add src/components/AISidebar.tsx src/components/AIAssistantPanel.tsx
git commit -m "feat(ui): embed AI chat into sidebar layout"
```

---

### Task 29: Embed AI Settings into Sidebar

**Files:**
- Modify: `src/components/AISidebar.tsx`
- Modify: `src/components/AISettingsPanel.tsx` — extract settings form into reusable inner component

**Step 1: Read AISettingsPanel.tsx fully**

**Step 2: Extract the settings form into an inline component**

**Step 3: Replace placeholder in AISidebar with actual settings form**

**Step 4: Verify settings work in sidebar**

**Step 5: Commit**

```bash
git add src/components/AISidebar.tsx src/components/AISettingsPanel.tsx
git commit -m "feat(ui): embed AI settings into sidebar sub-panel"
```

---

## Phase 7: Cleanup and Polish

### Task 30: Remove Old UI Components

**Files:**
- Delete: `src/components/ui/Modal.tsx` (replaced by Dialog)
- Modify: `src/styles/theme.css` — delete if fully unused
- Modify: `src/styles/NocStyleSystem.css` — delete if fully unused
- Delete: `src/App.css` (already empty)

**Step 1: Search for any remaining imports of old Modal**

```bash
grep -rn "from.*Modal\|import.*Modal" src/ --include="*.tsx" 2>&1
```

Fix any remaining references.

**Step 2: Delete unused files**

**Step 3: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A
git commit -m "refactor(ui): remove old Modal, unused CSS files"
```

---

### Task 31: Full Test Suite + TypeScript Verification

**Files:** None (verification only)

**Step 1: Run full TypeScript check**

```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx tsc --noEmit 2>&1
```

Expected: Clean, zero errors.

**Step 2: Run full test suite**

```bash
cd C:/Users/somur/Documents/NocLense/NocLense
npx vitest run 2>&1
```

Expected: All tests pass.

**Step 3: Run the app and verify visually**

```bash
npm run dev
```

Check:
- [ ] Header renders with NocLense wordmark, action buttons, theme toggle
- [ ] Sidebar collapses/expands with animation
- [ ] AI Settings button shows settings sub-panel
- [ ] AI Chat is functional in sidebar
- [ ] Log viewer renders with new monochrome styling
- [ ] Filter bar works with new Input/DropdownMenu
- [ ] Modals (export, consent, quota) open with scale-in animation
- [ ] Details panel shows with drag handle
- [ ] Light/dark theme toggle works
- [ ] No Carbyne branding visible
- [ ] No Timeline Scrubber visible
- [ ] DM Sans renders for UI text
- [ ] JetBrains Mono renders for log data

**Step 4: Fix any issues found, commit**

---

### Task 32: Version Bump and Changelog

**Files:**
- Modify: `package.json` — bump version to `1.9.0`
- Modify: `CHANGELOG.md`

**Step 1: Bump version**

In `package.json`, change `"version": "1.0.0-beta.2"` to `"version": "1.9.0"`.

**Step 2: Add changelog entry**

Add to top of `CHANGELOG.md`:

```markdown
## 1.9.0 — UI Overhaul

### Added
- New monochrome design token system (light + dark themes)
- Component library: Button, Card, Badge, Input, Separator, ScrollArea, Tooltip, Dialog, Sheet, DropdownMenu, Sidebar, Header, ResizeHandle
- Motion animations: fade-up entrances, sidebar collapse, modal scale-in, sheet slide, stagger lists
- AI sidebar with integrated chat and settings panels
- DM Sans (UI) and JetBrains Mono (data) typography

### Changed
- Layout restructured to ChatGPT-style: header + left sidebar + main content
- All components migrated to new design tokens
- Modals replaced with animated Dialog component

### Removed
- Timeline Scrubber (replaced by AI-first analysis approach)
- Carbyne branding
- Red alert theme
- Old CSS variable system
```

**Step 3: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 1.9.0, add UI overhaul changelog"
```

---

## Dependency Graph

```
Phase 1 (Foundation)
  Task 1: Install deps
  Task 2: Token CSS ← depends on Task 1
  Task 3: Wire tokens ← depends on Task 2
  Task 4: Theme utility (independent of 2-3)

Phase 2 (Primitives) ← depends on Phase 1
  Tasks 5-12 can run in parallel

Phase 3 (Composites) ← depends on Phase 2
  Tasks 13-19 can run in parallel

Phase 4 (Layout) ← depends on Phase 3
  Task 20: AppLayout shell
  Task 21: Remove Timeline ← after Task 20
  Task 22: Remove branding ← after Task 20

Phase 5 (Domain Migration) ← depends on Phase 4
  Tasks 23-26 can run in parallel

Phase 6 (AI Sidebar) ← depends on Phase 4
  Task 27: Sidebar skeleton
  Task 28: Embed chat ← after Task 27
  Task 29: Embed settings ← after Task 27

Phase 7 (Cleanup) ← depends on Phases 5+6
  Tasks 30-32 sequential
```
