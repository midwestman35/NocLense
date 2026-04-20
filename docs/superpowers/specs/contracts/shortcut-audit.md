# Keyboard Shortcut Conflict Audit

**Phase:** 00 (contracts only)
**Consumers:** Phase 01b (AI surface shortcuts), Phase 02 (Log Stream shortcuts), Phase 05 (global)
**Platform scope:** Electron on Windows (primary); browser + macOS secondary

---

## 1. Reserved by OS / Electron / browser — DO NOT REBIND

| Combo | Owner | Behavior |
|---|---|---|
| `Ctrl+P` | OS / browser print | Print dialog |
| `Ctrl+S` | OS / browser save | Save page |
| `Ctrl+F` | browser | Find in page |
| `Ctrl+W` | Electron | Close window |
| `Ctrl+R` | Electron | Reload |
| `Ctrl+Shift+R` | Electron | Hard reload |
| `Ctrl+T` | browser | New tab (reserved for future secondary windows) |
| `Ctrl+Tab` | OS / Electron | Window/tab switch |
| `Alt+F4` | OS | Close app |
| `Ctrl+N` | Electron | New window |
| `F5` / `Ctrl+F5` | Electron | Reload |
| `F11` | browser / Electron | Fullscreen |
| `F12` | Electron | DevTools |
| `Ctrl+Shift+I` | Electron | DevTools |

## 2. Approved shortcuts for polish pass

Each row includes **focus preconditions** — when the app is expected to intercept the combo and when it must fall through to the default handler.

| Combo | Surface | Phase | Action | Focus precondition |
|---|---|---|---|---|
| `Ctrl+Shift+P` | AI Diagnose card | 01b | Pin currently-focused block to Evidence | Focus inside `[data-surface="ai-diagnose"]` AND not inside a text input / textarea / contenteditable |
| `Esc` | AI Diagnose card | 01b | Abort in-flight request or cancel typewriter reveal | Focus inside `[data-surface="ai-diagnose"]`; falls through to native Esc in modals/dialogs |
| `Alt+↑` / `Alt+↓` | AI Diagnose card | 01b | Navigate phase / investigation history | Focus inside `[data-surface="ai-diagnose"]`; suppressed inside text inputs |
| `Ctrl+Enter` | AI chat input | 01b | Send (multi-line compatible) | Only when focus is in the AI chat textarea |
| `Ctrl+G` | Log Stream | 02 | Go to entry by line number (opens dialog) | Focus inside `[data-surface="log-stream"]`; suppressed inside text inputs |
| `Ctrl+[` / `Ctrl+]` | Log Stream | 02 | Cycle through active citation matches | Focus inside `[data-surface="log-stream"]`; suppressed inside text inputs |
| `Ctrl+Shift+E` | Evidence | 01c | Export Evidence as `.noclense` | Focus inside `[data-surface="evidence"]` or when evidence has non-empty contents and an active case exists |
| `Ctrl+Shift+N` | Any surface | 01c | Add engineer note to active block | Any focus; opens in a dedicated input so doesn't conflict |
| `Tab` / `Shift+Tab` | Any | global | Focus navigation (browser default preserved) | Always |

**Ctrl+Shift+P scope decision (resolved):** AI-card-focused in **01b**, promoted to global pin (any focused canonical block across surfaces) in **01c** once Evidence integration lands. Between 01b and 01c, pressing Ctrl+Shift+P outside the AI card is a no-op.

## 3. Input suppression matrix

All approved app shortcuts MUST fall through to default when focus is in:

| Context | Shortcuts to suppress |
|---|---|
| `<input>` (any type) | All app shortcuts except `Ctrl+Enter` (in AI chat textarea — explicit opt-in) |
| `<textarea>` | Same as `<input>` |
| `contenteditable="true"` | All app shortcuts |
| Native `<dialog>` open | Only `Esc` remains native; all other app shortcuts suppressed |
| Menu bar / context menu open (Electron) | All app shortcuts suppressed; menu handles keyboard directly |

Implementation pattern (Phase 01b): central keyboard handler checks `document.activeElement` against the suppression matrix before dispatching the app handler.

## 4. Rejected / deferred

| Combo | Reason |
|---|---|
| `Ctrl+K` | Command palette deferred per spec §7. Global key reserved until palette lands post-polish. |
| `Ctrl+P` (pin) | Conflicts with OS print. Moved to `Ctrl+Shift+P`. |
| `Ctrl+/` | Conflicts with browser View Source in some builds. Defer. |
| `/` prefix (vim-style command) | Interferes with text typing. Defer with command palette. |
| Single-letter shortcuts without modifier | Never — collides with log filter input. |
| `Shift+↑` / `Shift+↓` split-pane resize | **Removed.** Resizable surfaces are deferred to Phase 6+ roadmap (spec §5.5). Reserve for future if the feature returns. |

## 5. Platform-specific notes

- **macOS:** `Cmd` replaces `Ctrl` for all approved shortcuts. Electron's `CommandOrControl` accelerator is the correct binding syntax.
- **Linux Electron:** follows Ctrl-key conventions.
- **Reduced motion:** no shortcut changes under `prefers-reduced-motion`. Typewriter-reveal cancels remain instant regardless.

## 6. Validation

Phase 01b smoke test on Windows Electron build, verify:
1. `Ctrl+P` still opens system print dialog (not intercepted).
2. `Ctrl+Shift+P` pins when AI card is focused; is a no-op elsewhere.
3. `Esc` cancels typewriter reveal without closing the card.
4. `Alt+↑` does not collide with browser "navigate back" in the Electron main window.
5. Typing `Ctrl+Enter` inside the chat textarea sends; typing the same combo anywhere else is a no-op.
6. All approved shortcuts fall through when focus is in any `<input>` or `<textarea>`.
