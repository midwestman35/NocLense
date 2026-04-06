# NocLense Redesign — Three Directions (Saved for Review)

**Date:** 2026-04-01
**Status:** Direction B selected for implementation. A and C preserved for reference.

---

## Direction A: Phase Rooms

Each workflow phase (Import, Investigate, Submit) is a distinct "room" with its own layout, tools, and density. Transitioning between phases uses full-screen morphing animations via anime.js. The log grid only appears in Investigate. Import is a centered card. Submit is a focused form.

**Key idea:** The layout itself communicates where you are in the investigation. No phase stepper needed — the room IS the phase.

**Inspiration:** Linear's project views, Figma's mode switching.

---

## Direction B: Card Workspace (SELECTED)

Replace the fixed 3-panel layout with a flexible card canvas. Each investigation tool (Log Stream, AI, Timeline, Evidence, Ticket) is a draggable, resizable card. Cards can be expanded to full-width, collapsed to a header, or rearranged. Users compose their own workspace per investigation.

**Key idea:** Power users expand the log grid to 80% of screen. Quick-close analysts might just use AI + Ticket cards.

**Inspiration:** Notion blocks, Core.so panels, Arc browser spaces.

---

## Direction C: Refined Current

Keep the 3-panel structure but dramatically improve aesthetics, animation, and phase differentiation. Rounded surfaces, glassmorphism headers, prominent phase ribbon, anime.js driving every transition. Same mental model for existing users, premium feel.

**Key idea:** Lowest risk, highest polish. Same mental model, everything feels premium.

**Inspiration:** Warp terminal, Raycast, Apple Music.
