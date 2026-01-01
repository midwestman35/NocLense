import React from 'react';
import Button from './Button';
interface ModalProps { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; }
export default function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--spacing-lg)' }}>
      <div className="panel panel-elevated" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)', paddingBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--hairline)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{title}</h2>
          <Button onClick={onClose} style={{ minWidth: 'auto', padding: 'var(--spacing-sm)' }}>âœ•</Button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 'var(--spacing-md)' }}>{children}</div>
        {footer && <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--hairline)' }}>{footer}</div>}
      </div>
    </div>
  );
}
