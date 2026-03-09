# Changelog

All notable changes to the NocLense (LogScrub) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-08 — UI Overhaul & Multi-Provider AI

### Added — UI System
- New monochrome design token system (`src/styles/tokens.css`) with light + dark themes
- Component library: Button, Card, Badge, Input, Separator, ScrollArea, Tooltip, Dialog, Sheet, DropdownMenu, Sidebar, Header, ResizeHandle
- Motion animations: fade-up entrances, sidebar collapse, modal scale-in, sheet slide, stagger lists (via `motion` library)
- AI sidebar with integrated chat (AISidebar) and settings/chat toggle panels
- DM Sans (UI) and JetBrains Mono (data) typography loaded via `@fontsource`
- Icon rail (`IconRail`) with collapsible sidebar panels (`SidebarPanel`)
- Investigation panel layout with resizable split panes (`InvestigationPanels`)

### Added — AI & Models
- **Gemini 3.1 support**: `gemini-3.1-flash-lite-preview` set as new default; `gemini-3.1-pro-preview` available; deprecated 1.5/2.0 models auto-migrated
- **Claude provider**: Full Claude 4.x support (Sonnet 4.6, Haiku 4.5, Opus 4.6) via `ClaudeProvider`
- **Codex provider**: OpenAI Codex integration via `CodexProvider`
- **Provider registry**: `ProviderRegistry` factory for multi-provider abstraction in `src/services/providers/`
- **AI onboarding wizard**: Step-by-step API key setup with consent, provider selection, and test validation (`src/components/onboarding/`)
- **Electron secure API key storage**: Keys encrypted with Electron `safeStorage` API; never written to disk in plaintext (`src/store/apiKeyStorage.ts`)

### Added — Workspace & Case Management
- **Workspace import**: Load `.noclense` workspace packages from a previous session (`WorkspaceImportPanel`)
- **Export pack builder**: Assemble and export case data as structured ZIP packages (`exportPackBuilder.ts`, `zipBuilder.ts`)
- **Case context**: Persistent case state (title, notes, tags, analyst) with reducer-based management (`src/store/caseContext.tsx`, `caseReducer.ts`)
- **Case panel & header**: UI for creating and editing case metadata (`src/components/case/`)
- **Workspace import service**: Parse and restore saved workspace packages (`importService.ts`)
- **Redaction**: PII/sensitive field scrubbing before export or AI context (`src/services/redactor.ts`)
- **Query generator**: Structured log query generation for AI prompts (`queryGenerator.ts`)

### Added — Developer Tooling
- **Agent configuration**: `.claude/` directory with `settings.json`, `hooks/`, `skills/` (code-review, refactor, release)
- **`/cost-estimate` command**: Slash command for estimating codebase development cost with Claude ROI analysis (`.claude/commands/cost-estimate.md`)
- **Reorganized project structure**: Scripts → `tools/scripts/`, reference docs → `docs/`, loose analysis files → `tools/`
- **`AGENTS.md`**: Agent guidelines and operational context for Claude Code sessions

### Changed
- Layout restructured to ChatGPT-style: header + left icon rail + main content area + resizable panels
- All components migrated from ad-hoc Tailwind to new design token system
- Modals replaced with animated Dialog component
- Timeline rendered via Canvas instead of DOM markers (perf + Electron CJS fix)
- `LogContext` architecture refactored to support both in-memory and IndexedDB modes
- `docs/` reorganized: `architecture/`, `decisions/`, `plans/`, `releases/`, `runbooks/`

### Removed
- Timeline Scrubber component (replaced by AI-first analysis approach)
- Carbyne branding
- Red alert theme
- Old CSS variable system
- Deprecated Gemini 1.5 / 2.0 model entries

---

## [1.7.0] - 2026-02-07

### Added - AI-Powered Log Analysis (Google Gemini 3)
- ✅ **AI Assistant** - Chat interface for asking questions about your logs; accessible via header button or Cmd/Ctrl+K
- ✅ **AI Settings Panel** - Configure API key, model selection (Gemini 3 Flash/Pro), usage stats, and daily limits
- ✅ **Analyze Visible Logs** - One-click analysis of filtered logs from the LogViewer toolbar
- ✅ **Explain with AI** - Contextual analysis for selected logs in the details panel (log + 5 before/after)
- ✅ **Correlation Analysis** - Analyze logs by Call-ID, Report ID, or other correlations from the sidebar
- ✅ **Prompt Templates** - Smart prompt engineering for error analysis, pattern recognition, call flow, and timeline analysis
- ✅ **Gemini 3 Support** - Default model set to Gemini 3 Flash; Gemini 3 Pro available for complex analysis
- ✅ **Usage Tracking** - Daily request counter and quota warnings (free tier: 1,500 requests/day)
- ✅ **Model Migration** - Automatic upgrade from deprecated Gemini 1.5/2.0 models to Gemini 3

### Changed
- **Error Handling** - Comprehensive handling for invalid keys, rate limits, network errors, model unavailability, and empty logs
- **API Key Validation** - Test & Save validates keys against Gemini API before storing
- **Empty Logs UX** - AI buttons disabled with tooltip when no logs loaded; context indicator shows log count or sampling notice for large sets

