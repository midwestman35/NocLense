# Operator Client Log Parser — Grammar Contract

**Phase:** 00 (contracts only — no implementation)
**Consumers:** Phase 02 (Log Stream OC parser), canonical citation model
**Owner spec:** `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md` §5.3

---

## 1. Scope

This contract defines what the Operator Client parser must produce to support the canonical citation model. The parser is a **new format extension** to `src/utils/parser.ts`. Existing format handlers (Datadog CSV, Homer SIP JSON, plain text, call log CSV) are untouched.

## 2. Input

A UTF-8 text file whose contents match the Operator Client format. Typical file sizes 16 MB to 52 MB+; files over 50 MB stream through IndexedDB per the existing streaming path in `parser.ts`.

## 3. Entry boundary detection — strict header grammar

A **start-of-entry line** is a line whose ENTIRE content matches the full header grammar below. A prefix-only regex is insufficient because a body line can contain substrings like `[INFO] ...` embedded in a message or JSON value. The parser MUST validate the entire header structure before treating a line as a new entry.

Lines that do not match the full header grammar are body continuation of the preceding entry, regardless of whether they begin with `[LEVEL]`.

## 4. Header grammar (single source of truth)

The start-of-entry line matches this grammar exactly (used for BOTH boundary detection and parse):

```
ENTRY_HEADER   := "[" LEVEL "]" WS "[" TIMESTAMP "]" WS "[" COMPONENT "]" ":" WS MESSAGE_HEAD EOL

LEVEL          := "ERROR" | "WARN" | "INFO" | "DEBUG"

TIMESTAMP      := MONTH "/" DAY "/" YEAR "," WS HOUR ":" MINUTE ":" SECOND WS AMPM "," MILLIS
MONTH          := [0-9]{1,2}
DAY            := [0-9]{1,2}
YEAR           := [0-9]{4}
HOUR           := [0-9]{1,2}
MINUTE         := [0-9]{2}
SECOND         := [0-9]{2}
AMPM           := "AM" | "PM"
MILLIS         := [0-9]{1,3}

COMPONENT      := [^\]]+              ; any char except closing bracket
MESSAGE_HEAD   := .*                   ; rest of the line after ": "
EOL            := "\n" | "\r\n" | EOF
WS             := " "
```

**Implementation note:** precompile this as a single anchored regex (`^\[...\]$` matching the entire line). On a candidate line, attempt the full-grammar match. Only on success is the line a start-of-entry.

**Malformed-looking headers** (start with `[LEVEL]` but do not match the full grammar): the line is TREATED AS BODY, not as a new entry. If an operator-facing warning is useful, log once per file.

## 5. Timestamp provenance (single source of truth)

**Rule:** timestamps are parsed ONCE at parse time using a single authoritative timezone source, and both the absolute Unix ms value AND the original raw string are preserved on every entry.

**Timezone source resolution (first match wins):**
1. `InvestigationSetup.timezone` (user-confirmed customer timezone).
2. Per-file override supplied by the import flow, if any.
3. Fall back to the Electron host's local timezone. Record the resolved tz in `LogEntry.sourceTimezone` (new optional field, Phase 02).

**Storage invariant:** every OC-parsed entry stores:
- `timestamp` — Unix ms absolute value derived from the header timestamp interpreted in the resolved tz.
- `rawTimestamp` — verbatim header timestamp string, untouched.
- `sourceTimezone` — IANA zone id (e.g. `"America/New_York"`) used to resolve the absolute value.

This triple is sufficient to reconstruct the original wall time without re-parsing. The UI never re-interprets; it either renders `rawTimestamp` verbatim or converts `timestamp` back to a target tz using a known source.

## 6. JSON body parsing — preservation invariant

Every line between the start-of-entry line and the next start-of-entry (or EOF) is body. Regardless of parse outcome, the raw body text is ALWAYS preserved on the entry.

