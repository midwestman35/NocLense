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
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy libraries into separate chunks for faster initial load on Vercel
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
      // Proxy Jira API calls in dev to avoid CORS
      '/jira-proxy': {
        target: `https://${env.VITE_JIRA_SUBDOMAIN || 'placeholder.atlassian.net'}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jira-proxy/, ''),
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const auth = req.headers['authorization'];
            if (auth) proxyReq.setHeader('Authorization', auth as string);
          });
        },
      },
      // Proxy Datadog API calls in dev to avoid CORS
      '/datadog-proxy': {
        target: `https://api.${env.VITE_DATADOG_SITE || 'datadoghq.com'}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/datadog-proxy/, ''),
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const ddApiKey = req.headers['dd-api-key'];
            const ddAppKey = req.headers['dd-application-key'];
            if (ddApiKey) proxyReq.setHeader('DD-API-KEY', ddApiKey as string);
            if (ddAppKey) proxyReq.setHeader('DD-APPLICATION-KEY', ddAppKey as string);
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
