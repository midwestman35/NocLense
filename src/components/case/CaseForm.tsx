import { useState } from 'react';
import { useCase } from '../../store/caseContext';
import type { CaseSeverity } from '../../types/case';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
interface CaseFormProps { isOpen: boolean; onClose: () => void; }
export default function CaseForm({ isOpen, onClose }: CaseFormProps) {
  const { createCase } = useCase();
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<CaseSeverity>('medium');
  const [summary, setSummary] = useState('');
  const [impact, setImpact] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createCase({ title: title.trim(), severity, summary, impact });
    setTitle(''); setSeverity('medium'); setSummary(''); setImpact(''); onClose();
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Case">
      <form onSubmit={handleSubmit}>
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Case title" required autoFocus />
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>Severity</label>
          <select className="input" value={severity} onChange={e => setSeverity(e.target.value as CaseSeverity)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
          </select>
        </div>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>Summary</label>
          <textarea className="input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Case summary" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Create Case</Button>
        </div>
      </form>
    </Modal>
  );
}
