# NocLense Operations Workspace Guidelines

## Purpose
NocLense should feel like a serious internal investigation tool built for evidence gathering, correlation, and stakeholder handoff. It is not primarily a place where operators resolve issues directly. It is the workspace where incidents are scoped, logs are organized, signals are correlated, and findings are turned into durable case context.

The target feeling is:

> Clean, mature, reliable, and easy to work in all day.

Not:

> Expensive-looking, theatrical, or visually clever at the cost of focus.

## Workflow Model
NocLense should support the real operating flow:

1. Intake the incident.
2. Gather evidence from APEX, Datadog, and AWS Console or CloudWatch.
3. Import or paste logs into NocLense.
4. Correlate identifiers, narrow the time window, and index the case.
5. Capture durable evidence, notes, and pivots.
6. Hand findings to the internal stakeholder who owns the failing component.

Unless the incident is a quick fix, the product should optimize for evidence quality, context retention, and handoff clarity rather than in-app remediation.

## Product Principles
### Case-centered, not file-centered
Users may begin with logs, but the durable unit of work is the case. File import should stay easy, but the workspace should steadily orient users toward case context, saved state, and evidence.

### Evidence over raw inspection
A good investigation is more than a filtered table. The UI should help users preserve evidence, add notes, capture reasoning, and export a defensible handoff packet.

### Source-aware intake
APEX, Datadog, and AWS logs do not arrive in the same way. Intake should make source type explicit, preserve provenance, and support paste-first workflows where exports are uncommon.

### Preserve the existing skeleton
We should improve the tool without disrupting habits users already rely on. The left rail, filter bar, main log canvas, and bottom details area remain the primary skeleton.

### Optional-first structure
Case management, evidence capture, and exports should improve the default workflow without making quick inspection heavier than it needs to be.

## UX And Visual Direction
### Practical and restrained
The product should look refined but not embellished. Pull back any shell treatments that feel cinematic, promotional, or overly staged.

### Calm for long working sessions
The interface should support long analysis sessions with denser composition, quieter surfaces, lower visual contrast between elevations, and subtle motion.

### Strong hierarchy, low drama
Visual emphasis should come from information hierarchy, type weight, spacing, and alignment rather than glow, blur, gradients, or oversized cards.

### Operational credibility
Panels, drawers, tables, and empty states should feel durable and utility-driven. The interface should look production-realistic and trustworthy.

### Modern without spectacle
Rounded geometry, thoughtful typography, and clean surfaces are welcome. Decorative theatricality is not.

## Interaction Principles
### Logs remain the primary canvas
The log view is the center of the product. Supporting panels should help users investigate without competing with the main reading surface.

### Details stay attached to the investigation
Structured details, evidence capture, and follow-up actions should live in an attached bottom or side context rather than modal or detached experiences.

### Motion must justify itself
Transitions should be brief, quiet, and comprehension-driven. Avoid animation that exists only to impress.

### Inline guidance over decorative emptiness
Empty states should teach the next action clearly and concisely. Avoid oversized placeholders and relaunch-style messaging.

### Keyboard and focus safety
Core workflows must remain usable through long sessions. Focus handling, hit targets, hover affordances, and panel behavior should reduce fatigue rather than create friction.

## Information Architecture
### LogContext owns log truth
Parsed logs, filtered logs, correlation state, source provenance, and large-file IndexedDB behavior should remain centralized in `LogContext`.

### CaseContext owns durable investigation state
Case metadata, evidence, notes, stakeholder handoff details, and saved investigation state belong in `CaseContext`.

### AI is supportive, never blocking
AI should remain optional, non-blocking, and subordinate to the main workflow. Users must be able to complete core investigations without it.

## Intake And Provenance Standards
- Support `.log`, `.txt`, and `.csv` consistently across all upload entry points.
- Support paste-first intake for AWS Console or CloudWatch workflows.
- Preserve source metadata for every dataset.
- Always surface enough provenance to answer where this evidence came from and when it was imported.
- When source detection is weak, prefer a permissive fallback import over blocking the user.

## Evidence And Export Standards
- Favorites are quick personal markers.
- Evidence is durable, case-owned, note-capable, and exportable.
- The product should support tagged evidence, compact citation copying, and stakeholder-ready export artifacts.
- Handoff outputs should explain time window, active pivots, evidence set, provenance, and next-query suggestions.

## Visual System Guidance
### Dark mode accent direction
Dark mode should use the green-house accent family with `#51912b` as the primary accent signal. This accent should communicate confidence and operational stability rather than novelty.

### Semantic colors stay semantic
Green can anchor the system accent, but destructive, warning, and informational states should retain distinct semantic colors so critical signals remain immediately legible.

### Typography usage
Decorative type should be rare. Dense working areas should prioritize clarity, alignment, and monospace readability.

### Surface treatment
Use restrained borders, quiet tonal separation, and minimal elevation changes. Surfaces should read as one integrated workspace.

## Implementation Guardrails
- Do not duplicate global state inside leaf components.
- Do not call AI providers directly from components.
- Keep files focused and split them before they become difficult to maintain.
- Prefer deterministic, inspectable workflows over opaque automation.
- Avoid introducing features that look impressive but do not reduce operational effort.

## Success Criteria
We are moving in the right direction when NocLense feels:

- more practical
- more focused
- more stable
- more trustworthy
- easier to use for hours at a time
- better at preserving investigation context
- better at packaging evidence for internal stakeholders

The measure of success is not whether the product looks more dramatic. The measure is whether investigations become easier to run, easier to resume, and easier to hand off.
