# NocLense UI Overhaul Design

**Date:** 2026-03-03
**Status:** Approved
**Approach:** Component Library + Motion (Approach C)

## Vision

Transform NocLense from a utility-first log viewer into an AI-first analysis tool with a monochrome, card-based aesthetic inspired by Tinte/ChatGPT. The AI analysis tooling and prompts move to the forefront via a persistent left sidebar, while maintaining full log analysis functionality.

## Reference

- Layout inspiration: https://www.tinte.dev/workbench/chatgpt (ChatGPT-style left sidebar + card layout)
- Pure monochrome palette, geometric sans typography, clean animations

## Decisions

| Decision | Choice |
|----------|--------|
| Themes | Light + Dark only (red theme removed) |
| Color personality | Pure monochrome (no brand accent) |
| Typography | DM Sans (UI) + JetBrains Mono (data) |
| Animation library | Motion (formerly Framer Motion) |
| Approach | Component library with CSS custom property tokens |
| Timeline Scrubber | Removed (performance + AI-first direction) |
| Carbyne branding | Removed |

---

## Token System

### Color Tokens — Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#ffffff` | Page background |
| `--foreground` | `#0a0a0a` | Primary text |
| `--card` | `#ffffff` | Card/panel surfaces |
| `--card-foreground` | `#0a0a0a` | Text on cards |
| `--muted` | `#f5f5f5` | Subdued backgrounds |
| `--muted-foreground` | `#737373` | Secondary text, timestamps |
| `--border` | `#e5e5e5` | All borders |
| `--input` | `#e5e5e5` | Input field borders/backgrounds |
| `--ring` | `#a3a3a3` | Focus rings |
| `--accent` | `#f5f5f5` | Hover backgrounds, active states |
| `--accent-foreground` | `#171717` | Text on accent backgrounds |
| `--destructive` | `#dc2626` | Error states, ERROR log level |
| `--success` | `#16a34a` | OK states |
| `--warning` | `#ca8a04` | WARN log level |
| `--popover` | `#ffffff` | Dropdown/tooltip backgrounds |
| `--popover-foreground` | `#0a0a0a` | Popover text |

### Color Tokens — Dark Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0a0a0a` | Page background |
| `--foreground` | `#fafafa` | Primary text |
| `--card` | `#141414` | Card/panel surfaces |
| `--card-foreground` | `#fafafa` | Text on cards |
| `--muted` | `#262626` | Subdued backgrounds |
| `--muted-foreground` | `#a3a3a3` | Secondary text |
| `--border` | `#262626` | All borders |
| `--input` | `#262626` | Input fields |
| `--ring` | `#525252` | Focus rings |
| `--accent` | `#262626` | Hover/active backgrounds |
| `--accent-foreground` | `#fafafa` | Text on accent |
| `--destructive` | `#dc2626` | Errors |
| `--success` | `#22c55e` | OK states |
| `--warning` | `#eab308` | Warnings |
| `--popover` | `#141414` | Dropdowns |
| `--popover-foreground` | `#fafafa` | Popover text |

### Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Badges, small elements |
| `--radius-md` | `8px` | Buttons, inputs |
| `--radius-lg` | `12px` | Cards, panels |
| `--radius-xl` | `16px` | Modals, sheets |

### Typography

- UI font: `'DM Sans', sans-serif` (weights: 400, 500, 600)
- Data font: `'JetBrains Mono', monospace` (weights: 400, 500)
- Scale: 11px (badges) / 12px (log data) / 13px (body) / 14px (labels) / 18px (headings) / 24px (page titles)

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | `0px` | Reset |
| `--space-1` | `4px` | Tight gaps |
| `--space-2` | `8px` | Compact spacing |
| `--space-3` | `12px` | Default inner padding |
| `--space-4` | `16px` | Card padding, section gaps |
| `--space-5` | `20px` | Panel padding |
| `--space-6` | `24px` | Section margins |
| `--space-8` | `32px` | Large section gaps |
| `--space-10` | `40px` | Page-level margins |

### Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | `0` | Default stacking |
| `--z-sticky` | `10` | Sticky headers |
| `--z-sidebar` | `20` | Left sidebar |
| `--z-dropdown` | `30` | Dropdowns, popovers |
| `--z-modal-backdrop` | `40` | Modal overlay |
| `--z-modal` | `50` | Modal content |
| `--z-toast` | `60` | Toast notifications |

### Transition Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `100ms` | Hover states |
| `--duration-normal` | `200ms` | Default transitions |
| `--duration-slow` | `300ms` | Panel slides |
| `--duration-enter` | `400ms` | Page/component entrance |
| `--ease-default` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | General purpose |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy entrances |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving |

### Border Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--border-width` | `1px` | Default border |
| `--border-width-thick` | `2px` | Active indicators |
| `--ring-width` | `3px` | Focus ring width |
| `--ring-offset` | `2px` | Focus ring offset |

### Sizing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--header-height` | `56px` | Top header bar |
| `--sidebar-width` | `320px` | Left sidebar (expanded) |
| `--sidebar-collapsed` | `48px` | Left sidebar (icon-only) |
| `--log-row-height` | `35px` | Individual log row |
| `--panel-min-height` | `120px` | Minimum resizable panel |
| `--icon-sm` | `16px` | Small icons |
| `--icon-md` | `20px` | Default icons |
| `--icon-lg` | `24px` | Prominent icons |

