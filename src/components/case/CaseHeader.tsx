import { useState } from 'react';
import { useCase } from '../../store/caseContext';
import Button from '../ui/Button';
import ExportModal from '../export/ExportModal';
export default function CaseHeader() {
  const { activeCase } = useCase();
  const [isExportOpen, setIsExportOpen] = useState(false);
  if (!activeCase) return <div style={{ color: 'var(--text-tertiary)', fontSize: '15px' }}>No active case</div>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
      <div>
        <div style={{ fontSize: '17px', fontWeight: '600' }}>{activeCase.title}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{activeCase.severity}</div>
      </div>
      <Button onClick={() => setIsExportOpen(true)}>Export</Button>
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
