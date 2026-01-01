import { useState } from 'react';
import { useCase } from '../../store/caseContext';
import type { PackType, RedactionPreset, ExportOptions } from '../../types/export';
import { buildPack } from '../../services/exportPackBuilder';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
interface ExportModalProps { isOpen: boolean; onClose: () => void; }
export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { activeCase } = useCase();
  const [packType, setPackType] = useState<PackType>('full');
  const [redactionPreset, setRedactionPreset] = useState<RedactionPreset>('external');
  const [includePayload] = useState(false);
  const [maxEvents, setMaxEvents] = useState(10000);
  if (!activeCase) return null;
  const handleExport = () => {
    const options: ExportOptions = { packType, redactionPreset, includePayload, timeBufferSeconds: 0, maxEvents };
    const pack = buildPack(activeCase, [], options, '0.1.0');
    ['report.md', 'case.json', 'filtered_logs.ndjson', 'provenance.json'].forEach((name, i) => {
      const content = [pack.report, pack.caseJson, pack.filteredLogs, JSON.stringify(pack.provenance, null, 2)][i];
      const blob = new Blob([content], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    });
    onClose();
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Pack" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={handleExport}>Export</Button></>}>
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>Pack Type</label>
        <select className="input" value={packType} onChange={e => setPackType(e.target.value as PackType)}>
          <option value="uc">UC</option><option value="network">Network</option><option value="rd">R&D</option><option value="aws">AWS/Platform</option><option value="full">Full</option>
        </select>
      </div>
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>Redaction</label>
        <select className="input" value={redactionPreset} onChange={e => setRedactionPreset(e.target.value as RedactionPreset)}>
          <option value="external">External (Aggressive)</option><option value="internal">Internal (Moderate)</option><option value="raw">Raw (None)</option>
        </select>
      </div>
      <Input label="Max Events" type="number" value={maxEvents} onChange={e => setMaxEvents(parseInt(e.target.value) || 10000)} min={1} />
    </Modal>
  );
}
