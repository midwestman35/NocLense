import { useCase } from '../../store/caseContext';
import Button from '../ui/Button';
export default function EventDetails() {
  const { activeCase } = useCase();
  if (!activeCase) return <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Select a case to start investigating</div>;
  return (
    <div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', marginBottom: 'var(--spacing-md)' }}>Select an event from the log list</div>
      <div className="separator" />
      <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>Bookmark Event</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        {['Evidence', 'Symptom', 'Milestone'].map(tag => <Button key={tag} style={{ width: '100%' }}>{tag}</Button>)}
      </div>
    </div>
  );
}
