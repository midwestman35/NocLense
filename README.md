# NocLense (formerly LogScrub)

NocLense is a modern, high-performance **browser-based** log analysis tool designed specifically for reviewing SIP and system logs. It provides a clean, dark-mode interface for visualizing large log files, with specialized features for telecommunications debugging.

🌐 **100% Browser-Based** - No installation required, runs entirely in your browser!

## Features

-   **🌐 Browser-Based**: Runs entirely in your browser - no installation, no security warnings!
-   **🔒 Privacy-First**: All processing happens locally - files never leave your computer
-   **⚡ High Performance**: Built with `@tanstack/react-virtual` to handle thousands of log lines without lag
-   **📊 Timeline Visualization**: Interactive scrubber to visualize the density of events and errors over time
-   **📞 SIP/VoIP Awareness**: Automatic highlighting of SIP methods (INVITE, BYE, etc.) and coloring based on call flow
-   **🔍 Correlation Sidebar**: Filter by Call IDs, Report IDs, Operator IDs, Extension IDs, and Station IDs
-   **🌊 Call Flow Viewer**: Visualize SIP call flows with participant tracking
-   **📝 Detailed Inspection**: Expand any log row to view the full JSON payload or raw message content
-   **🎯 Smart Filtering**: Multiple filter options including SIP-only, component filters, and text search
-   **🧹 Message Cleanup**: Automatically simplifies component names and messages for better readability

### 🔍 Smart Filter

The **Smart Filter** toggle is designed to instantly clear clutter from your view so you can focus on the important logic of a call or system event.

When enabled, it **hides**:
1.  **DEBUG Logs**: All messages with the `DEBUG` severity level.
2.  **Heartbeats**: All SIP `OPTIONS` messages and internal "keep-alive" checks (e.g., messages containing "OPTIONS sip:").

Disable the Smart Filter if you need to trace every single packet or debug low-level connectivity issues.

## Quick Start

### Option 1: Use Online (Recommended)
Deploy to your preferred hosting service (see [WEB_DEPLOYMENT.md](./WEB_DEPLOYMENT.md)):
- **Netlify**: Drag & drop the `dist/` folder to [Netlify Drop](https://app.netlify.com/drop)
- **Vercel**: Connect your GitHub repo at [vercel.com](https://vercel.com)
- **GitHub Pages**: Follow the guide in WEB_DEPLOYMENT.md

### Option 2: Run Locally
```bash
# Install dependencies
npm install

# Development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Using the App

1.  **Load Logs**: Drag and drop a `.log` or `.txt` file onto the window, or click to browse
2.  **Filter & Navigate**:
    -   Use the **Search Bar** to filter by Call-ID, component name, or message text
    -   Use the **Correlation Sidebar** to filter by specific IDs (Call IDs, Report IDs, etc.)
    -   Use the **Timeline** at the bottom to jump to specific points in time
    -   Click on any log row to see its full details
    -   Click "Flow" button on a log with a Call ID to visualize the SIP call flow

## Development

This project is built with:
-   React 19
-   TypeScript
-   Vite
-   Tailwind CSS

### Available Scripts

```bash
npm run dev          # Start development server (http://localhost:5173)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
```

## Deployment

See [WEB_DEPLOYMENT.md](./WEB_DEPLOYMENT.md) for detailed deployment instructions for:
- GitHub Pages
- Netlify
- Vercel
- Local serving
- Custom web servers

## Privacy & Security

✅ **100% Client-Side Processing** - All log parsing and analysis happens in your browser  
✅ **No Data Transmission** - Files are never uploaded to any server  
✅ **Works Offline** - After initial page load, works completely offline  
✅ **No Installation Required** - Runs in any modern browser
