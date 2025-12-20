# Changelog

All notable changes to the LogScrub project will be documented in this file.

## [v0.2.0] - 2025-12-20

### Added
- **Multi-File Merging**: Support for dragging and dropping multiple log files. New files are automatically merged and sorted by timestamp into the existing view (#18).
- **Source Tracking**: Added tooltips to log timestamps to identify which source file a log entry came from.
- **SIP Only Filter**: New toggle in the filter bar to strictly show SIP signaling messages, hiding all application/system logs (#6).
- **Call-ID Color Coding**:
    - Automatic extraction of `Call-ID` headers from SIP messages.
    - deterministic color generation for each unique Call-ID.
    - Colored visual indicators in both the log list (pill) and the timeline validation bar (#5, #14).
- **Clear Logs**: Added a "Trash" button to the filter bar to reset the application state.
- **Documentation**: Comprehensive `README.md` covering all features, including the "Smart Filter" logic.

### Fixed
- **Timeline Scrubber**:
    - Fixed Start/End time calculation bug where range was incorrect for unsorted logs (#12).
    - Fixed Time Labels to strictly use 24-hour format with milliseconds to match log timestamps (#11).
    - Fixed a critical UI crash caused by missing variable destructuring (#13).
- **UI Layout**:
    - Fixed application resizing to correctly fill the viewport width/height.
    - Fixed scrolling issues by correcting flexbox constraints and removing `no-scrollbar` classes.
- **Virtualization**: Fixed issue where expanding a log row caused content to be cut off or overlapped by subsequent rows (implemented dynamic row height measurement) (#0).

### Optimized
- **Parsing**: Offloaded log file parsing to a **Web Worker** to keep the UI responsive during large file loads (#28).
- **Search**: Implemented **debounce** (300ms) on the filter input to prevent main-thread blocking while typing (#29).
- **Timeline**: Optimized time range calculation from O(N) to O(1) by leveraging sorted log data (#30).

### Infrastructure
- **Shared Code**: Extracted color generation logic into `src/utils/colors.ts` for consistency across components.
- **Parser**: Enhanced regex and parsing logic to support `FileName` and `Call-ID` extraction.