1. Concatenate body lines with `\n` preserved → `rawBody`.
2. Store `rawBody` on `LogEntry.payload` in ALL cases (success and failure).
3. If `rawBody` trimmed starts with `{` or `[`, attempt `JSON.parse(rawBody)`:
   - On success: store parsed value on `LogEntry.json` (typed `unknown`; narrow at consumption). Set `jsonMalformed = false`.
   - On failure: leave `LogEntry.json` undefined. Set `jsonMalformed = true`.
4. If `rawBody` is plain text (doesn't start with `{` / `[`): leave `json` undefined, leave `jsonMalformed` unset (neither true nor false — plain text is not malformed JSON).

**Invariant:** `LogEntry.payload === rawBody` always. `LogEntry.json` is a structured projection *in addition to* the raw text, never instead of it.

**Recovery rule:** malformed JSON entries are NEVER dropped. They render with a muted-orange left border. Citations to malformed entries still work (byte-offset based).

## 7. Correlation field extraction

After successful JSON parse, these fields are null-safely promoted from the JSON body to first-class `LogEntry` fields:

| LogEntry field | JSON path (first match wins) |
|---|---|
| `traceId` | `traceId`, `trace_id`, `trace.id` |
| `stationId` | `cpeStation.id`, `station.id`, `stationId` |
| `cncID` | `cpeUser.cncID`, `cnc.id`, `cncID` |
| `callId` | `callId`, `call_id`, `call.id`, `Call-ID` |
| `operatorId` | `operator.id`, `operatorId`, `cpeUser.operatorId` |
| `extensionId` | `extension.id`, `extensionId`, `cpeUser.extensionId` |

Extraction uses dot-path traversal. If any intermediate key is `undefined`, the extraction fails silently and the field stays undefined.

**`traceId` is a NEW indexed correlation field** (Phase 00 adds it to `LogEntry`). All correlation filter chips, `useLogContext` active correlations, and citation-jump can key on `traceId` from Phase 02 onward.

## 8. Citation locator fields (paired invariant)

For every produced `LogEntry`, the parser must populate ALL THREE of these fields together, or NONE:

| Field | Semantics |
|---|---|
| `fileName` | Source file name (as imported). |
| `lineNumber` | 1-based line number of the start-of-entry line. Display locator. |
| `byteOffset` | Byte offset of the start-of-entry line's first char. Canonical stable locator. |

`byteOffset` is the canonical citation locator because:
- Line numbers drift if the same file is re-saved with different line endings.
- Line numbers drift if the parser's entry-grouping rules change.
- Byte offsets are immutable as long as the file content is unchanged.

The session-scoped `LogEntry.id` is the cheap in-memory pointer; citations persist `fileName + lineNumber + byteOffset` instead.

## 9. Performance contract

- Streaming: chunked read in 2 MB chunks (existing path in `parser.ts`). Parser must not require the full file in memory.
- JSON body buffering: accumulate body lines until the next start-of-entry, then call `JSON.parse` once. Do not attempt incremental JSON parsing.
- Target throughput: ≥ 40 MB/sec on the Phase 01a benchmark harness hardware.
- Boundary check: the full-grammar regex runs on every line. Must be anchored and O(line length).

## 10. Test fixtures (Phase 02 must include)

- `tests/fixtures/oc/canonical.log` — 50 entries, valid JSON bodies, full field coverage.
- `tests/fixtures/oc/malformed.log` — 10 entries, half with malformed JSON, half with missing correlation fields.
- `tests/fixtures/oc/embedded-brackets.log` — entries whose JSON body contains strings like `"[INFO] message inside"` to verify boundary detection uses the full header grammar.
- `tests/fixtures/oc/mixed-levels.log` — ERR, WARN, INFO, DEBUG interleaved.
- `tests/fixtures/oc/streaming-50mb.log.gz` — compressed real MACC sample with synthetic PII scrubbed.

## 11. Non-goals

- Not parsing OC-format *binary* logs (if any exist). Text only.
- Not supporting the legacy OC format pre-2024 (if it existed). Current format only.
- Not reformatting entries — `rawTimestamp` and `payload` are preserved verbatim.
- Not inferring missing timestamp fields. If timestamp fails to parse, `timestamp = 0` and `rawTimestamp` is the raw string; entry still renders and is still citable by byte offset.
