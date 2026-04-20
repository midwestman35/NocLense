# Operator Client Log Parser — Grammar Contract

**Phase:** 00 (contracts only — no implementation)
**Consumers:** Phase 02 (Log Stream OC parser), canonical citation model
**Owner spec:** `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md` §5.3

---

## 1. Scope

This contract defines what the Operator Client parser must produce to support the canonical citation model. The parser is a **new format extension** to `src/utils/parser.ts`. Existing format handlers (Datadog CSV, Homer SIP JSON, plain text, call log CSV) are untouched.

## 2. Input

A UTF-8 text file whose contents match the Operator Client format. Typical file sizes 16 MB to 52 MB+; files over 50 MB stream through IndexedDB per the existing streaming path in `parser.ts`.

## 3. Entry boundary detection

A **start-of-entry line** is any line that matches the regex:

```
^\[(ERROR|WARN|INFO|DEBUG)\]\s
```

Lines that do not match this pattern are body continuation of the preceding entry.

**Rationale:** the OC format is log-level-first, which is stable across versions. Using component name or timestamp as the entry marker is fragile because both contain whitespace and arbitrary content.

## 4. Header grammar

The start-of-entry line has the structure:

```
[LEVEL] [M/D/YYYY, H:MM:SS AM/PM,MS] [Component]: message
```

Formal grammar (simplified):

```
ENTRY_HEADER   := "[" LEVEL "]" WS "[" TIMESTAMP "]" WS "[" COMPONENT "]" ":" WS MESSAGE_HEAD

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

COMPONENT      := [^\]]+             ; any char except closing bracket
MESSAGE_HEAD   := .*                  ; rest of the line after ": "
```

**Timestamp interpretation:** treat as the user's local timezone by default. If the AI caller supplies `timezone` (per `InvestigationSetup.timezone`), re-interpret on render without re-parsing — stored `timestamp` is always Unix ms in the local zone the file was produced in.

**Malformed headers** (regex matches `^\[LEVEL\] ` but internal structure fails further parsing): the entry still starts here, component is `"<unparsed>"`, message is the full header line, body continues until the next start-of-entry.

## 5. JSON body

Every line between the start-of-entry line and the next start-of-entry (or EOF) is body. The body is attempted as JSON:

1. Concatenate body lines with `\n` preserved.
2. If the concatenated body starts with `{` or `[` after trimming leading whitespace, call `JSON.parse`.
3. On parse success: store parsed object as `LogEntry.json`; set `LogEntry.jsonMalformed = false`.
4. On parse failure: store the raw body text as `LogEntry.payload`; set `LogEntry.jsonMalformed = true`.
5. If the body does not start with `{` or `[`: it is plain text. Store as `LogEntry.payload`, leave `jsonMalformed` unset.

**Recovery rule:** malformed JSON entries are NEVER dropped. They render in the Log Stream with a muted-orange left border and `jsonMalformed` tooltip. Citations to malformed entries still work (byte-offset based).

## 6. Correlation field extraction

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

## 7. Citation locator fields

For every produced `LogEntry`, the parser must populate:

| Field | Semantics |
|---|---|
| `id` | Sequential index within this parse session. NOT stable across re-parse. |
| `fileName` | Source file name (as imported). Stable. |
| `lineNumber` | 1-based line number of the start-of-entry line. Display locator. |
| `byteOffset` | Byte offset of the start-of-entry line's first char. Stable citation locator. |

`byteOffset` is the canonical citation locator because:
- Line numbers drift if the same file is re-saved with different line endings.
- Line numbers drift if the parser's entry-grouping rules change.
- Byte offsets are immutable as long as the file content is unchanged.

## 8. Performance contract

- Streaming: chunked read in 2 MB chunks (existing path in `parser.ts`). Parser must not require the full file in memory.
- JSON body buffering: accumulate body lines until the next start-of-entry, then call `JSON.parse` once. Do not attempt incremental JSON parsing.
- Target throughput: ≥ 40 MB/sec on the Phase 01a benchmark harness hardware.

## 9. Test fixtures (Phase 02 must include)

- `tests/fixtures/oc/canonical.log` — 50 entries, valid JSON bodies, full field coverage.
- `tests/fixtures/oc/malformed.log` — 10 entries, half with malformed JSON, half with missing correlation fields.
- `tests/fixtures/oc/mixed-levels.log` — ERR, WARN, INFO, DEBUG interleaved.
- `tests/fixtures/oc/streaming-50mb.log.gz` — compressed real MACC sample with synthetic PII scrubbed.

## 10. Non-goals

- Not parsing OC-format *binary* logs (if any exist). Text only.
- Not supporting the legacy OC format pre-2024 (if it existed). Current format only.
- Not reformatting entries — preserve raw lines in `rawTimestamp` and `payload`.
- Not inferring missing timestamp fields. If timestamp fails to parse, `timestamp = 0` and `rawTimestamp = raw string`.
