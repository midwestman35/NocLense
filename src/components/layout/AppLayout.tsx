import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Timeline from './Timeline';
import DetailsPanel from './DetailsPanel';
import LogList from '../log/LogList';

export default function AppLayout() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 400px', gridTemplateRows: '60px 1fr 120px', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--hairline)' }}><TopBar /></div>
      <div style={{ borderRight: '1px solid var(--hairline)', overflowY: 'auto' }}><Sidebar /></div>
      <div style={{ overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}><LogList /></div>
      <div style={{ borderLeft: '1px solid var(--hairline)', overflowY: 'auto' }}><DetailsPanel /></div>
      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--hairline)' }}><Timeline /></div>
    </div>
  );
}
