import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Use absolute paths for web deployment (works with most hosting)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Optimize for production
    minify: 'esbuild',
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: false, // Allow other ports if 5173 is taken
    open: true, // Open browser automatically in dev mode
  },
  preview: {
    port: 4173,
    open: true, // Open browser when previewing
  }
})
