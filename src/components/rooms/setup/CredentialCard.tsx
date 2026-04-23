import { useState, type JSX } from 'react';
import { CheckCircle2, Database, KeyRound, Search, ShieldCheck } from 'lucide-react';
import type { AiSettings } from '../../../store/aiSettings';
import { Badge, Button, Card, CardContent, CardHeader, Input, Separator } from '../../ui';
import {
  VENDOR_LABELS,
  maskSecret,
  testVendorConnection,
  vendorConfigured,
  type ConnectionResult,
  type SetupContextDraft,
  type VendorId,
} from './setupRoomShared';

type FieldType = 'text' | 'email' | 'password';

interface FieldConfig {
  key: keyof AiSettings;
  label: string;
  placeholder: string;
  type?: FieldType;
}

interface CredentialCardProps {
  vendor: VendorId;
  settings: AiSettings;
  context: SetupContextDraft;
  onSettingsChange: (settings: AiSettings) => void;
  onSaved: () => void;
}

const FIELDS: Record<VendorId, FieldConfig[]> = {
  zendesk: [
    { key: 'zendeskSubdomain', label: 'Subdomain', placeholder: 'carbyne' },
    { key: 'zendeskEmail', label: 'Agent Email', placeholder: 'agent@example.com', type: 'email' },
    { key: 'zendeskToken', label: 'API Token', placeholder: 'Zendesk API token', type: 'password' },
  ],
  datadog: [
    { key: 'datadogApiKey', label: 'API Key', placeholder: 'Datadog API key', type: 'password' },
    { key: 'datadogAppKey', label: 'Application Key', placeholder: 'Datadog application key', type: 'password' },
    { key: 'datadogSite', label: 'Site', placeholder: 'datadoghq.com' },
    { key: 'datadogDefaultHosts', label: 'Default Hosts', placeholder: 'station-01, station-02' },
    { key: 'datadogDefaultIndexes', label: 'Default Indexes', placeholder: 'main, ops' },
  ],
  jira: [
    { key: 'jiraSubdomain', label: 'Atlassian Host', placeholder: 'company.atlassian.net' },
    { key: 'jiraEmail', label: 'Email', placeholder: 'agent@example.com', type: 'email' },
    { key: 'jiraToken', label: 'API Token', placeholder: 'Atlassian API token', type: 'password' },
    { key: 'jiraProjectKey', label: 'Project Key', placeholder: 'NOC' },
  ],
  confluence: [
    { key: 'jiraSubdomain', label: 'Atlassian Host', placeholder: 'company.atlassian.net' },
    { key: 'jiraEmail', label: 'Email', placeholder: 'agent@example.com', type: 'email' },
    { key: 'jiraToken', label: 'API Token', placeholder: 'Atlassian API token', type: 'password' },
    { key: 'confluenceSpaceId', label: 'Space ID', placeholder: '987654' },
    { key: 'confluenceParentPageId', label: 'Parent Page ID', placeholder: '123456789' },
  ],
};

const ICONS: Record<VendorId, JSX.Element> = {
  zendesk: <ShieldCheck size={14} />,
  datadog: <Database size={14} />,
  jira: <KeyRound size={14} />,
  confluence: <Search size={14} />,
};

export function CredentialCard({
  vendor,
  settings,
  context,
  onSettingsChange,
  onSaved,
}: CredentialCardProps): JSX.Element {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const configured = vendorConfigured(settings, vendor);
  const secretField = FIELDS[vendor].find((field) => field.type === 'password')?.key;

  const updateField = (key: keyof AiSettings, value: string) => {
    onSettingsChange({
      ...settings,
      [key]: key === 'jiraProjectKey' ? value.toUpperCase() : value,
    });
  };

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await testVendorConnection(vendor, settings, context));
    } catch (error) {
      setResult({
        valid: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardHeader className="justify-between">
        <span className="flex items-center gap-2">
          <span className="text-[var(--mint)]">{ICONS[vendor]}</span>
          {VENDOR_LABELS[vendor]}
        </span>
        <Badge variant={configured ? 'level-info' : 'default'}>
          {configured ? 'Ready' : 'Missing'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {FIELDS[vendor].map((field) => (
            <Input
              key={field.key}
              label={field.label}
              type={field.type ?? 'text'}
              value={String(settings[field.key] ?? '')}
              onChange={(event) => updateField(field.key, event.target.value)}
              placeholder={field.placeholder}
            />
          ))}
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={onSaved}>
            <CheckCircle2 size={13} />
            Save Config
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void handleTest()} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <span className="font-mono text-[10px] text-[var(--ink-3)]">
            secret {maskSecret(secretField ? String(settings[secretField] ?? '') : '')}
          </span>
        </div>

        {result && (
          <p
            role="status"
            className={result.valid ? 'text-[11px] text-[var(--mint)]' : 'text-[11px] text-[var(--red)]'}
          >
            {result.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
