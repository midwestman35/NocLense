# Runbook — Setup Room

**Surface:** `src/components/rooms/setup/SetupRoom.tsx` + `CredentialCard.tsx` + `AttachmentPanel.tsx` + `ContextPanel.tsx` + `setupRoomShared.ts`
**Source commits:** `c3afab5` (07F) + `5435464` (polish)
**Automation share:** ~70% — mocked services cover happy path; real vendor API roundtrips stay manual
**Last updated:** 2026-04-23

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft, post-07F + polish. Covers vendor credential round-trip through `aiSettings` localStorage (per 07F redirect — vendor-keyring migration deferred to Phase 08 per inventory §2.1). |

## Preconditions

- Import Room runbook §10 complete (phase-dot transitioned to Setup).
- Test credentials available:
  - Zendesk: subdomain, agent email, API token.
  - Jira: subdomain, email, token, project key.
  - Datadog: API key, app key, site.
  - Confluence: space ID, parent page ID.
- If using real credentials, ensure they have read scopes only for the test run. Do NOT use production-write scopes during runbook walks.

## Steps

### 1. First paint

**Action:** Enter Setup Room from Import Room (phase dots navigation).

**Pass criteria:**
- Layout renders: credential cards section (Zendesk, Jira, Datadog, Confluence) + context panel (timezone, ticket ID) + attachment panel (if attachments present from Import).
- Phase dots show Setup active.
- Saved credentials (if any) pre-populate fields — read via `loadAiSettings()` from `src/store/aiSettings.ts`.

### 2. Zendesk credential save + round-trip

**Action:** Enter Zendesk subdomain, email, API token. Click Save (or the field loses focus if auto-save).

**Pass criteria:**
- `saveAiSettings()` writes to `localStorage['unleash_ai_settings']`; inspect via browser DevTools Application → Local Storage.
- Confirm keys in storage match what was typed (plain text — this is the 07F port-behavior, flagged for Phase 08 keyring migration per inventory §2.1).
- Quit app fully (not just close window). Relaunch, continue past splash, return to Setup Room.
- Fields repopulate with the saved values.

### 3. Zendesk "Test connection"

**Action:** With valid credentials entered, click the Test / Verify button (if exposed).

**Pass criteria:**
- Button enters a loading state.
- On success: green check or success message; `zendeskService` validation call returned 200.
- On failure: red error with HTTP status code / error body; credentials remain in the field for re-edit.

### 4. Invalid Zendesk credentials error path

**Action:** Enter a deliberately wrong token. Click Test.

**Pass criteria:**
- Error message clearly identifies the failure (401 Unauthorized / invalid subdomain / etc.).
- No crash; user can correct and retry.
- Saved settings are NOT overwritten with the invalid value until save is successful (or: saved as-is but flagged invalid — verify behavior against `CredentialCard.tsx`).

### 5. Jira / Datadog / Confluence round-trips

**Action:** Repeat Steps 2 and 3 for each of Jira, Datadog, Confluence.

**Pass criteria:**
- Each vendor saves + round-trips independently through `aiSettings`.
- No interference between vendors — saving Jira doesn't overwrite Datadog keys.
- Test-connection buttons (if present) hit the correct vendor's validation endpoint via its service module (`jiraService`, `datadogService`, `confluenceService`).

### 6. Default Datadog indexes + hosts

**Action:** In the Datadog section, set `datadogDefaultIndexes` (comma-separated) and `datadogDefaultHosts`. Save.

**Pass criteria:**
- Values persist through `aiSettings`.
- Values pre-populate `InvestigationSetupModal` or equivalent Datadog UI on next case.

### 7. Attachment panel (from Import)

**Action:** Import a PDF / zip attachment via Import Room. Enter Setup Room. Observe AttachmentPanel.

**Pass criteria:**
- AttachmentPanel lists the imported attachments with name, size, kind.
- User can mark each as "include in investigation" or "skip".
- Selected attachments pass through to Investigate Room correctly.

### 8. Context panel (timezone, ticket)

**Action:** Set the customer timezone from the dropdown. Enter a ticket ID.

**Pass criteria:**
- Timezone dropdown lists the options from `TIMEZONE_OPTIONS` (see `src/components/ai/diagnose/timezoneOptions.ts`).
- Selection persists into the case metadata — inspect `caseRepository` after transitioning to Investigate.
- Ticket ID normalizes via `normalizeTicketInput` (strips non-digits).

### 9. Transition to Investigate Room

**Action:** Click the Start Investigation / Continue button.

**Pass criteria:**
- Phase dot Setup transitions to `completed`; Investigate becomes `active`.
- Investigate Room mounts with case context populated (timezone, ticket, selected attachments, imported logs).
- `caseRepository` case record updated with Setup values.

### 10. Return to Setup Room (edit)

**Action:** After entering Investigate, click the Setup phase dot to go back.

**Pass criteria:**
- Setup Room re-renders with all previously entered values intact.
- Edits to timezone / ticket / attachments are persisted and reflected in Investigate on re-advance.

## Known failure modes

| Symptom | Root cause | Fix / watch |
|---|---|---|
| Saved credentials don't repopulate after restart | `loadAiSettings()` not being called in `SetupRoom.tsx` mount, OR `STORAGE_KEY` mismatch | Check `SetupRoom.tsx:26` uses `loadAiSettings()` |
| Test connection always fails | Vendor service base URL hardcoded vs. subdomain; CORS failure; or Tauri `plugin-http` allowlist missing vendor host | Check `default.json` capabilities + service module base URL construction |
| Fields blank after entering a valid URL/email | Controlled-component issue — value prop not wired to state | Check `CredentialCard.tsx` input `value` + `onChange` |
| Plain-text tokens visible in localStorage | Expected per 07F port-behavior; flagged for Phase 08 keyring migration | Inventory §2.1 |
| AttachmentPanel empty despite imports | `LogContext.importedDatasets` not wired, or attachments stripped during batch conversion | Check `mergeAttachments` in `setupRoomShared.ts` |

## Automation target (07J.3)

| Step | Automatable? | Notes |
|---|---|---|
| 1. First paint | YES | Assert credential-card + context-panel markers |
| 2. Zendesk save + round-trip | YES | Fill fields, save, restart (Playwright can kill + relaunch Tauri), assert repopulation |
| 3. Test connection (success) | PARTIAL | Mock `zendeskService` response via MSW or Playwright route; real API stays manual |
| 4. Invalid credentials | YES with mock | Assert error text after mocked 401 response |
| 5. Jira/Datadog/Confluence | YES with mocks | Parameterize test across all four vendors |
| 6. Default indexes/hosts | YES | Persist + assert pre-population in Investigate |
| 7. Attachment panel | YES | Pre-seed `importedDatasets` with fixture, assert panel renders |
| 8. Context panel | YES | Select timezone, enter ticket, assert case record |
| 9. Transition to Investigate | YES | Click Start, assert Investigate mount |
| 10. Return + edit | YES | Navigate back, assert values persist |

`/smoke-tauri setup-room` runs steps 1, 2, 4, 5, 6, 7, 8, 9, 10 under mocked services. Step 3 against real vendors stays a manual gate until we're willing to ship recorded fixtures.
