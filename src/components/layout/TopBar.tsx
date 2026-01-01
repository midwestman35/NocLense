import CaseHeader from '../case/CaseHeader';
export default function TopBar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 var(--spacing-md)', height: '100%', gap: 'var(--spacing-md)' }}>
      <div style={{ flex: 1 }}><input type="text" placeholder="Search logs..." className="input" style={{ maxWidth: '400px' }} /></div>
      <CaseHeader />
    </div>
  );
}
