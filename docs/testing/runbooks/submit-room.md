# Runbook — Submit Room

**Surface:** `src/components/rooms/submit/SubmitRoom.tsx` + `ClosureNote.tsx` + `EvidenceSummary.tsx` + `HandoffExport.tsx`
**Source commits:** `2dfe6c5` (07H) + `5435464` (polish)
**Automation share:** 100% — all paths automatable
**Last updated:** 2026-04-23

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft, post-07H + polish. Covers `.noclense` ZIP export only; PDF/Markdown export deferred per inventory §2.2. |

## Preconditions

- Investigate Room runbook §10-12 complete (≥1 pinned evidence item exists in `EvidenceContext`).
- Case in `caseRepository` with status not yet `closed`.
- Write access to the download directory.

## Steps

### 1. First paint

**Action:** Enter Submit Room via phase dot navigation from Investigate.

**Pass criteria:**
- Layout renders three panels: `ClosureNote` (editor) + `EvidenceSummary` (pinned items list) + `HandoffExport` (export controls).
- Phase dots show Submit active.
- No console errors.

### 2. Closure note authoring

**Action:** Type a closure note (multi-line, markdown-ish) in `ClosureNote`.

**Pass criteria:**
- Input accepts text including newlines.
- Character count or line count indicator updates (if present).
- Unsaved changes marker appears (if present).
- Auto-save or explicit save writes to `caseRepository` for the active case.

### 3. Evidence summary render

**Action:** Observe `EvidenceSummary`.

**Pass criteria:**
- One row per pinned item from `EvidenceContext`.
- Each row shows: source log ID / timestamp, selected text, optional note.
- Items render in `order` field ascending (same order as Investigate's `EvidencePanel`).
- Count of pinned items displayed at the top.

### 4. Evidence summary edit (if supported)

**Action:** Click an evidence item's edit affordance.

**Pass criteria:**
- Can edit the note inline or in a modal.
- Edits persist to `EvidenceContext.updateItemNote`.
- Back in Investigate Room's EvidencePanel, the same edits are visible.

### 5. Handoff export — `.noclense` ZIP

**Action:** Click "Export" or "Generate Handoff" in `HandoffExport`.

**Pass criteria:**
- Native file-save dialog opens (via Tauri plugin-dialog).
- Default filename follows convention (e.g. `<ticketId>_<timestamp>.noclense`).
- Upon save, file writes to chosen path.
- File is a valid ZIP (inspect with `unzip -l` or equivalent).
- ZIP contains JSON files per `investigationExporter.ts`:
  - `case.json` — case metadata.
  - `logs.json` or similar — relevant log entries.
  - `evidence.json` — pinned evidence.
  - `closure.json` — closure note + timestamp.

### 6. Round-trip import of exported ZIP

**Action:** Open a fresh Tauri window (or clear local state), enter Import Room, import the exported `.noclense` file.

**Pass criteria:**
- `noclenseImporter` parses the ZIP successfully.
- Case record is recreated in `caseRepository`.
- Evidence, logs, closure note are restored.
- User can advance the case through rooms with full fidelity to the original.

### 7. Phase-dot final state

**Action:** Complete the export (Step 5) and confirm the case as closed.

**Pass criteria:**
- Phase dot Submit transitions to `completed`.
- All four phase dots show `completed`.
- Case `status` in `caseRepository` flips to `closed`.
- Dashboard's `ClosedRow` now includes this case.

### 8. Empty evidence edge case

**Action:** Enter Submit Room with zero pinned evidence items.

**Pass criteria:**
- `EvidenceSummary` renders an empty-state placeholder.
- Handoff export still works — ZIP is valid but `evidence.json` contains an empty array.

### 9. Return to Investigate from Submit

**Action:** Click the Investigate phase dot.

**Pass criteria:**
- Investigate Room re-renders with previous case state intact.
- User can add/remove evidence and return to Submit; `EvidenceSummary` reflects the new state.
- Closure note from Submit persists through the round-trip.

### 10. PDF / Markdown export (not yet wired)

**Action:** Attempt to trigger PDF or Markdown export.

**Pass criteria:**
- Either: UI clearly indicates the feature is not yet available (disabled button, "Coming soon" label).
- Or: feature is fully absent from the UI.
- Inventory §2.2 tracks this for 07I.a or Phase 08.

## Known failure modes

| Symptom | Root cause | Fix / watch |
|---|---|---|
| Export button does nothing | `plugin-dialog` not in `default.json` capabilities | Check `src-tauri/capabilities/default.json` for `dialog:allow-save` or equivalent |
| ZIP file empty or corrupt | `investigationExporter.ts` regression — stream write not awaited | Grep `investigationExporter.ts` for async await on zip.generateAsync |
| Evidence summary missing items | `EvidenceContext` not populated — possibly consumer mounted before provider hydrated | Check `EvidenceProvider` mount order |
| Closure note lost after navigation | Not wired to `caseRepository` save — local-state only | Check `ClosureNote.tsx` for persist call |
| Phase dots don't flip to `completed` on export | Export success doesn't fire case status update | Check `HandoffExport.tsx` post-export effect |

## Automation target (07J.3)

| Step | Automatable? | Notes |
|---|---|---|
| 1. First paint | YES | Assert three-panel layout |
| 2. Closure note authoring | YES | `page.getByRole('textbox').fill(...)` |
| 3. Evidence summary render | YES | Pre-seed `EvidenceContext` fixture, assert row count |
| 4. Evidence summary edit | YES | Click edit, fill note, assert persistence |
| 5. Handoff export | YES | Mock or intercept save-dialog (Tauri dialog has an event stream we can subscribe to); assert file written |
| 6. Round-trip import | YES | After Step 5 writes file, clear IndexedDB, enter Import, feed file path via `setInputFiles`; assert restoration |
| 7. Phase-dot final state | YES | Inspect `data-completed` on all dots |
| 8. Empty evidence edge case | YES | Clear `EvidenceContext` fixture, assert placeholder |
| 9. Return to Investigate | YES | Nav + assert state persistence |
| 10. PDF/Markdown not wired | YES | Assert absence or disabled state |

`/smoke-tauri submit-room` covers all 10 steps. The round-trip test (Step 6) is the highest-value assertion — it proves the ZIP format is actually consumable by the importer, not just written to disk.