### Fixed
- **404 Model Errors** - Detects deprecated/unavailable models (1.5-flash, 2.0-flash) and surfaces actionable message; defaults to Gemini 3 Flash
- **Malformed Responses** - Graceful handling of empty or invalid AI responses
- **Retry Logic** - Exponential backoff for transient network failures; no retry for auth/quota errors

### Security & Privacy
- Opt-in AI features (require enable toggle)
- API key stored in localStorage with security warning
- Privacy notice explains what data is sent to Google
- No hardcoded keys; API key never logged to console

## [1.6.0] - 2026-02-05

### Added - UI Improvements & Enhanced Error Detection
- ✅ **SIP Column** - New dedicated "SIP" column in log viewer showing SIP methods/response codes (OPTIONS, INVITE, 200 OK, etc.) with color-coded badges
- ✅ **Individual File Removal** - Added "X" button to remove individual log files from the sidebar without clearing all data
- ✅ **Message Truncation** - Log messages now truncate at 150 characters in the main view for cleaner display; full message visible on click
- ✅ **Case-Insensitive Level Matching** - Parser now handles `[error]`, `[Error]`, `[ERROR]` identically
- ✅ **Level Aliases** - Recognizes alternative level names: CRITICAL, FATAL, SEVERE, ERR → ERROR; WARNING → WARN; TRACE, VERBOSE → DEBUG
- ✅ **JSON Level Extraction** - Detects error levels from JSON payload fields (level, severity, logLevel, error, exception, stackTrace)
- ✅ **SIP Error Detection** - SIP 4xx responses marked as WARN, 5xx/6xx responses marked as ERROR (including Homer SIP exports)

### Changed
- **Log Grid Layout** - Updated from 5-column to 6-column layout: Expand | Timestamp | Level | Service | SIP | Message
- **Reduced Visual Noise** - Removed generic "LOG" badge; compacted Call-ID display to color dot + 8 chars; cncID/messageID shown as subtle colored dots
- **Cleaner Message Column** - Fewer inline badges, tighter spacing, category badges only shown for non-LOG types (JSON, specific messageTypes)
- **Report ID Display** - Compact format "#9092610" instead of "report 9092610"

### Fixed
- **Homer SIP Levels** - Homer SIP exports now correctly detect ERROR/WARN levels from SIP response codes instead of all being INFO
- **Missing ERRORs** - Logs using alternative level names (CRITICAL, FATAL, etc.) or lowercase levels are now properly captured by ERROR filter

## [1.5.2] - 2026-01-29

### Fixed
- **UI not loading after file upload** - Fixed race where `clearAllData()` (async) was triggered by `setLogs([])` but not awaited; it could overwrite newly loaded logs with `[]`, leaving the empty state visible instead of the log list. File upload now awaits `clearAllData()` before parsing and `setLogs(allLogs)`.
- **LogContext hook order** - Moved `useState(timelineZoomRange)` before the `useEffect` that calls `setTimelineZoomRange`, and moved `filteredLogs` computation before `collapsedViewList` (which depends on it) to fix declaration-order errors.

### Changed
- **Bootstrap error handling** - Added `.catch()` to the `loadServiceMappings().then(...)` chain in `main.tsx` so bootstrap failures are logged.

## [1.5.1] - 2026-01-29

### Changed
- **Wrap text by default** - Removed the "Wrap Text" toggle from the filter bar; log text is now always wrapped for better readability.

## [1.5.0] - 2026-01-20

### Added - IndexedDB Storage for Large Files
- ✅ **IndexedDB Manager** - New IndexedDB wrapper (`src/utils/indexedDB.ts`) for efficient log storage and querying with indexes on timestamp, component, callId, fileName, level, SIP methods, and correlation fields
- ✅ **Automatic Mode Detection** - Seamlessly switches between in-memory mode (small files) and IndexedDB mode (large files >50MB) for optimal performance
- ✅ **IndexedDB Filtering** - All filters (component, SIP, correlation, text search) now work with IndexedDB-stored logs
- ✅ **Lazy Loading** - Only loads visible/filtered logs into memory, dramatically reducing memory footprint
- ✅ **Efficient Querying** - IndexedDB indexes enable fast filtering by timestamp range, component, callId, and other fields
- ✅ **Correlation Data from IndexedDB** - Sidebar correlation data (Call IDs, Report IDs, etc.) computed from IndexedDB logs

### Fixed
- **Memory Exhaustion** - Fixed memory crashes for very large files (740MB+) by storing logs in IndexedDB instead of React state
- **Large File Support** - Can now handle files of any size without browser crashes (tested with 740MB+ files)
- **Filtering Performance** - Optimized filtering for IndexedDB mode with debounced queries

### Changed
- **Parser Integration** - Parser automatically writes to IndexedDB for files >50MB during parsing
- **LogContext Architecture** - Refactored to support both in-memory and IndexedDB modes with automatic detection
- **Backward Compatibility** - Small files continue to use fast in-memory processing for optimal performance

