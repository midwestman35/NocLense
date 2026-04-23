---
version: alpha
name: NocLense GX
description: Google Expressive dark workspace for NOC engineers. Material 3 dark tonal surfaces, phosphor-mint key color, bold display type, spring motion.

colors:
  # Tonal surfaces (M3 dark, mint key)
  surface-dim:              "#0d1210"
  surface:                  "#131916"
  surface-container-low:    "#1b221e"
  surface-container:        "#1f2622"
  surface-container-high:   "#292f2c"
  surface-container-highest:"#343b38"
  # Content
  on-surface:               "#dde4df"
  on-surface-variant:       "#bec9c2"
  outline:                  "#889491"
  outline-variant:          "#3d4945"
  # Primary — phosphor mint
  primary:                  "#8ef0b7"
  on-primary:               "#00391e"
  primary-container:        "#00522d"
  on-primary-container:     "#aafcd3"
  # Secondary — sage
  secondary:                "#b3ccbe"
  on-secondary:             "#1e352a"
  secondary-container:      "#354b40"
  on-secondary-container:   "#cfe8da"
  # Tertiary — sky blue (Datadog/AI accent)
  tertiary:                 "#a4c8e1"
  on-tertiary:              "#073548"
  tertiary-container:       "#214d62"
  on-tertiary-container:    "#c1e5ff"
  # Error / Warning / Info
  error:                    "#ffb4ab"
  error-container:          "#93000a"
  warning:                  "#ffb945"
  warning-container:        "#4a3800"
  # Inverse (for snackbars etc.)
  inverse-surface:          "#dde4df"
  inverse-on-surface:       "#2b322e"
  inverse-primary:          "#006c3e"

typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.03em
  display-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.06em
  label-md:
    fontFamily: Geist Mono
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.12em
  label-sm:
    fontFamily: Geist Mono
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0.16em

rounded:
  xs:   4px
  sm:   8px
  md:   12px
  lg:   16px
  xl:   20px
  2xl:  28px
  full: 9999px

spacing:
  xs:  4px
  sm:  8px
  md:  16px
  lg:  24px
  xl:  32px
  2xl: 48px
  3xl: 64px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
    typography: "{typography.label-lg}"
  button-primary-hover:
    backgroundColor: "{colors.on-primary-container}"
  button-secondary:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-tonal:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  card:
    backgroundColor: "{colors.surface-container}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.lg}"
  card-elevated:
    backgroundColor: "{colors.surface-container-high}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.lg}"
  chip-assist:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  chip-filter-active:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  chip-status-high:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.error}"
    rounded: "{rounded.sm}"
  chip-status-med:
    backgroundColor: "{colors.warning-container}"
    textColor: "{colors.warning}"
    rounded: "{rounded.sm}"
  chip-status-low:
    backgroundColor: "{colors.surface-container-highest}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.surface-container-highest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  input-focus:
    backgroundColor: "{colors.surface-container-highest}"
    textColor: "{colors.on-surface}"
  nav-item-active:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "{rounded.full}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
  ai-card:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.lg}"
  progress-bar:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
    height: "4px"
---

## Overview

NocLense GX is a **Google Expressive** dark workspace for NOC (Network Operations Center) engineers. The visual language derives from **Material Design 3's** dark color scheme, with a **phosphor mint** key color that evokes real-time signal monitoring equipment and terminal displays.

The emotional register is: **precise confidence**. Not cold and clinical — that's the old version. The new workspace is warm, surfaces information with clear hierarchy, and uses color expressively to reward attention. The AI assistant feels like a knowledgeable colleague, not a black box.

Expressiveness is achieved through:
- **Bold display type** in Plus Jakarta Sans at large scale — the greeting, room names, and investigation titles should feel authoritative
- **Tonal elevation** instead of heavy drop-shadows — each layer of the surface stack is a distinct shade of the mint-tinted dark, creating depth without glow-soup
- **Rounded shapes** at every scale — cards are 28px, buttons are full-pill, chips are 8px. Sharp corners are reserved for log rows and data tables only
- **Primary color used sparingly** — the phosphor mint appears on the single most important CTA per screen, progress fills, and live-status dots. Everything else uses secondary/tertiary tones
- **Spring physics motion** — transitions between rooms use a gentle spring (stiffness 280, damping 28). Log entries animate in with a fast ease-out. AI streaming uses a soft pulse on the tertiary container

## Colors

