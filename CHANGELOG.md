# Changelog

All notable changes to the NocLense (LogScrub) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [Current State - Pre Multi-File Support]

### Current Features
- Single file upload (replaces existing logs)
- No file size limits or warnings
- Synchronous file parsing (blocks UI)
- Basic error handling (console only)

### Known Limitations
- Cannot load multiple files simultaneously
- No file size validation
- No progress indication for large files
- Opening a new file replaces existing logs

---

## [Future Releases]

### Added
- (Features will be added here as they are implemented)

### Changed
- (Changes to existing functionality will be documented here)

### Fixed
- (Bug fixes will be documented here)

### Security
- (Security improvements will be documented here)

