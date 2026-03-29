/**
 * Server URL configuration for NocLense backend.
 * In development: localhost:3001
 * In production: Railway URL (set via env var)
 */

const DEFAULT_DEV_URL = 'http://localhost:3001';

export function getServerUrl(): string {
  // Vite exposes env vars prefixed with VITE_
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  return DEFAULT_DEV_URL;
}
