# CNC Site Names – Implementation Draft

## Summary

**Goal:** When the tool finds a CNC ID (e.g. `c0f4a56c-8034-4676-bc3d-aece4c6ed5c5`) in log data, show a human-readable site name (e.g. `MACC911`) everywhere that ID is displayed, using a plain-text or JSON “database” of mappings.

**Answers:**

| Question | Answer |
|----------|--------|
| **Is this feasible?** | **Yes.** The codebase already does the same thing for service names via `service-mappings.json` and `messageCleanup.ts`. CNC ID → site name is the same pattern: load a mapping once, then use it wherever the ID is rendered. |
| **How many components need to change?** | **4–5 touchpoints:** 1 new mapping file, 1 small loader/utility, 1 startup call, and **3 UI components** that currently display `cncID`. No changes to parser, IndexedDB, or filter logic. |
| **Format for site names?** | **Flexible.** JSON (like existing service-mappings) is simplest and recommended. Plain-text (one line per `uuid → site name`) is also fine; see format options below. |

---

## Where CNC IDs Appear Today

Parsing and storage stay as-is; only **display** changes.

| Location | File | What’s shown |
|----------|------|--------------|
| Log table row badge | `LogRow.tsx` | Truncated cncID, e.g. `cnc: c0f4a56c-80…` |
| Details panel summary | `LogDetailsPanel.tsx` | `cncID: <full uuid>` in summary and in the details grid |
| Correlation sidebar | `CorrelationSidebar.tsx` | List of all unique cncIDs (full UUID per item) |

Filtering and correlation continue to use the **raw cncID** (e.g. for “filter by this session”); only the **label** shown to the user becomes the site name when a mapping exists.

---

## Recommended Approach

1. **Add a CNC site mapping source**  
   - Same idea as `public/service-mappings.json`: a key-value map.  
   - **Recommended:** `public/cnc-site-mappings.json`  
   - Format: `{ "c0f4a56c-8034-4676-bc3d-aece4c6ed5c5": "MACC911", ... }`  
   - IDs can be lowercase or mixed case; lookup should be case-insensitive or normalized (e.g. lowercase) for consistency with log output.

2. **Add a small loader + getter**  
   - Load the mapping at app startup (e.g. in `main.tsx`, in parallel with `loadServiceMappings()`).  
   - Expose something like: `getCncSiteName(cncId: string): string | undefined`.  
   - If a cncID is in the map, return the site name; otherwise `undefined` so callers keep showing the raw ID (or truncated).

3. **Use the getter in the 3 display surfaces**  
   - **LogRow:** In the cnc badge, show `getCncSiteName(log.cncID) ?? truncated(log.cncID)` (and keep full UUID in `title` for copy/paste).  
   - **LogDetailsPanel:** In the summary and in the “cncID” row, show site name when present; optionally show `MACC911 (c0f4a56c-…)` or keep full UUID in a tooltip.  
   - **CorrelationSidebar (CorrelationItemList):** When `type === 'cncID'`, show site name as the visible label and keep full UUID in `title` (and use raw cncID for filter state, which you already do).

No changes needed in:

- `LogContext.tsx` (only stores/filters by cncID)
- `LogViewer.tsx` (only compares `log.cncID` to hover state; no text display)
- `parser.ts` / `indexedDB.ts` / `structuredFields.ts` (data shape stays the same)

---

## Format Options for the “Database”

### Option A – JSON (recommended)

- **File:** `public/cnc-site-mappings.json`
- **Format:**
  ```json
  {
    "c0f4a56c-8034-4676-bc3d-aece4c6ed5c5": "MACC911",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "SITE2"
  }
  ```
- **Pros:** Same pattern as `service-mappings.json`, one `fetch` + `JSON.parse`, no custom parsing.  
- **Cons:** Not “plain text” in the sense of line-by-line editor-friendly format.

### Option B – Plain text (line-based)

- **File:** e.g. `public/cnc-site-mappings.txt`
- **Format (examples):**
  - Tab-separated: `c0f4a56c-8034-4676-bc3d-aece4c6ed5c5\tMACC911`
  - Space-separated: `c0f4a56c-8034-4676-bc3d-aece4c6ed5c5 MACC911`
  - Key=value: `c0f4a56c-8034-4676-bc3d-aece4c6ed5c5=MACC911`
- **Parsing:** Fetch as text, split by newlines, parse each line (e.g. split on first tab/space/`=`), trim, build a `Record<string, string>`.
- **Pros:** Easy to edit in any text editor, one line per site, can be generated from scripts.  
- **Cons:** Slightly more parsing code and a convention for comments (e.g. ignore lines starting with `#`) if you want it.

### Option C – Hybrid

- Support both: try `cnc-site-mappings.json` first; if missing, try `cnc-site-mappings.txt` and parse line-by-line. Gives flexibility for deployment.

**Recommendation:** Start with **JSON** for consistency and minimal code; add plain-text parsing later if you prefer that for editing or tooling.

---

## File / Component Checklist

| # | Item | Action |
|---|------|--------|
| 1 | `public/cnc-site-mappings.json` | **New.** Add with at least one example row (e.g. one UUID → `MACC911`). |
| 2 | `src/utils/cncSiteMappings.ts` (or similar) | **New.** `loadCncSiteMappings()`, `getCncSiteName(cncId)`, store map in a module-level variable (same pattern as `messageCleanup.ts` and `serviceMappings`). |
| 3 | `src/main.tsx` | **Edit.** Call `loadCncSiteMappings()` at startup (e.g. alongside `loadServiceMappings()`). |
| 4 | `src/components/LogRow.tsx` | **Edit.** In the cncID badge: use `getCncSiteName(log.cncID)` for display when present; keep full `log.cncID` in `title`. |
| 5 | `src/components/log/LogDetailsPanel.tsx` | **Edit.** In `SummaryBlock` and in the cncID detail row: show site name when available; optionally show raw UUID in parentheses or tooltip. |
| 6 | `src/components/CorrelationSidebar.tsx` | **Edit.** In `CorrelationItemList`, when `type === 'cncID'`: display `getCncSiteName(item) ?? item` as the visible text, keep `title={item}` (full UUID). Filtering still uses `item` (raw cncID). |

So: **1 new asset, 1 new util, 1 startup change, 3 components** = 6 files total. No change to types, parser, or context beyond optionally exporting a way to read the mapping (e.g. from context) if you later want it in more places.

---

## Optional Enhancements

- **Tooltip / secondary text:** Everywhere you show the site name, keep the full cncID in a `title` or “(uuid)” so users can copy it and use it in filters or external tools.
- **Case normalization:** Normalize stored cncIDs to lowercase (or compare case-insensitively) so `C0F4A56C-...` and `c0f4a56c-...` both resolve to the same site.
- **Empty/missing file:** If the mapping file is missing or empty, `getCncSiteName` returns `undefined` and the UI falls back to current behavior (show raw or truncated cncID).

---

## Minimal Data Format (for your team)

If you want to give CNC site names in the simplest form:

- **JSON:** One object; keys = CNC IDs (strings), values = site name (string). No extra structure required.
- **Plain text:** One line per mapping: `UUID<tab or space>SiteName`. No strict column layout; a simple split on the first separator is enough. You can support `#` as comment lines if needed.

No need for a specific schema beyond “identifier → display name”; the rest is implementation detail.
