import { useState } from 'react';
import { useCase } from '../../store/caseContext';
import Button from '../ui/Button';
import CaseForm from './CaseForm';
export default function CaseList() {
  const { cases, activeCaseId, setActiveCase } = useCase();
  const [isFormOpen, setIsFormOpen] = useState(false);
  return (
    <div>
      <Button variant="primary" onClick={() => setIsFormOpen(true)} style={{ width: '100%', marginBottom: 'var(--spacing-md)' }}>+ New Case</Button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        {cases.map(c => (
          <div key={c.id} onClick={() => setActiveCase(c.id)} style={{ padding: 'var(--spacing-sm) var(--spacing-md)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', backgroundColor: activeCaseId === c.id ? 'var(--surface-elevated)' : 'transparent', border: activeCaseId === c.id ? '1px solid var(--separator)' : '1px solid transparent' }}>
            <div style={{ fontWeight: '600', fontSize: '15px' }}>{c.title}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{new Date(c.updatedAt).toLocaleDateString()} â€¢ {c.severity}</div>
          </div>
        ))}
        {cases.length === 0 && <div style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>No cases yet</div>}
      </div>
      <CaseForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
