import CaseList from '../case/CaseList';
export default function Sidebar() {
  return (
    <div style={{ padding: 'var(--spacing-md)', height: '100%' }}>
      <h3 style={{ fontSize: '17px', fontWeight: '600', marginBottom: 'var(--spacing-md)' }}>Cases</h3>
      <CaseList />
    </div>
  );
}
