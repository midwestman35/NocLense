# NocLense

LogScrub is a modern, high-performance log analysis tool designed specifically for reviewing SIP and system logs. It provides a clean, dark-mode interface for visualizing large log files, with specialized features for telecommunications debugging.

## Features

-   **High Performance Rendering**: Built with `@tanstack/react-virtual` to handle thousands of log lines without lag.
-   **Timeline Visualization**: Interactive scrubber to visualize the density of events and errors over time.
-   **SIP/VoIP Awareness**: Automatic highlighting of SIP methods (INVITE, BYE, etc.) and coloring based on call flow.
-   **Detailed Inspection**: Expand any log row to view the full JSON payload or raw message content.
-   **Smart Filtering**: One-click noise reduction.

### 🔍 Smart Filter

The **Smart Filter** toggle is designed to instantly clear clutter from your view so you can focus on the important logic of a call or system event.

When enabled, it **hides**:
1.  **DEBUG Logs**: All messages with the `DEBUG` severity level.
2.  **Heartbeats**: All SIP `OPTIONS` messages and internal "keep-alive" checks (e.g., messages containing "OPTIONS sip:").

Disable the Smart Filter if you need to trace every single packet or debug low-level connectivity issues.

## Getting Started

1.  **Open the App**: Launch LogScrub in your browser.
2.  **Load Logs**: Drag and drop a `.log` or `.txt` file onto the window, or click **"Open File"** in the top right.
3.  **Navigate**:
    -   Use the **Search Bar** to filter by Call-ID, component name, or message text.
    -   Use the **Timeline** at the bottom to jump to specific points in time.
    -   Click on any log row to see its full details.

## Development

This project is built with:
-   React 18
-   TypeScript
-   Vite
-   Tailwind CSS

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```