The palette is derived from a **single key color: phosphor mint (#8ef0b7)**. Material 3's tonal algorithm generates the full dark-surface stack from this seed. Semantic roles:

- **Primary (#8ef0b7):** The live signal. Used for: active status dots, progress bars, the primary CTA button, focus rings, and the radar sweep. Never decorative.
- **Primary-container (#00522d):** Elevated tonal surface for the "Continue" card and any screen where the primary action is in progress.
- **Surface stack (dim → highest):** Five steps from #0d1210 to #343b38. Lower surfaces for backgrounds, higher for cards, highest for interactive elements like inputs and chips.
- **Tertiary (#a4c8e1):** Sky-blue accent exclusive to the Unleashed AI assistant. Everything the AI "owns" — its card, its streaming text, its hypothesis badge — uses tertiary or tertiary-container. This creates a clear visual ownership model.
- **Warning (#ffb945):** Amber, for elevated ticket severity (medium). Restrained — only the severity chip and critical log lines.
- **Error (#ffb4ab):** Coral-red for high severity tickets, error states, and destructive actions only.

## Typography

Two families working in strict division of labor:

**Plus Jakarta Sans** handles all human-facing content: greetings, investigation titles, body copy, button labels, section headers. It has a warmth and roundness that complements the rounded shape language. Use Display-LG (56px/700) for the authentication room headline. Use Headline-MD for investigation card titles.

**Geist Mono** handles all machine-generated data: timestamps, Call-IDs, event counts, token usage, hostnames, status codes, log lines. Labels are uppercase with 0.12–0.16em tracking. This strict separation makes at-a-glance scanning fast — if it's monospace, it's data.

Never mix families within a single label. Never use Plus Jakarta Sans for log content.

## Layout

**Navigation**: A collapsible 220px rail (expanded) / 64px rail (collapsed). Active items use the `nav-item-active` pill treatment — full-width rounded pill at 40px height. This is the M3 Navigation Drawer pattern adapted for a desktop workspace.

**Room layout**: Each of the three rooms (Import, Investigate, Submit) fills the content area. The Investigate Room uses a three-column split: 40% log stream / 35% AI assistant / 25% correlation rail. Panels have 20px gaps and 12px internal padding.

**Spacing rhythm**: Based on an 8px grid. Cards use 24px internal padding. Section gaps use 32px. The content area has 48px horizontal padding and 40px top padding.

**Responsive**: The app targets 1280px minimum width (Electron). Below 1100px, the AI rail collapses to an icon strip.

## Elevation & Depth

Depth is expressed through the **five tonal surface steps** — no drop-shadows on cards. The exception: the Authentication card uses a single `0 32px 80px -16px rgba(0,0,0,0.6)` shadow to float the glass panel above the log stream background.

Layer order (bottom → top):
1. `surface-dim` — page background
2. `surface` — main content area
3. `surface-container-low` — sidebar background
4. `surface-container` — default cards
5. `surface-container-high` — elevated cards, hover states, inputs
6. `surface-container-highest` — chips, active input fills, tooltips

## Shapes

The shape system uses **expressive rounding**:

- `2xl` (28px): Cards, modals, the AI assistant panel, the "Continue" hero card, drop zones
- `xl` (20px): Secondary cards, the log stream container, the correlation graph panel
- `lg` (16px): Investigation list rows, Zendesk ticket fetch area
- `full` (9999px): All buttons, status chips, severity badges, filter chips, nav rail items, progress bars, avatar circles
- `md` (12px): Input fields, tooltips
- `sm` (8px): Assist chips, tab indicators

Log rows in the virtualized list use **0px radius** — they are data, not containers. This deliberate contrast makes the log stream feel like raw instrument output against a polished shell.

## Components

### Buttons
Three button types in order of emphasis:
1. **Primary (filled)**: `primary` background + `on-primary` text + pill shape. One per screen maximum.
2. **Secondary (tonal)**: `secondary-container` background. For secondary actions adjacent to the primary.
3. **Ghost (text)**: Transparent, `on-surface-variant` text. For low-emphasis actions like "Cancel", "More options".

Never use an outlined button variant — it introduces unnecessary visual noise in a dark dense workspace.

### Chips
- **Status chips** (HIGH/MED/LOW): Full-pill, tonal colors from error/warning/surface-container-highest
- **Filter chips** (active): `secondary-container` fill — same treatment as active nav items for visual consistency
- **Assist chips**: `surface-container-high` fill, used for "Continue where you left off", "AI has a hypothesis"

### Input fields
Filled style only. `surface-container-highest` background, no visible border at rest. On focus: `primary` colored 2px bottom indicator (not a full border). Placeholder text in `on-surface-variant`. Label floats above on focus (M3 filled text field pattern).

### Navigation rail
Pill-shaped active items. Icon + label layout. The logo mark sits above the nav items, separated by a 16px gap. User avatar at the bottom. Width: 220px expanded.

## Do's and Don'ts

- **Do** use `primary` color only for the most important action per screen and live status indicators
- **Do** use `tertiary` and `tertiary-container` exclusively for AI-owned UI (Unleashed assistant card, hypothesis badges, AI activity feed)
- **Do** keep log rows at 0px radius — the data-vs-shell contrast is intentional
- **Do** use Plus Jakarta Sans for all human text; Geist Mono for all machine data — never mix within a label
- **Don't** use drop shadows on cards — use tonal surface elevation instead
- **Don't** use outlined buttons — filled (primary) and ghost (text) only
- **Don't** add more than one primary-colored CTA per screen
- **Don't** use the mint primary color decoratively — it must always mean "this is active / this is the primary action"
- **Don't** exceed 2xl (28px) radius on any element except pill shapes
- **Don't** use pure black (#000000) anywhere — use `surface-dim` (#0d1210) as the darkest value