## [1.4.0] - 2026-01-20

### Added - Memory Optimizations for Large Files
- ✅ **Streaming Parser** - New streaming parser processes files in 2MB chunks without accumulating full text in memory, reducing memory usage by ~99% during parsing
- ✅ **Memory Estimation** - Estimates memory usage before parsing (file size × 2.5) to help users understand resource requirements
- ✅ **Enhanced Warnings** - Progressive warning system for files >50MB, >200MB, and >500MB with memory estimates
- ✅ **Confirmation Dialog** - Requires user confirmation before processing files >500MB to prevent Chrome crashes

### Fixed
- **Chrome Memory Crashes** - Fixed "out of memory" crashes when processing large log files (740MB+) by implementing streaming parser
- **Array Operations** - Optimized array operations for large datasets by replacing spread operators with `concat()` to prevent "Maximum call stack size exceeded" errors
- **Memory Efficiency** - Reduced memory usage from ~1.5GB-7GB+ to ~50-100MB during parsing for 740MB files

### Changed
- **Automatic Streaming** - Files >50MB (non-CSV) now automatically use streaming parser for better memory efficiency
- **Memory Thresholds** - Updated file size thresholds: Warning at 50MB, Strong warning at 200MB, Critical warning at 500MB

## [1.3.1] - 2026-01-20

### Fixed
- **Timestamp Parsing with Milliseconds** - Fixed issue where timestamps with comma-separated milliseconds (e.g., `5:04:57 AM,388`) were not parsed correctly, causing log entries to display file upload time instead of actual log message timestamps. The parser now correctly extracts and applies milliseconds to timestamps.

## [1.2.0] - 2026-01-06

### Added - Timeline v3 & Comprehensive SIP Support
- ✅ **Timeline Multi-track Lanes** - Call segments now automatically stack in separate lanes to prevent visual overlap.
- ✅ **Effortless Zoom & Pan** - Re-enabled scroll-to-zoom with the mouse wheel. Added **Shift + Wheel** for horizontal panning.
- ✅ **SIP Flow Hover Tooltip** - Hovering over timeline markers reveals the full sequence of SIP messages for that specific `callId`.
- ✅ **Full SIP Method/Code Support** - Robust parsing for all SIP methods (INVITE, BYE, ACK, etc.) and all response classes (1xx-6xx).
- ✅ **Granular SIP Filtering** - New filtering categories for Requests, Success, Provisional, Error, Options, and Keep-Alive.
- ✅ **Synchronized Viewport Indicator** - The white viewport bar now stays in perfect sync regardless of log sort order (Asc/Desc).
- ✅ **Marker Highlighting** - Selected logs now glow with a golden highlight on the timeline for easy tracking.
- ✅ **Floating File Labels** - Hovering over file segments in the top strip displays the source file name.
- ✅ **Resizable Timeline** - Added a drag-handle to adjust the height of the timeline panel.

### Changed
- **Default View Mode** - Timeline now defaults to "Filtered" mode for a more focused initial view.
- **Improved UI Controls** - Replaced standard checkboxes with tab-based controls for scope switching and refined the time range display.
- **Global Sorting** - Implemented robust background sorting to ensure timeline calculations are always accurate.

### Fixed
- **Blank Timeline Issue** - Resolved bugs that caused the timeline to disappear when switching between single-file and full-scope views.
- **Reverse Sort Inconsistencies** - Fixed viewport indicator and scrubbing logic to support descending sort orders correctly.
- **Filter Syncing** - Selected logs now bypass filters to ensure they are always visible in the viewer when clicked on the timeline.

## [1.1.0] - 2025-12-31

### Added - Multi-File Support Implementation
- ✅ **Multiple file selection** - File inputs now support selecting multiple files at once
- ✅ **File merging** - Multiple log files are automatically merged and sorted chronologically
- ✅ **ID conflict resolution** - Log IDs are automatically adjusted to prevent conflicts when merging files
- ✅ **File size validation** - Files are validated before processing with size warnings
- ✅ **File size warnings** - Users are warned about large files (50MB+) that may impact performance
- ✅ **Error handling** - Improved error messages for invalid files and parsing failures
- ✅ **UI feedback** - Error and warning messages displayed in the UI with dismiss functionality
- ✅ **Append mode** - New files are appended to existing logs instead of replacing them

### Changed
- **File upload behavior** - Opening new files now appends to existing logs instead of replacing them
- **Button text** - "Open File" button text changes to "Open File(s)" when logs are loaded
- **FileUploader component** - Now supports drag-and-drop of multiple files
- **Parser** - Now accepts optional `startId` parameter to handle ID offsets when merging files

### Technical Details
- File size limits: Warning at 50MB, Strong warning at 200MB (no hard limit)
- ID management: Uses max existing ID + 1 as starting point for new files
- File validation: Checks file extension and size before processing
- Error recovery: Invalid files are rejected with clear error messages

---

## [Unreleased]

### Added
- (Features will be added here as they are implemented)

### Changed
- (Changes to existing functionality will be documented here)

### Fixed
- (Bug fixes will be documented here)
