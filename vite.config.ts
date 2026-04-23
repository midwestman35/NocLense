import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative asset paths for desktop packaging
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy libraries into separate chunks for faster initial load
          'pdf-worker': ['pdfjs-dist'],
          'zip-lib': ['jszip'],
          'react-vendor': ['react', 'react-dom'],
          'virtual-list': ['@tanstack/react-virtual'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      '**/.tmp-*/**',
      '**/.codex-beta-push/**',
      '**/reference/**',
      '**/src-tauri/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
      ],
    },
  },
})
