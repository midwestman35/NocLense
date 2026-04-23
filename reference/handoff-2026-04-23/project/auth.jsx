// Auth variations for NocLense standalone.
// Three directions:
//  A. "Split Signal" — editorial left hero + SSO/token right
//  B. "Terminal Handshake" — full-bleed, type-to-authenticate, tactical
//  C. "Minimal Glass" — ultra-reduced SSO card over ambient motion

const { MacWindow, Icon, Cursor, Spark, LogHistogram, Ambient } = window;

/* ——————————————————————————————————————————————————————
   Auth A · Split Signal
   Editorial dark. A giant numbered kicker + headline on the left,
   with a live "status feed" under it pulling from the NOC.
   Right is a tidy glass card: SSO first, key fallback.
   —————————————————————————————————————————————————————— */
const AuthSplit = () => {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 2200);
    return () => clearInterval(id);
  }, []);

  const feed = [
    { t: "02:14:38", k: "datadog", msg: "us-wa-macc911-apex · 2.3k events/min", tone:"mint" },
    { t: "02:14:31", k: "ticket",  msg: "#41637 · Dispatch 4 · cannot hear caller",  tone:"amber" },
    { t: "02:14:22", k: "memory",  msg: "7 similar tickets indexed to Confluence", tone:"ink" },
    { t: "02:14:07", k: "unleash", msg: "Unleashed AI · ready (tokens: 12k / 128k)", tone:"violet" },
    { t: "02:13:51", k: "zendesk", msg: "queue · 14 open · 3 high priority",       tone:"mint" },
  ];

  return (
    <MacWindow
      title="NocLense · Sign in"
      right={<><span className="mono">v4.2.0</span><span style={{opacity:0.5}}>·</span><span className="mono" style={{color:"var(--mint)"}}>all systems nominal</span></>}
    >
      <Ambient>
        <div style={{display:"grid", gridTemplateColumns:"1.15fr 1fr", height:"100%"}}>
          {/* LEFT — editorial */}
          <div style={{padding:"64px 72px 48px", display:"flex", flexDirection:"column", justifyContent:"space-between", position:"relative", borderRight:"0.5px solid var(--line)"}}>
            {/* brand */}
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <LogoMark />
              <div style={{fontFamily:'"Geist Mono",monospace', fontSize:11, letterSpacing:"0.14em", color:"var(--ink-2)", textTransform:"uppercase"}}>NocLense · Standalone</div>
            </div>

            {/* headline */}
            <div style={{maxWidth:560}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
                <span className="mono" style={{color:"var(--mint)",fontSize:11,letterSpacing:"0.14em"}}>— 001</span>
                <span className="mono" style={{color:"var(--ink-3)",fontSize:11,letterSpacing:"0.14em"}}>AUTHENTICATE</span>
              </div>
              <h1 style={{
                fontSize:60, lineHeight:1.02, letterSpacing:"-0.03em", fontWeight:400, margin:0, color:"var(--ink-0)",
                textWrap:"balance"
              }}>
                Make the <span className="serif" style={{color:"var(--mint)"}}>signal</span><br/>
                louder than the <span className="serif" style={{color:"var(--ink-1)"}}>noise</span>.
              </h1>
              <p style={{color:"var(--ink-2)", fontSize:15, lineHeight:1.55, marginTop:22, maxWidth:440}}>
                A workspace for NOC engineers. Drop a log file, paste a ticket,
                let the AI correlate. Close the loop without leaving the room.
              </p>
            </div>

            {/* status feed */}
            <div className="glass" style={{padding:"14px 16px", fontFamily:'"Geist Mono",monospace', fontSize:11.5, maxWidth:520, position:"relative", overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:"var(--mint)",boxShadow:"0 0 10px var(--mint)"}} className="nl-pulse-dot"/>
                <span style={{color:"var(--ink-2)",letterSpacing:"0.14em"}}>LIVE · OPS FEED</span>
                <span style={{marginLeft:"auto",color:"var(--ink-3)"}}>PDT</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {feed.map((f,i) => {
                  const colorMap = { mint:"var(--mint)", amber:"var(--amber)", violet:"var(--violet)", ink:"var(--ink-1)" };
                  return (
                    <div key={i} style={{
                      display:"grid", gridTemplateColumns:"74px 70px 1fr", gap:12, alignItems:"baseline",
                      opacity: 1 - i*0.14, transform:`translateY(${i===0 && tick%2===0 ? -1 : 0}px)`, transition:"opacity .4s"
                    }}>
                      <span style={{color:"var(--ink-3)"}}>{f.t}</span>
                      <span style={{color:colorMap[f.tone], textTransform:"uppercase", letterSpacing:"0.1em", fontSize:10}}>{f.k}</span>
                      <span style={{color:"var(--ink-1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{f.msg}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT — sign in */}
          <div style={{padding:"64px 56px", display:"flex", flexDirection:"column", justifyContent:"center", position:"relative"}}>
            {/* corner */}
            <div style={{position:"absolute", top:32, right:40, fontFamily:'"Geist Mono",monospace', fontSize:11, color:"var(--ink-3)"}}>
              NEED AN ACCOUNT? <span style={{color:"var(--ink-1)",borderBottom:"0.5px solid var(--ink-2)",marginLeft:4,cursor:"pointer"}}>Ask your NOC lead →</span>
            </div>

            <div style={{maxWidth:380, width:"100%", margin:"0 auto"}}>
              <div style={{fontFamily:'"Geist Mono",monospace', fontSize:11, color:"var(--ink-3)", letterSpacing:"0.14em", marginBottom:14}}>STEP 1 OF 1</div>
              <h2 style={{fontSize:28, fontWeight:500, letterSpacing:"-0.02em", margin:"0 0 10px"}}>Sign in to continue</h2>
              <p style={{color:"var(--ink-2)", fontSize:13.5, lineHeight:1.55, margin:"0 0 28px"}}>
                Use your org identity, or paste your Unleashed AI token directly.
              </p>

              {/* SSO buttons */}
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                <SSOButton icon="google" label="Continue with Google Workspace" hint="carbyne.com" />
                <SSOButton icon="okta"  label="Continue with Okta SSO" hint="SAML" />
                <SSOButton icon="shield" label="Continue with Passkey" hint="WebAuthn" />
              </div>

              <div style={{display:"flex",alignItems:"center",gap:12,margin:"24px 0"}}>
                <div style={{flex:1,height:"0.5px",background:"var(--line-2)"}}/>
                <span style={{color:"var(--ink-3)",fontSize:10,letterSpacing:"0.14em",fontFamily:'"Geist Mono",monospace'}}>OR WITH TOKEN</span>
                <div style={{flex:1,height:"0.5px",background:"var(--line-2)"}}/>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <label style={{fontSize:11,color:"var(--ink-2)",letterSpacing:"0.06em"}}>Unleashed AI token</label>
                <div className="field">
                  <span className="lead"><Icon name="key" size={14}/></span>
                  <input type="password" defaultValue="ul_sk_••••••••••••••••••" />
                  <span className="kbd">⌘V</span>
                </div>

                <button className="btn primary" style={{marginTop:14,padding:"11px 14px",fontSize:13.5}}>
                  <Icon name="arrowRight" size={14}/>
                  Unlock workspace
                </button>
              </div>

              <div style={{marginTop:28, paddingTop:20, borderTop:"0.5px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11.5, color:"var(--ink-3)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <Icon name="lock" size={12}/>
                  <span>Tokens stored via macOS Keychain</span>
                </div>
                <span style={{fontFamily:'"Geist Mono",monospace'}}>AES-256</span>
              </div>
            </div>
          </div>
        </div>
      </Ambient>
    </MacWindow>
  );
};

const SSOButton = ({ icon, label, hint }) => (
  <button className="btn" style={{justifyContent:"flex-start", padding:"12px 14px", gap:12, fontSize:13.5, fontWeight:450}}>
    <Icon name={icon} size={16}/>
    <span>{label}</span>
    <span style={{marginLeft:"auto", fontFamily:'"Geist Mono",monospace', fontSize:10.5, color:"var(--ink-3)", letterSpacing:"0.08em", textTransform:"uppercase"}}>{hint}</span>
  </button>
);

const LogoMark = ({ size = 32 }) => (
  <div style={{
    width:size,height:size,borderRadius:8,
    background:"linear-gradient(160deg, #1f5a3f, #0a1e15)",
    border:"0.5px solid rgba(142,240,183,0.3)",
    display:"flex",alignItems:"center",justifyContent:"center",
    position:"relative",boxShadow:"0 4px 20px -4px rgba(142,240,183,0.3), 0 0 0 0.5px rgba(255,255,255,0.05) inset",
  }}>
    <svg width={size*0.55} height={size*0.55} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="var(--mint)" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="4" stroke="var(--mint)" strokeWidth="1.5" opacity="0.6"/>
      <circle cx="12" cy="12" r="1.5" fill="var(--mint)"/>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="var(--mint)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </div>
);

/* ——————————————————————————————————————————————————————
   Auth B · Terminal Handshake
   Full-bleed, tactical. A log stream animates in behind a
   centered "handshake" card with a fake challenge → response.
   —————————————————————————————————————————————————————— */
const AuthTerminal = () => {
  const lines = [
    { t:"[02:14:38]", l:"INFO",  m:"nl.daemon · starting macOS agent", c:"ink" },
    { t:"[02:14:38]", l:"OK",    m:"keychain unlocked · reading tokens", c:"mint" },
    { t:"[02:14:38]", l:"INFO",  m:"unleashed.handshake → POST /v1/auth", c:"ink" },
    { t:"[02:14:39]", l:"OK",    m:"tls · fingerprint 7f:3a:c2:9e… verified", c:"mint" },
    { t:"[02:14:39]", l:"INFO",  m:"zendesk · probing carbyne.zendesk.com", c:"ink" },
    { t:"[02:14:39]", l:"OK",    m:"zendesk · 14 open tickets · scope ok", c:"mint" },
    { t:"[02:14:40]", l:"INFO",  m:"datadog · probing datadoghq.eu", c:"ink" },
    { t:"[02:14:40]", l:"OK",    m:"datadog · logs_read_data · ok", c:"mint" },
    { t:"[02:14:40]", l:"WARN",  m:"confluence · parent page stale 3d", c:"amber" },
    { t:"[02:14:41]", l:"INFO",  m:"awaiting operator identity…", c:"violet" },
  ];
  const colors = { mint:"var(--mint)", amber:"var(--amber)", ink:"var(--ink-2)", violet:"var(--violet)" };

  const [shown, setShown] = React.useState(0);
  React.useEffect(() => {
    if (shown >= lines.length) return;
    const id = setTimeout(() => setShown(s => s+1), 260);
    return () => clearTimeout(id);
  }, [shown]);

  return (
    <MacWindow
      title="NocLense · Authenticate"
      right={<><span className="mono">nl.daemon</span><span style={{opacity:0.5}}>·</span><span className="mono" style={{color:"var(--mint)"}}>⬤ listening</span></>}
    >
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 100%, rgba(142,240,183,0.12), transparent 60%), var(--bg-0)"}}>
        {/* scanlines */}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",
          backgroundImage:"repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 3px)"}}/>
        {/* big log in background */}
        <div style={{position:"absolute",inset:"40px 48px",fontFamily:'"Geist Mono",monospace',fontSize:11.5,lineHeight:1.85,color:"var(--ink-2)",
          maskImage:"linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)",
          WebkitMaskImage:"linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)",
          overflow:"hidden"}}>
          {lines.slice(0, shown).map((ln,i) => (
            <div key={i} style={{display:"flex",gap:12,animation:"nl-stream-in .3s both"}}>
              <span style={{color:"var(--ink-4)",minWidth:90}}>{ln.t}</span>
              <span style={{color:colors[ln.c],minWidth:46}}>{ln.l}</span>
              <span style={{color:"var(--ink-1)",opacity:0.8}}>{ln.m}</span>
            </div>
          ))}
        </div>

        {/* center card */}
        <div style={{
          position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
          width:460,
        }}>
          <div className="glass" style={{
            padding:"32px 34px",
            background:"linear-gradient(180deg, rgba(14,18,24,0.92), rgba(8,10,14,0.85))",
            boxShadow:"0 40px 100px -20px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(142,240,183,0.15), 0 0 80px -20px rgba(142,240,183,0.25)",
          }}>
            {/* radar */}
            <div style={{display:"flex",justifyContent:"center",marginBottom:22}}>
              <Radar size={90}/>
            </div>

            <div style={{textAlign:"center",marginBottom:22}}>
              <div style={{fontFamily:'"Geist Mono",monospace',fontSize:10.5,letterSpacing:"0.2em",color:"var(--mint)",marginBottom:10}}>
                — SECURE HANDSHAKE —
              </div>
              <h2 style={{fontSize:22,fontWeight:500,letterSpacing:"-0.01em",margin:0,color:"var(--ink-0)"}}>
                Identify yourself, operator.
              </h2>
              <p style={{color:"var(--ink-3)",fontSize:12.5,margin:"8px 0 0",fontFamily:'"Geist Mono",monospace'}}>
                challenge <span style={{color:"var(--ink-1)"}}>a7f3c29e</span> · expires in <span style={{color:"var(--amber)"}}>58s</span>
              </p>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div className="field" style={{padding:"12px 14px"}}>
                <span className="lead"><Icon name="user" size={14}/></span>
                <span style={{color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',fontSize:12}}>operator@</span>
                <input defaultValue="k.nguyen" style={{fontFamily:'"Geist Mono",monospace', fontSize:13}}/>
                <span style={{color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',fontSize:12}}>.carbyne</span>
              </div>
              <div className="field" style={{padding:"12px 14px"}}>
                <span className="lead"><Icon name="key" size={14}/></span>
                <input type="password" placeholder="passkey or YubiKey · touch device" style={{fontFamily:'"Geist Mono",monospace', fontSize:13}}/>
                <span style={{display:"inline-flex",gap:4}}>
                  <span className="kbd">⌥</span>
                  <span className="kbd">⏎</span>
                </span>
              </div>
            </div>

            <div style={{display:"flex",gap:8,marginTop:18}}>
              <button className="btn" style={{flex:"0 0 auto"}}>
                <Icon name="shield" size={13}/> YubiKey
              </button>
              <button className="btn primary" style={{flex:1,padding:"11px",fontSize:13.5}}>
                <Icon name="bolt" size={13}/>
                Initiate handshake
              </button>
            </div>
          </div>

          <div style={{textAlign:"center",marginTop:14,fontFamily:'"Geist Mono",monospace',fontSize:10.5,color:"var(--ink-3)",letterSpacing:"0.08em"}}>
            NODE · mbp-knguyen.local · us-wa · ⬤ <span style={{color:"var(--mint)"}}>online</span>
          </div>
        </div>
      </div>
    </MacWindow>
  );
};

const Radar = ({ size = 80 }) => (
  <div style={{position:"relative", width:size, height:size}}>
    <div style={{position:"absolute", inset:0, borderRadius:"50%",
      background:"radial-gradient(circle at center, rgba(142,240,183,0.12), transparent 70%)",
      border:"0.5px solid rgba(142,240,183,0.3)"}}/>
    <div style={{position:"absolute", inset:"15%", borderRadius:"50%", border:"0.5px dashed rgba(142,240,183,0.25)"}}/>
    <div style={{position:"absolute", inset:"30%", borderRadius:"50%", border:"0.5px dashed rgba(142,240,183,0.2)"}}/>
    <div style={{position:"absolute", inset:"45%", borderRadius:"50%", background:"var(--mint)", boxShadow:"0 0 10px var(--mint)"}}/>
    <svg className="nl-radar-sweep" style={{position:"absolute",inset:0}} viewBox="0 0 100 100">
      <defs>
        <linearGradient id="rsweep" x1="50%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="var(--mint)" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="var(--mint)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d="M50 50 L100 50 A50 50 0 0 1 80 90 Z" fill="url(#rsweep)"/>
    </svg>
    {/* blips */}
    <div style={{position:"absolute", top:"22%", left:"70%", width:4, height:4, borderRadius:"50%", background:"var(--mint)"}} className="nl-pulse-dot"/>
    <div style={{position:"absolute", top:"65%", left:"25%", width:3, height:3, borderRadius:"50%", background:"var(--amber)"}} className="nl-pulse-dot"/>
  </div>
);

/* ——————————————————————————————————————————————————————
   Auth C · Glass Minimal
   A single centered card over big ambient motion. SSO primary.
   —————————————————————————————————————————————————————— */
const AuthGlass = () => (
  <MacWindow
    title="NocLense"
    right={<span className="mono" style={{color:"var(--ink-3)"}}>⌘K for command palette</span>}
  >
    <Ambient>
      {/* orbiting halo */}
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:680,height:680,borderRadius:"50%",
        background:"conic-gradient(from 0deg, transparent 0deg, rgba(142,240,183,0.22) 60deg, transparent 120deg, transparent 360deg)",
        filter:"blur(60px)", animation:"nl-sweep 28s linear infinite", pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:420,height:420,borderRadius:"50%",
        border:"0.5px solid rgba(255,255,255,0.04)"}}/>
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:640,height:640,borderRadius:"50%",
        border:"0.5px solid rgba(255,255,255,0.03)"}}/>

      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:420}}>
          {/* top mark */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:28}}>
            <LogoMark size={44}/>
            <div style={{fontSize:24,fontWeight:500,letterSpacing:"-0.02em",marginTop:16,color:"var(--ink-0)"}}>NocLense</div>
            <div style={{fontFamily:'"Geist Mono",monospace',fontSize:10.5,letterSpacing:"0.2em",color:"var(--ink-3)",textTransform:"uppercase",marginTop:4}}>NOC workspace · v4.2</div>
          </div>

          <div className="glass" style={{padding:"24px 26px"}}>
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{fontSize:15,fontWeight:500,color:"var(--ink-0)",marginBottom:4}}>Welcome back, Kev.</div>
              <div style={{fontSize:12.5,color:"var(--ink-2)"}}>Last session · <span className="mono">yesterday, 18:42 PDT</span></div>
            </div>

            <button className="btn primary" style={{width:"100%",padding:"12px",fontSize:13.5,justifyContent:"center",marginBottom:10}}>
              <Icon name="shield" size={14}/>
              Continue as <span style={{fontWeight:600}}>k.nguyen@carbyne.com</span>
            </button>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
              <button className="btn" style={{padding:"10px",fontSize:12.5,justifyContent:"center"}}>
                <Icon name="google" size={14}/> Switch account
              </button>
              <button className="btn" style={{padding:"10px",fontSize:12.5,justifyContent:"center"}}>
                <Icon name="key" size={14}/> Use token
              </button>
            </div>

            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:20,paddingTop:16,borderTop:"0.5px solid var(--line)"}}>
              <div style={{display:"flex",gap:6}}>
                <Pill on label="Zendesk"/>
                <Pill on label="Datadog"/>
                <Pill on label="Unleashed"/>
                <Pill label="Confluence" warn/>
              </div>
            </div>
          </div>

          <div style={{textAlign:"center",marginTop:18,fontSize:11.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',letterSpacing:"0.08em"}}>
            ENCRYPTED · macOS KEYCHAIN · AES-256
          </div>
        </div>
      </div>

      {/* ambient corner stats */}
      <CornerStat pos="top-left" label="UPTIME" value="99.982%" sub="30d"/>
      <CornerStat pos="top-right" label="TICKETS RESOLVED" value="1,284" sub="this week"/>
      <CornerStat pos="bottom-left" label="MTTR" value="07m 41s" sub="trailing 24h"/>
      <CornerStat pos="bottom-right" label="OPERATORS" value="12 online" sub="global"/>
    </Ambient>
  </MacWindow>
);

const Pill = ({ label, on, warn }) => (
  <div style={{
    display:"inline-flex",alignItems:"center",gap:5,
    padding:"3px 8px",borderRadius:100,fontSize:10.5,
    fontFamily:'"Geist Mono",monospace',letterSpacing:"0.06em",
    background: warn ? "rgba(247,185,85,0.06)" : on ? "rgba(142,240,183,0.06)" : "rgba(255,255,255,0.03)",
    border: `0.5px solid ${warn ? "rgba(247,185,85,0.25)" : on ? "rgba(142,240,183,0.25)" : "var(--line)"}`,
    color: warn ? "var(--amber)" : on ? "var(--mint)" : "var(--ink-3)"
  }}>
    <span style={{width:4,height:4,borderRadius:"50%",background:"currentColor",opacity: warn ? 0.9 : 1}} className={on?"nl-pulse-dot":""}/>
    {label}
  </div>
);

const CornerStat = ({ pos, label, value, sub }) => {
  const map = {
    "top-left":{top:32,left:40,textAlign:"left"},
    "top-right":{top:32,right:40,textAlign:"right"},
    "bottom-left":{bottom:32,left:40,textAlign:"left"},
    "bottom-right":{bottom:32,right:40,textAlign:"right"},
  };
  return (
    <div style={{position:"absolute",...map[pos],fontFamily:'"Geist Mono",monospace',lineHeight:1.3}}>
      <div style={{fontSize:10,color:"var(--ink-3)",letterSpacing:"0.18em",textTransform:"uppercase"}}>{label}</div>
      <div style={{fontSize:20,color:"var(--ink-0)",letterSpacing:"-0.01em",fontWeight:400,margin:"4px 0 2px"}}>{value}</div>
      <div style={{fontSize:10,color:"var(--ink-3)",letterSpacing:"0.08em"}}>{sub}</div>
    </div>
  );
};

Object.assign(window, { AuthSplit, AuthTerminal, AuthGlass, LogoMark });
