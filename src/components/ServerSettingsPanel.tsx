/**
 * ServerSettingsPanel — UNAVAILABLE
 *
 * Server mode foundation is retained in the codebase but removed from the UI
 * until backend architecture plans are finalized. Do not wire this into any
 * layout or dialog until a decision is made on the backend approach.
 */
import { useState, useEffect, useCallback } from 'react';
import { Server, CheckCircle2, XCircle, Unplug, Plug } from 'lucide-react';
import { loadServerConfig, saveServerConfig, checkServerHealth, type ServerConfig } from '../services/serverService';
import { useLogContext } from '../contexts/LogContext';
import Spinner from './ui/Spinner';

export default function ServerSettingsPanel() {
  const { setServerMode } = useLogContext();
  const [config, setConfig] = useState<ServerConfig>(loadServerConfig);
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const testConnection = useCallback(async (url?: string) => {
    setStatus('checking');
    setStatusMessage('Testing connection...');
    try {
      const testConfig = { ...config, baseUrl: url || config.baseUrl };
      // Temporarily save to let checkServerHealth use it
      saveServerConfig(testConfig);
      const health = await checkServerHealth();
      if (health.status === 'ok' || health.status === 'degraded') {
        setStatus('connected');
        setStatusMessage(
          health.status === 'ok'
            ? `Connected. ${health.database.logCount.toLocaleString()} logs in database.`
            : `Degraded: DB=${health.database.connected ? 'ok' : 'down'}, Blob=${health.blob.connected ? 'ok' : 'down'}`
        );
      } else {
        setStatus('error');
        setStatusMessage('Server returned unexpected status');
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [config]);

  useEffect(() => {
    if (config.enabled && config.baseUrl) {
      testConnection();
    }
  }, []);

  const handleToggle = () => {
    const newEnabled = !config.enabled;
    const updated = { ...config, enabled: newEnabled };
    setConfig(updated);
    saveServerConfig(updated);
    setServerMode(newEnabled);
    if (newEnabled) {
      testConnection();
    } else {
      setStatus('idle');
      setStatusMessage('');
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...config, baseUrl: e.target.value };
    setConfig(updated);
    saveServerConfig(updated);
  };

  const statusIcon = {
    idle: <Unplug size={14} className="text-[var(--muted-foreground)]" />,
    checking: <Spinner size="md" className="text-[var(--muted-foreground)]" label="Checking" />,
    connected: <CheckCircle2 size={14} className="text-emerald-500" />,
    error: <XCircle size={14} className="text-red-500" />,
  }[status];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-[var(--muted-foreground)]" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Server Mode</h3>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            config.enabled
              ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {config.enabled ? <Plug size={12} /> : <Unplug size={12} />}
          {config.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      <p className="text-[11px] text-[var(--muted-foreground)]">
        Offload log parsing to a backend server. Large files are parsed server-side and queried via API instead of loading into browser memory.
      </p>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--muted-foreground)]">Server URL</label>
        <input
          type="url"
          value={config.baseUrl}
          onChange={handleUrlChange}
          placeholder="https://noclense-server.vercel.app"
          className="w-full rounded border border-[var(--border)] bg-[var(--input)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={() => testConnection()}
        disabled={status === 'checking' || !config.baseUrl}
        className="w-full rounded border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
      >
        {status === 'checking' ? 'Testing...' : 'Test Connection'}
      </button>

      {statusMessage && (
        <div className="flex items-start gap-2 rounded bg-[var(--muted)] px-2.5 py-2 text-[11px]">
          {statusIcon}
          <span className="text-[var(--muted-foreground)]">{statusMessage}</span>
        </div>
      )}

      {config.sessionId && (
        <div className="rounded border border-[var(--border)] px-2.5 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Active Session</div>
          <div className="mt-0.5 font-mono text-[11px] text-[var(--foreground)]">{config.sessionId.slice(0, 8)}...</div>
        </div>
      )}
    </div>
  );
}
