// GX App — assemble design canvas

const { DesignCanvas, DCSection, DCArtboard } = window;
const { GXAuthTerminal } = window;
const { GXDashEditorial } = window;
const { GXImportRoom, GXInvestigateRoom, GXSubmitRoom } = window;

const App = () => (
  <DesignCanvas>
    <DCSection id="auth" title="Auth · Sign In" subtitle="Direction B — Terminal Handshake · Google Expressive · M3 dark tonal">
      <DCArtboard id="auth-gx" label="B · Terminal Handshake — GX" width={1280} height={820}>
        <GXAuthTerminal/>
      </DCArtboard>
    </DCSection>

    <DCSection id="dash" title="Dashboard · Home" subtitle="Direction A — Editorial · M3 tonal surfaces · phosphor mint key color">
      <DCArtboard id="dash-gx" label="A · Editorial Dashboard — GX" width={1440} height={960}>
        <GXDashEditorial/>
      </DCArtboard>
    </DCSection>

    <DCSection id="workflow" title="Workflow Rooms · 1 → 2 → 3" subtitle="Import Room → Investigate Room → Submit Room · full GX direction">
      <DCArtboard id="import-gx"    label="Room 1 · Import"      width={1440} height={960}>
        <GXImportRoom/>
      </DCArtboard>
      <DCArtboard id="investigate-gx" label="Room 2 · Investigate" width={1440} height={960}>
        <GXInvestigateRoom/>
      </DCArtboard>
      <DCArtboard id="submit-gx"    label="Room 3 · Submit"      width={1440} height={960}>
        <GXSubmitRoom/>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
