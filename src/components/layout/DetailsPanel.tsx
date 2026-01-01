import { useState } from 'react';
import EventDetails from '../log/EventDetails';
import EvidenceTab from '../case/EvidenceTab';
export default function DetailsPanel() {
  const [activeTab, setActiveTab] = useState<'details' | 'evidence'>('details');
  return (
    <div style={{ padding: 'var(--spacing-md)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--hairline)' }}>
        {(['details', 'evidence'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: 'var(--spacing-sm) var(--spacing-md)', border: 'none', background: 'transparent', color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '15px', fontWeight: activeTab === tab ? '600' : '400', textTransform: 'capitalize' }}>{tab}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>{activeTab === 'details' ? <EventDetails /> : <EvidenceTab />}</div>
    </div>
  );
}
