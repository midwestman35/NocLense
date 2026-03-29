import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const zdSubdomain = env.VITE_ZENDESK_SUBDOMAIN || 'carbyne';

  return {
  plugins: [react()],
  base: './', // Important for Electron - use relative paths
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy Unleash API calls in dev to avoid CORS
      '/ai-proxy': {
        target: 'https://e-api.unleash.so',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai-proxy/, ''),
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const auth = req.headers['authorization'];
            if (auth) proxyReq.setHeader('Authorization', auth as string);
          });
        },
      },
      // Proxy Zendesk API calls in dev to avoid CORS
      '/zendesk-proxy': {
        target: `https://${zdSubdomain}.zendesk.com`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zendesk-proxy/, ''),
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const auth = req.headers['authorization'];
            if (auth) proxyReq.setHeader('Authorization', auth as string);
          });
        },
      },
    },
  },
  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
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
  };
})
