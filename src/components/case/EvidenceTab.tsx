import { useCase } from '../../store/caseContext';
export default function EvidenceTab() {
  const { activeCase } = useCase();
  if (!activeCase) return <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Select a case to view evidence</div>;
  const bookmarks = [...activeCase.bookmarks].sort((a, b) => a.timestamp - b.timestamp);
  if (bookmarks.length === 0) return <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>No bookmarks yet</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {bookmarks.map(b => (
        <div key={b.id} style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--accent)' }}>{b.tag}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{new Date(b.timestamp).toLocaleString()}</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Event: {b.eventId}</div>
          {b.note && <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>{b.note}</div>}
        </div>
      ))}
    </div>
  );
}