### Shadow Tokens

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` |

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER (56px)                                                  │
│  [☰] NocLense    [Filters] [Open Log] [Crash Reports]  [◐ ☀]  │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│  LEFT      │   MAIN CONTENT AREA                               │
│  SIDEBAR   │                                                    │
│  (320px)   │  ┌──────────────────────────────────────────────┐ │
│            │  │  FilterBar (search + active filters)         │ │
│  ┌──────┐  │  └──────────────────────────────────────────────┘ │
│  │[AI   │  │                                                    │
│  │ Set] │  │  ┌──────────────────────────────────────────────┐ │
│  ├──────┤  │  │                                              │ │
│  │      │  │  │  LOG VIEWER (virtualized)                    │ │
│  │ AI   │  │  │  - Sticky column headers                     │ │
│  │ Chat │  │  │  - 35px rows, monospace data                 │ │
│  │      │  │  │                                              │ │
│  │      │  │  │                                              │ │
│  │      │  │  └──────────────────────────────────────────────┘ │
│  │      │  │  ═══════════ drag handle ═══════════════════════  │
│  │      │  │  ┌──────────────────────────────────────────────┐ │
│  │      │  │  │  DETAILS PANEL (selected log)                │ │
│  │      │  │  └──────────────────────────────────────────────┘ │
│  │      │  │                                                    │
│  └──────┘  │                                                    │
├────────────┴────────────────────────────────────────────────────┤
```

### Header (56px)
- Left: Hamburger toggle (collapses sidebar to 48px icon rail) + "NocLense" wordmark in DM Sans 600
- Center-right: Action buttons as monochrome ghost buttons — Filters, Open Log, Crash Reports
- Far right: Theme toggle (sun/moon icon)

### Left Sidebar (320px, collapsible to 48px)
- Top: "AI Settings" button → transitions to sub-panel (animated slide) with model selection, temperature, prompt templates
- Below: AI chat window — conversation-style interface for log analysis
- Border-right only (no shadow)
- Collapse: width animates 320px → 48px via Motion layout animation, chat content fades, icons remain

### Main Content Area
- FilterBar → LogViewer → Details Panel (two-panel stack, one drag handle)
- Each panel is a Card with `var(--card)` background, `var(--border)` border, `var(--radius-lg)` corners
- Panels animate in with staggered fade-up on initial log load

### Responsive
- < 1024px: sidebar auto-collapses to icon rail
- < 768px: sidebar becomes overlay sheet (slide from left, backdrop blur)

---

## Component Library

### Primitives

| Component | Variants | Notes |
|-----------|----------|-------|
| `Button` | `default`, `ghost`, `outline`, `destructive`, `icon` | Monochrome. Ghost for header. |
| `Input` | `default`, `search` | Search has icon slot. |
| `Badge` | `default`, `outline`, `level-error`, `level-warn`, `level-info`, `level-debug` | Log level + SIP badges |
| `Card` | `default`, `elevated` | Default = border. Elevated = border + shadow. |
| `Separator` | horizontal, vertical | 1px border color |
| `Tooltip` | — | Motion enter/exit, 200ms delay |
| `ScrollArea` | — | Thin monochrome scrollbar |

### Composites

| Component | Description |
|-----------|-------------|
| `Sheet` | Sliding panel (left/right/bottom). Mobile sidebar. |
| `Dialog` | Centered modal, backdrop blur. Export, consent, quota. |
| `DropdownMenu` | Filter dropdowns. Motion stagger on items. |
| `Sidebar` | Collapsible left panel with icon rail. |
| `SidebarItem` | Nav item, collapses to icon-only. |
| `Header` | Fixed top bar with slot areas. |
| `ResizeHandle` | Drag handle between panels. |

### Domain Components

| Component | Description |
|-----------|-------------|
| `LogRow` | Single log entry — grid, level badge, SIP badge, expandable |
| `LogViewer` | Virtualized log list with sticky header |
| `FilterBar` | Search + active filter chips |
| `AIChat` | Chat with message bubbles, input, streaming |
| `AISettingsPanel` | Settings sub-panel (model, temperature, prompts) |
| `DetailPanel` | Selected log details with JSON highlighting |
| `CrashReportsPanel` | Crash report viewer |
| `FileUploader` | Empty state with drag-and-drop |

---

## Animation Patterns

| Pattern | Where | Details |
|---------|-------|---------|
| Fade-up entrance | Cards, panels on mount | `y: 8→0`, `opacity: 0→1`, staggered 50ms |
| Sidebar collapse | Sidebar toggle | `width: 320→48`, layout animation, spring |
| Sheet slide | Mobile sidebar, AI settings | `x: -320→0` with backdrop fade |
| Scale-in | Modals, dialogs | `scale: 0.95→1`, `opacity: 0→1` |
| Stagger list | Dropdown items, filter chips | Sequential 30ms delay |
| Layout resize | Panel drag handles | Motion `layout` prop |
| Exit animation | Closing panels, removing chips | `AnimatePresence` fade-out + scale-down |

---

## Dependencies

### Add
| Package | Purpose | Size |
|---------|---------|------|
| `motion` | Animation library | ~15kb gzip |
| `@fontsource/dm-sans` | DM Sans font (self-hosted) | ~40kb |
| `@fontsource/jetbrains-mono` | JetBrains Mono font | ~30kb |

### Remove
- Timeline Scrubber (`src/utils/timelineCanvas.ts`, `TimelineScrubber.tsx`)
- Carbyne branding assets/references
- Red theme CSS variables

### Keep
- `lucide-react` (icons)
- `@tanstack/react-virtual` (log virtualization)
- `clsx` + `tailwind-merge` (class utilities)
- `tailwindcss` (layout utilities)

---

## Migration Strategy

Build new components → swap screen by screen → remove old code. Two design systems will coexist during migration; this is acceptable given the long development runway.
