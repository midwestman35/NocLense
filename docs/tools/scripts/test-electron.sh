#!/bin/bash
# Quick test script for Electron setup

echo "🧪 Testing Electron Setup"
echo ""

# Check if port is free
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "⚠️  Port 5173 is in use. Killing process..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 2
fi

echo "✅ Starting Electron in development mode..."
echo "   - This will start Vite dev server"
echo "   - Electron window should open automatically"
echo "   - Press Ctrl+C to stop"
echo ""

npm run electron:dev

