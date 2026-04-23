// Main app — assemble the design canvas with all artboards.

const { DesignCanvas, DCSection, DCArtboard } = window;
const { AuthGlass, DashEditorial, ImportRoom, SetupModal, InvestigateRoom, SubmitRoom } = window;

const App = () => (
  <DesignCanvas>
    <DCSection id="auth" title="Auth · Glass Minimal" subtitle="Selected direction (C) — single card over ambient motion">
      <DCArtboard id="auth-glass" label="Auth · sign in"  width={1280} height={820}>
        <AuthGlass/>
      </DCArtboard>
    </DCSection>

    <DCSection id="dash" title="Dashboard · Editorial" subtitle="Selected direction (A) — home / recent investigations">
      <DCArtboard id="dash-editorial" label="Dashboard · home"  width={1440} height={960}>
        <DashEditorial/>
      </DCArtboard>
    </DCSection>

    <DCSection id="workflow" title="Workflow · 3 Rooms" subtitle="Import → Investigate → Submit · restyled to match Editorial direction">
      <DCArtboard id="room-import"      label="1 · Import Room — empty state"             width={1440} height={960}>
        <ImportRoom/>
      </DCArtboard>
      <DCArtboard id="room-setup"       label="2 · Investigation Setup — modal"           width={1440} height={960}>
        <SetupModal/>
      </DCArtboard>
      <DCArtboard id="room-investigate" label="3 · Investigate Room — log stream + AI"    width={1600} height={1000}>
        <InvestigateRoom/>
      </DCArtboard>
      <DCArtboard id="room-submit"      label="4 · Submit Room — closure + evidence"      width={1440} height={960}>
        <SubmitRoom/>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
