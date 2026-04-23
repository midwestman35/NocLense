// GX Auth — Terminal Handshake, Material 3 dark tonal

const { GXWindow, GXIcon, GXMono, PulseDot, GXRadar, GXLogo, IntPill } = window;

const LOG_LINES = [
  { t:"02:14:38", l:"INFO",  c:"var(--gx-on-surface-variant)", m:"nl.daemon · starting macOS agent v4.2.0" },
  { t:"02:14:38", l:"OK",    c:"var(--gx-primary)",            m:"keychain unlocked · reading encrypted tokens" },
  { t:"02:14:39", l:"INFO",  c:"var(--gx-on-surface-variant)", m:"unleashed.handshake → POST /v1/auth/challenge" },
  { t:"02:14:39", l:"OK",    c:"var(--gx-primary)",            m:"tls · cert fingerprint 7f:3a:c2:9e verified" },
  { t:"02:14:39", l:"INFO",  c:"var(--gx-on-surface-variant)", m:"zendesk · probing carbyne.zendesk.com:443" },
  { t:"02:14:40", l:"OK",    c:"var(--gx-primary)",            m:"zendesk · 14 open · scope: tickets:read ✓" },
  { t:"02:14:40", l:"INFO",  c:"var(--gx-on-surface-variant)", m:"datadog · probing datadoghq.eu via proxy" },
  { t:"02:14:40", l:"OK",    c:"var(--gx-primary)",            m:"datadog · logs_read_data scope confirmed" },
  { t:"02:14:41", l:"WARN",  c:"var(--gx-warning)",            m:"confluence · parent page last updated 3d ago" },
  { t:"02:14:41", l:"INFO",  c:"var(--gx-tertiary)",           m:"awaiting operator identity · challenge a7f3c29e" },
];

const GXAuthTerminal = () => {
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => {
    if (shown >= LOG_LINES.length) return;
    const id = setTimeout(() => setShown(s => s + 1), 280);
    return () => clearTimeout(id);
  }, [shown]);

  return (
    <GXWindow
      title="NocLense · Authenticate"
      right={<><span className="mono" style={{color:"var(--gx-outline)"}}>nl.daemon</span><span style={{color:"var(--gx-outline)",margin:"0 6px"}}>·</span><span className="mono" style={{color:"var(--gx-primary)"}}>⬤ listening</span></>}
    >
      {/* full-bleed background */}
      <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 80% 60% at 50% 100%, rgba(0,82,45,0.35), transparent 65%), var(--gx-surface-dim)`}}>

        {/* scanlines — subtle */}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",opacity:0.4,
          backgroundImage:"repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 3px)"}}/>

        {/* log stream in background */}
        <div style={{
          position:"absolute",inset:"48px 56px",
          fontFamily:'"Geist Mono",monospace',fontSize:12,lineHeight:2,
          maskImage:"linear-gradient(180deg, transparent 0%, black 20%, black 80%, transparent 100%)",
          WebkitMaskImage:"linear-gradient(180deg, transparent 0%, black 20%, black 80%, transparent 100%)",
          overflow:"hidden",pointerEvents:"none"
        }}>
          {LOG_LINES.slice(0, shown).map((ln, i) => (
            <div key={i} style={{display:"flex",gap:14,animation:"gx-stream .3s both",opacity: 1 - (shown-1-i)*0.07}}>
              <span style={{color:"var(--gx-outline)",minWidth:86,flexShrink:0}}>{ln.t}</span>
              <span style={{color:ln.c,minWidth:44,flexShrink:0,fontWeight:ln.l==="OK"?600:400}}>{ln.l}</span>
              <span style={{color:"var(--gx-on-surface-variant)"}}>{ln.m}</span>
            </div>
          ))}
        </div>

        {/* center auth card */}
        <div style={{
          position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
          width:480,
        }}>
          <div style={{
            background:"linear-gradient(180deg, var(--gx-surface-high) 0%, var(--gx-surface-c) 100%)",
            borderRadius:"var(--gx-2xl)",padding:"36px 38px",
            boxShadow:`0 0 0 1px rgba(142,240,183,0.12), 0 40px 100px -20px rgba(0,0,0,0.75), 0 0 80px -20px rgba(0,82,45,0.4)`,
          }}>
            {/* radar + brand */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20,marginBottom:28}}>
              <GXRadar size={80}/>
              <div>
                <div style={{fontSize:26,fontWeight:800,letterSpacing:"-0.025em",color:"var(--gx-on-surface)",lineHeight:1}}>NocLense</div>
                <GXMono caps size={10} tracking="0.22em" color="var(--gx-outline)">Secure Handshake</GXMono>
                <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                  <GXMono size={11} color="var(--gx-on-surface-variant)">challenge <span style={{color:"var(--gx-on-surface)"}}>a7f3c29e</span></GXMono>
                  <span style={{width:3,height:3,borderRadius:"50%",background:"var(--gx-outline)"}}/>
                  <GXMono size={11} color="var(--gx-warning)">expires 58s</GXMono>
                </div>
              </div>
            </div>

            {/* fields */}
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              <div className="gx-input">
                <span className="gx-lead"><GXIcon name="user" size={15}/></span>
                <GXMono size={13} color="var(--gx-outline)">operator@</GXMono>
                <input defaultValue="k.nguyen" style={{fontFamily:'"Geist Mono",monospace',fontSize:13,flex:1,background:"transparent",border:0,outline:0,color:"var(--gx-on-surface)"}}/>
                <GXMono size={13} color="var(--gx-outline)">.carbyne</GXMono>
              </div>
              <div className="gx-input">
                <span className="gx-lead"><GXIcon name="key" size={15}/></span>
                <input type="password" placeholder="passkey or YubiKey — touch device"
                  style={{fontFamily:'"Geist Mono",monospace',fontSize:13,flex:1,background:"transparent",border:0,outline:0,color:"var(--gx-on-surface)"}}/>
              </div>
            </div>

            {/* actions */}
            <div style={{display:"flex",gap:10}}>
              <button className="gx-btn surface" style={{flex:"0 0 auto",gap:8}}>
                <GXIcon name="shield" size={14}/>
                YubiKey
              </button>
              <button className="gx-btn filled" style={{flex:1,fontSize:14,fontWeight:700,letterSpacing:"-0.01em",justifyContent:"center",gap:10}}>
                <GXIcon name="bolt" size={15}/>
                Initiate handshake
              </button>
            </div>

            {/* integrations */}
            <div style={{marginTop:22,paddingTop:18,borderTop:`1px solid var(--gx-outline-variant)`,display:"flex",gap:6,flexWrap:"wrap"}}>
              <IntPill name="Zendesk" ok/>
              <IntPill name="Datadog" ok/>
              <IntPill name="Unleashed" ok/>
              <IntPill name="Confluence" warn/>
            </div>
          </div>

          {/* node identity */}
          <div style={{textAlign:"center",marginTop:16}}>
            <GXMono size={10.5} caps tracking="0.12em" color="var(--gx-outline)">
              node · mbp-knguyen.local · us-wa · <span style={{color:"var(--gx-primary)"}}>⬤ online</span>
            </GXMono>
          </div>
        </div>
      </div>
    </GXWindow>
  );
};

Object.assign(window, { GXAuthTerminal });
