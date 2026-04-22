# Codex Agent Assignments

This guide establishes the convention for selecting specialized agents based on slice type in Codex dispatch prompts.

## 1. Mapping Table

| Slice Type | Primary Agent | Secondary / Support |
| :--- | :--- | :--- |
| **Frontend UI/UX** | `frontend-design` | `make-interfaces-feel-better` |
| **Polish / Animation** | `make-interfaces-feel-better` | `frontend-design` |
| **Refactoring / Debt** | `refactor` | `code-review` |
| **Logic / Bugs** | `oracle` (for complex) | `code-review` |
| **Performance Audit** | `native-app-performance` | `instruments-profiling` |
| **SwiftUI Redesign** | `swiftui-view-refactor` | `swiftui-performance-audit` |
| **Infra / Secrets** | `1password` | `domain-dns-ops` |
| **New CLI Features** | `create-cli` | `refactor` |
| **Doc Processing** | `markdown-converter` | `brave-search` |

## 2. Selection Logic

- **frontend-design**: Use for initial component creation, layout shifts, and Tailwind styling.
- **make-interfaces-feel-better**: Use for "final mile" polish—tweaking easing curves, adding staggers, or optical alignment fixes.
- **refactor**: Use for batch changes touching >3 files where structural consistency is key.
- **oracle**: Use when a logic bug is elusive or requires cross-validation against a second model's opinion.
- **code-review**: Always enabled for the validation phase, but can be targeted as a primary for specific safety/quality slices.

## 3. Dispatch Header Example

```markdown
# Dispatch: Phase 06B, Slice 3
# Agent: frontend-design
# Support: make-interfaces-feel-better
```
