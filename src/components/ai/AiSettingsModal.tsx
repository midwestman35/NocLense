import { useState } from 'react';
import { Settings, X, Eye, EyeOff, BarChart3, RotateCcw } from 'lucide-react';
import { loadAiSettings, saveAiSettings, type AiSettings } from '../../store/aiSettings';
import { loadTokenUsage, resetTokenUsage, formatTokenCount } from '../../utils/tokenEstimator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AiSettings) => void;
}

export default function AiSettingsModal({ isOpen, onClose, onSave }: Props) {
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [showToken, setShowToken] = useState(false);
  const [tokenUsage, setTokenUsage] = useState(() => loadTokenUsage());

  if (!isOpen) return null;

  const handleSave = () => {
    saveAiSettings(settings);
    onSave(settings);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'color-mix(in srgb, var(--bg-0) 78%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card)', borderRadius: '12px', padding: '24px',
          width: '100%', maxWidth: '480px', border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-floating)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={18} style={{ color: 'var(--success)' }} />
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--foreground)' }}>
              Unleashed AI Settings
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '6px' }}>
              API Endpoint
            </label>
            <input
              type="text"
              value={settings.endpoint}
              onChange={e => setSettings(s => ({ ...s, endpoint: e.target.value }))}
              placeholder="https://e-api.unleash.so"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
                backgroundColor: 'var(--input)', border: '1px solid var(--border)',
                color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
              Your Unleash tenant base URL (without /chats)
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '6px' }}>
              Bearer Token
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                value={settings.token}
                onChange={e => setSettings(s => ({ ...s, token: e.target.value }))}
                placeholder="Paste your API token here"
                style={{
                  width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', fontSize: '13px',
                  backgroundColor: 'var(--input)', border: '1px solid var(--border)',
                  color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => setShowToken(v => !v)}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)',
                }}
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
              Get your token from the Unleash Admin Center under API Keys
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '6px' }}>
              Assistant ID <span style={{ color: 'var(--muted-foreground)', fontWeight: '400' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={settings.assistantId}
              onChange={e => setSettings(s => ({ ...s, assistantId: e.target.value }))}
              placeholder="Leave blank to use default assistant"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
                backgroundColor: 'var(--input)', border: '1px solid var(--border)',
                color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
              Find in Unleash Admin Center &rarr; Assistants &rarr; copy last part of URL
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '6px' }}>
              Account Email
            </label>
            <input
              type="email"
              value={settings.userEmail}
              onChange={e => setSettings(s => ({ ...s, userEmail: e.target.value }))}
              placeholder="your@email.com"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
                backgroundColor: 'var(--input)', border: '1px solid var(--border)',
                color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
              Your Unleash account email (required for impersonation tokens)
            </p>
          </div>
        </div>

        {/* Zendesk Section */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--foreground)', marginBottom: '12px' }}>
            Zendesk Integration <span style={{ fontWeight: '400', color: 'var(--muted-foreground)' }}>(optional)</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Subdomain
              </label>
              <input
                type="text"
                value={settings.zendeskSubdomain}
                onChange={e => setSettings(s => ({ ...s, zendeskSubdomain: e.target.value }))}
                placeholder="yourcompany"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                The part before .zendesk.com in your URL
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Agent Email
              </label>
              <input
                type="email"
                value={settings.zendeskEmail}
                onChange={e => setSettings(s => ({ ...s, zendeskEmail: e.target.value }))}
                placeholder="agent@yourcompany.com"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                API Token
              </label>
              <input
                type="password"
                value={settings.zendeskToken}
                onChange={e => setSettings(s => ({ ...s, zendeskToken: e.target.value }))}
                placeholder="Zendesk API token"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                Admin Center → Apps &amp; Integrations → Zendesk API → API token
              </p>
            </div>
          </div>
        </div>

        {/* Jira Section */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--foreground)', marginBottom: '12px' }}>
            Jira Integration <span style={{ fontWeight: '400', color: 'var(--muted-foreground)' }}>(optional — for escalation tickets)</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Jira Subdomain
              </label>
              <input
                type="text"
                value={settings.jiraSubdomain}
                onChange={e => setSettings(s => ({ ...s, jiraSubdomain: e.target.value }))}
                placeholder="yourcompany.atlassian.net"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Jira Email
              </label>
              <input
                type="email"
                value={settings.jiraEmail}
                onChange={e => setSettings(s => ({ ...s, jiraEmail: e.target.value }))}
                placeholder="you@yourcompany.com"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Jira API Token
              </label>
              <input
                type="password"
                value={settings.jiraToken}
                onChange={e => setSettings(s => ({ ...s, jiraToken: e.target.value }))}
                placeholder="Jira API token"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                id.atlassian.com → Security → API tokens
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Project Key
              </label>
              <input
                type="text"
                value={settings.jiraProjectKey}
                onChange={e => setSettings(s => ({ ...s, jiraProjectKey: e.target.value.toUpperCase() }))}
                placeholder="e.g. NOC"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                The short key shown in your Jira project URL (e.g. /projects/NOC)
              </p>
            </div>
          </div>
        </div>

        {/* Datadog Section */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--foreground)', marginBottom: '12px' }}>
            Datadog Integration <span style={{ fontWeight: '400', color: 'var(--muted-foreground)' }}>(optional — enriches AI diagnosis)</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                API Key
              </label>
              <input
                type="password"
                value={settings.datadogApiKey}
                onChange={e => setSettings(s => ({ ...s, datadogApiKey: e.target.value }))}
                placeholder="Datadog API key"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                Organization Settings → API Keys
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Application Key
              </label>
              <input
                type="password"
                value={settings.datadogAppKey}
                onChange={e => setSettings(s => ({ ...s, datadogAppKey: e.target.value }))}
                placeholder="Datadog application key"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                Organization Settings → Application Keys
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Site
              </label>
              <input
                type="text"
                value={settings.datadogSite}
                onChange={e => setSettings(s => ({ ...s, datadogSite: e.target.value }))}
                placeholder="datadoghq.com"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                Your Datadog region: datadoghq.com, datadoghq.eu, us3.datadoghq.com, etc.
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Default Hosts / Stations
              </label>
              <input
                type="text"
                value={settings.datadogDefaultHosts}
                onChange={e => setSettings(s => ({ ...s, datadogDefaultHosts: e.target.value }))}
                placeholder="station1, station2, pos-dispatch-01"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                Comma-separated. Pre-fills the host filter in Diagnose — agent can edit per incident.
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--card-foreground)', marginBottom: '5px' }}>
                Default Indexes
              </label>
              <input
                type="text"
                value={settings.datadogDefaultIndexes}
                onChange={e => setSettings(s => ({ ...s, datadogDefaultIndexes: e.target.value }))}
                placeholder="main (leave blank for all)"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>
                Comma-separated index names. Leave blank to search all indexes.
              </p>
            </div>
          </div>
        </div>

        {/* Token Usage Tracker */}
        <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BarChart3 size={14} style={{ color: 'var(--muted-foreground)' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>Token Usage (estimated)</span>
            </div>
            <button
              type="button"
              onClick={() => { resetTokenUsage(); setTokenUsage(loadTokenUsage()); }}
              title="Reset usage counter"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px',
                borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--muted)',
                fontSize: '10px', color: 'var(--muted-foreground)', cursor: 'pointer',
              }}
            >
              <RotateCcw size={10} /> Reset
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--muted)' }}>
              <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginBottom: '2px' }}>Input tokens</p>
              <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                {formatTokenCount(tokenUsage.totalInput)}
              </p>
            </div>
            <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--muted)' }}>
              <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginBottom: '2px' }}>Output tokens</p>
              <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                {formatTokenCount(tokenUsage.totalOutput)}
              </p>
            </div>
            <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--muted)' }}>
              <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginBottom: '2px' }}>API calls</p>
              <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                {tokenUsage.totalCalls}
              </p>
            </div>
          </div>
          {tokenUsage.totalCalls > 0 && (
            <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '6px' }}>
              Since {new Date(tokenUsage.firstCallAt).toLocaleDateString()} · Last call: {new Date(tokenUsage.lastCallAt).toLocaleString()}
            </p>
          )}
          <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '4px', fontStyle: 'italic' }}>
            Estimates based on ~4 chars/token. Actual usage may vary.
          </p>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500',
              backgroundColor: 'var(--muted)', border: '1px solid var(--border)',
              color: 'var(--muted-foreground)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              backgroundColor: 'var(--success)', border: 'none', color: 'var(--ink-0)', cursor: 'pointer',
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
