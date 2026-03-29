import { useState } from 'react';
import { Settings, X, Eye, EyeOff } from 'lucide-react';
import { loadAiSettings, saveAiSettings, type AiSettings } from '../../store/aiSettings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AiSettings) => void;
}

export default function AiSettingsModal({ isOpen, onClose, onSave }: Props) {
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [showToken, setShowToken] = useState(false);

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
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card)', borderRadius: '12px', padding: '24px',
          width: '100%', maxWidth: '480px', border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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
              backgroundColor: 'var(--success)', border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
