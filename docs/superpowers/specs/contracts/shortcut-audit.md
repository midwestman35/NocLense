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
| `Ctrl+T` | browser | New tab (N/A in Electron main window, but reserved for future secondary windows) |
| `Ctrl+Tab` | OS / Electron | Window/tab switch |
| `Alt+F4` | OS | Close app |
| `Ctrl+N` | Electron | New window |
| `F5` / `Ctrl+F5` | Electron | Reload |
| `F11` | browser / Electron | Fullscreen |
| `F12` | Electron | DevTools |
| `Ctrl+Shift+I` | Electron | DevTools |

## 2. Approved shortcuts for polish pass

| Combo | Surface | Phase | Action |
|---|---|---|---|
| `Ctrl+Shift+P` | AI card | 01b | Pin focused block to Evidence *(was Ctrl+P — moved to avoid print)* |
| `Esc` | AI card | 01b | Abort in-flight request / cancel typewriter reveal |
| `Alt+↑` / `Alt+↓` | AI card | 01b | Navigate phase / investigation history |
| `Ctrl+Enter` | AI chat input | 01b | Send (multi-line compatible) |
| `Ctrl+G` | Log Stream | 02 | Go to entry by line number (dialog) |
| `Ctrl+[` / `Ctrl+]` | Log Stream | 02 | Cycle through active citation matches |
| `Ctrl+Shift+E` | Evidence | 01c | Export Evidence as `.noclense` |
| `Ctrl+Shift+N` | Any | 01c | Add engineer note to active block |
| `Shift+↑` / `Shift+↓` | Log Stream | 02 | Adjust split pane by 80px *(future — Phase 04)* |
| `Tab` / `Shift+Tab` | Any | global | Focus navigation (browser default preserved) |

## 3. Rejected / deferred

| Combo | Reason |
|---|---|
| `Ctrl+K` | Command palette deferred per spec §7. Global key reserved until palette lands post-polish. |
| `Ctrl+P` (pin) | Conflicts with OS print. Moved to `Ctrl+Shift+P`. |
| `Ctrl+/` | Common "focus search" but collides with browser's View Source in some builds. Defer. |
| `/` prefix (vim-style command) | UX concern: interferes with text typing in inputs. Defer with command palette. |
| Single-letter shortcuts (no modifier) | Never — collides with log filter input. |

## 4. Platform-specific notes

- **macOS:** `Cmd` replaces `Ctrl` for all approved shortcuts above. Electron's `CommandOrControl` accelerator is the correct binding syntax.
- **Linux Electron:** follows Ctrl-key conventions. No special handling.
- **Reduced motion:** no shortcut changes under `prefers-reduced-motion`. Typewriter-reveal cancels remain instant regardless.

## 5. Unresolved — Phase 01b must decide

- Whether `Ctrl+Shift+P` pin action is global (any focused block in any surface) or AI-card-only. Recommend AI-card-only for Phase 01b; promote to global in Phase 01c once Evidence integration is proven.
- Whether `Esc` should also close the AI card when no operation is in flight. Recommend NO — `Esc` is cancel-only; closing cards requires an explicit control.

## 6. Validation

Phase 01b smoke test: on Windows Electron build, verify:
1. `Ctrl+P` still opens system print dialog (not intercepted).
2. `Ctrl+Shift+P` pins when AI card focused.
3. `Esc` cancels typewriter reveal without closing the card.
4. `Alt+↑` does not collide with browser "navigate back" (it shouldn't in Electron main window).
