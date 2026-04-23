// GX Workflow — Import Room, Investigate Room, Submit Room
// All four rooms in GX Material 3 tonal direction

const { GXWindow, GXIcon, GXMono, PulseDot, GXSpark, GXHistogram, GXLogo, GXAvatar, IntPill, GXCorrelation } = window;
const { GXSidebar } = window;

/* ══════════════════════════════════════════════════════════
   ROOM 1 — Import Room
   Drop zone + Zendesk fetch + file list + begin CTA
   ══════════════════════════════════════════════════════════ */
const GXImportRoom = () => {
  const files = [
    { name:"apex_us-wa-macc911_02-14.log",  fmt:"APEX",     lines:"87,412", size:"14.2 MB", st:"ready" },
    { name:"homer_sip_dispatch4_02-14.pcap", fmt:"Homer SIP",lines:"23,881", size:"3.1 MB",  st:"ready" },
    { name:"carbyne_ticket_41637.pdf",       fmt:"PDF→text", lines:"—",      size:"680 KB",  st:"ready" },
    { name:"datadog_export_02-13_02-14.csv", fmt:"DD CSV",   lines:"41,208", size:"8.9 MB",  st:"parsing" },
  ];
  const fmtColor = { APEX:"var(--gx-primary)", "Homer SIP":"var(--gx-tertiary)", "PDF→text":"var(--gx-warning)", "DD CSV":"var(--gx-secondary)" };

  return (
    <GXWindow title="NocLense · Import Room"
      right={<><span className="mono" style={{color:"var(--gx-outline)"}}>Step 1 of 3</span></>}
    >
      <div style={{display:"grid",gridTemplateColumns:"220px 1fr",height:"100%"}}>
        <GXSidebar/>
        <div style={{background:"var(--gx-surface-dim)",overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <div className="no-scroll" style={{flex:1,padding:"44px 52px"}}>
            {/* header */}
            <div style={{marginBottom:36}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div style={{width:36,height:36,borderRadius:"var(--gx-xl)",background:"var(--gx-secondary-c)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <GXIcon name="import" size={18} stroke="var(--gx-on-secondary-c)"/>
                </div>
                <div>
                  <h1 style={{fontSize:28,fontWeight:800,letterSpacing:"-0.02em",margin:0,color:"var(--gx-on-surface)"}}>Import Room</h1>
                  <GXMono size={11} caps color="var(--gx-outline)" tracking="0.16em">Drop logs · Fetch ticket · Begin investigation</GXMono>
                </div>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:20,alignItems:"start"}}>
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {/* drop zone */}
                <div style={{
                  border:`2px dashed var(--gx-outline-variant)`,
                  borderRadius:"var(--gx-2xl)",
                  padding:"52px 32px",
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,
                  background:"var(--gx-surface-c)",
                  transition:"border-color .15s, background .15s",cursor:"pointer",
                  position:"relative",overflow:"hidden",
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--gx-primary)";e.currentTarget.style.background="var(--gx-surface-high)"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--gx-outline-variant)";e.currentTarget.style.background="var(--gx-surface-c)"}}>
                  <div style={{width:64,height:64,borderRadius:"var(--gx-2xl)",background:"var(--gx-secondary-c)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <GXIcon name="upload" size={28} stroke="var(--gx-on-secondary-c)"/>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:700,color:"var(--gx-on-surface)",marginBottom:6}}>Drop log files here</div>
                    <div style={{fontSize:13.5,color:"var(--gx-on-surface-variant)",lineHeight:1.5}}>
                      APEX, Datadog CSV, Homer SIP, Call Log, ISO, JSON, PDF, ZIP
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
                    {["APEX","Homer SIP","Datadog CSV","ISO","Call Log","PDF","ZIP"].map(f=>(
                      <span key={f} className="gx-chip assist" style={{fontSize:10.5,padding:"3px 10px"}}>{f}</span>
                    ))}
                  </div>
                  <button className="gx-btn tonal" style={{marginTop:4}}><GXIcon name="folder" size={14}/>Browse files</button>
                </div>

                {/* files list */}
                {files.length > 0 && (
                  <div style={{background:"var(--gx-surface-c)",borderRadius:"var(--gx-xl)",overflow:"hidden"}}>
                    <div style={{padding:"14px 18px",borderBottom:`1px solid var(--gx-outline-variant)`,display:"flex",alignItems:"center",gap:10}}>
                      <GXMono caps size={10.5} tracking="0.16em" color="var(--gx-on-surface)">Staged files · {files.length}</GXMono>
                      <div style={{flex:1,height:1,background:"var(--gx-outline-variant)"}}/>
                      <GXMono size={11} color="var(--gx-primary)">152,501 total events</GXMono>
                    </div>
                    {files.map((f,i)=>(
                      <div key={i} style={{
                        display:"grid",gridTemplateColumns:"28px 1fr 100px 80px 80px 28px",
                        gap:14,alignItems:"center",padding:"13px 18px",
                        borderBottom: i < files.length-1 ? `1px solid var(--gx-outline-variant)` : "none",
                      }}>
                        <GXIcon name={f.fmt==="PDF→text"?"pdf":f.fmt==="DD CSV"?"csv":f.fmt==="Homer SIP"?"file":"terminal"} size={16} stroke={fmtColor[f.fmt]}/>
                        <div>
                          <div style={{fontSize:12.5,fontWeight:600,color:"var(--gx-on-surface)",fontFamily:'"Geist Mono",monospace'}}>{f.name}</div>
                          <GXMono size={10.5} color="var(--gx-outline)">{f.size}</GXMono>
                        </div>
                        <span style={{padding:"3px 10px",borderRadius:"var(--gx-sm)",fontSize:10,fontWeight:600,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.08em",
                          background:`${fmtColor[f.fmt]}18`,color:fmtColor[f.fmt]}}>{f.fmt}</span>
                        <GXMono size={11} color="var(--gx-on-surface-variant)">{f.lines}</GXMono>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          {f.st==="parsing"
                            ? <><PulseDot color="var(--gx-warning)" size={6}/><GXMono size={10.5} color="var(--gx-warning)">parsing</GXMono></>
                            : <><GXIcon name="check2" size={13} stroke="var(--gx-primary)"/><GXMono size={10.5} color="var(--gx-primary)">ready</GXMono></>
                          }
                        </div>
                        <GXIcon name="close" size={13} stroke="var(--gx-outline)"/>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* right — zendesk + setup */}
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {/* zendesk fetch */}
                <div style={{background:"var(--gx-surface-c)",borderRadius:"var(--gx-2xl)",padding:"22px 22px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                    <GXIcon name="zendesk" size={18} stroke="var(--gx-tertiary)"/>
                    <span style={{fontSize:14,fontWeight:700,color:"var(--gx-on-surface)"}}>Fetch from Zendesk</span>
                  </div>
                  <div className="gx-input" style={{marginBottom:12}}>
                    <span className="gx-lead"><GXIcon name="ticket" size={14}/></span>
                    <input defaultValue="41637" style={{fontFamily:'"Geist Mono",monospace',fontSize:14,flex:1,background:"transparent",border:0,outline:0,color:"var(--gx-on-surface)"}} placeholder="Ticket ID"/>
                  </div>
                  <button className="gx-btn tonal" style={{width:"100%",justifyContent:"center",gap:8}}>
                    <GXIcon name="download" size={14}/>Fetch ticket + attachments
                  </button>
                  <div style={{marginTop:14,padding:"12px 14px",background:"var(--gx-surface-high)",borderRadius:"var(--gx-lg)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <PulseDot color="var(--gx-primary)" size={5}/>
                      <GXMono size={10.5} caps color="var(--gx-primary)" tracking="0.14em">#41637 · fetched</GXMono>
                    </div>
                    <div style={{fontSize:12.5,fontWeight:600,color:"var(--gx-on-surface)",marginBottom:4}}>Dispatch 4 — cannot hear caller audio on 911 calls (intermittent)</div>
                    <GXMono size={10.5} color="var(--gx-outline)">Priority: High · Assigned: K. Nguyen · 2 attachments included</GXMono>
                  </div>
                </div>

                {/* setup summary */}
                <div style={{background:"var(--gx-surface-c)",borderRadius:"var(--gx-2xl)",padding:"22px 22px"}}>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--gx-on-surface)",marginBottom:14}}>Investigation setup</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[
                      { k:"Title",     v:"Dispatch 4 · 911 audio issue" },
                      { k:"CNC",       v:"us-wa-macc911-apex" },
                      { k:"Correlate", v:"Call-ID, Station-ID" },
                      { k:"Ticket",    v:"#41637 linked" },
                    ].map(r=>(
                      <div key={r.k} style={{display:"flex",gap:12,alignItems:"baseline"}}>
                        <GXMono size={10.5} caps color="var(--gx-outline)" tracking="0.14em" style={{minWidth:70}}>{r.k}</GXMono>
                        <span style={{fontSize:12.5,color:"var(--gx-on-surface)"}}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="gx-btn filled" style={{width:"100%",justifyContent:"center",gap:10,padding:"13px",fontSize:14,fontWeight:700}}>
                  <GXIcon name="radar" size={16}/>
                  Begin investigation →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GXWindow>
  );
};

/* ══════════════════════════════════════════════════════════
   ROOM 2 — Investigate Room
   3-panel: log stream | AI assistant | correlation + rail
   ══════════════════════════════════════════════════════════ */
const LOG_STREAM = [
  { t:"02:14:38.122", lvl:"INVT", cid:"a7f-3c2",  msg:"SIP INVITE sip:dispatch4@macc911 received from 10.1.14.22",     hi:false },
  { t:"02:14:38.228", lvl:"WARN", cid:"a7f-3c2",  msg:"RTP stream: 0 packets received for 280ms — possible audio gap",  hi:true  },
  { t:"02:14:38.340", lvl:"INFO", cid:"a7f-3c2",  msg:"200 OK sent — media negotiation complete g711u/8000",           hi:false },
  { t:"02:14:38.412", lvl:"WARN", cid:"a7f-3c2",  msg:"Kamailio keepalive timeout on sbc.macc911.us — retry 1/3",      hi:true  },
  { t:"02:14:38.590", lvl:"INFO", cid:"b2e-1d4",  msg:"SIP REGISTER from station-17 ext:4421 — accepted",              hi:false },
  { t:"02:14:38.720", lvl:"ERR",  cid:"a7f-3c2",  msg:"Audio gap CONFIRMED — 1140ms silence on RTP stream",            hi:true  },
  { t:"02:14:38.841", lvl:"INFO", cid:"a7f-3c2",  msg:"BYE received — call duration: 4m 22s",                          hi:false },
  { t:"02:14:39.003", lvl:"WARN", cid:"c9a-7f1",  msg:"Kamailio keepalive timeout on sbc.macc911.us — retry 2/3",      hi:true  },
  { t:"02:14:39.118", lvl:"INVT", cid:"d1b-8e2",  msg:"SIP INVITE sip:dispatch4@macc911 received from 10.1.14.22",     hi:false },
  { t:"02:14:39.230", lvl:"WARN", cid:"d1b-8e2",  msg:"RTP stream: 0 packets received for 320ms — possible audio gap",  hi:true  },
  { t:"02:14:39.340", lvl:"INFO", cid:"d1b-8e2",  msg:"200 OK sent — media negotiation complete g711u/8000",           hi:false },
  { t:"02:14:39.501", lvl:"ERR",  cid:"c9a-7f1",  msg:"Kamailio keepalive FAILED — connection marked stale",           hi:true  },
];

const lvlColor = { INVT:"var(--gx-secondary)", WARN:"var(--gx-warning)", ERR:"var(--gx-error)", INFO:"var(--gx-on-surface-variant)" };

const GXInvestigateRoom = () => {
  const [aiTick, setAiTick] = React.useState(0);
  React.useEffect(()=>{const id=setInterval(()=>setAiTick(t=>t+1),1800);return()=>clearInterval(id)},[]);

  const aiText = "The SIP Registrar is flapping against the Kamailio 5.8 keepalive timer on sbc.macc911.us. The keepalive timeout fires every ~320ms — exactly matching the observed RTP audio gaps. This is a known race condition in Kamailio 5.8.2; upgrading to 5.8.4 or adjusting the keepalive interval resolves it. 8 of 8 sampled calls show the same signature.";
  const shown = Math.min(aiText.length, Math.floor(aiTick * 38));

  return (
    <GXWindow title="NocLense · Investigate Room — #41637"
      right={<>
        <span className="mono" style={{color:"var(--gx-outline)"}}>us-wa-macc911-apex</span>
        <span style={{margin:"0 6px",color:"var(--gx-outline-variant)"}}>·</span>
        <PulseDot size={6}/><span className="mono" style={{color:"var(--gx-primary)",marginLeft:6}}>2,386 events/min</span>
      </>}
    >
      <div style={{display:"grid",gridTemplateColumns:"220px 1fr",height:"100%"}}>
        <GXSidebar/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 360px 260px",height:"100%",gap:0,background:"var(--gx-surface-dim)",overflow:"hidden"}}>

          {/* ── Panel 1: Log stream ── */}
          <div style={{display:"flex",flexDirection:"column",borderRight:`1px solid var(--gx-outline-variant)`}}>
            {/* filter bar */}
            <div style={{padding:"12px 16px",borderBottom:`1px solid var(--gx-outline-variant)`,background:"var(--gx-surface-low)",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <span className="gx-chip filter" style={{gap:6,fontSize:10.5,padding:"4px 10px"}}>
                <GXIcon name="filter" size={11}/>Call-ID · a7f-3c2
              </span>
              <span className="gx-chip filter" style={{fontSize:10.5,padding:"4px 10px"}}>Station-ID · dispatch4</span>
              <span className="gx-chip assist" style={{fontSize:10.5,padding:"4px 10px",cursor:"pointer"}}>+ Add filter</span>
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
                <GXMono size={10.5} color="var(--gx-primary)">12 matches</GXMono>
                <span style={{width:1,height:14,background:"var(--gx-outline-variant)"}}/>
                <GXMono size={10.5} color="var(--gx-outline)">AND</GXMono>
              </div>
            </div>
            {/* histogram */}
            <div style={{padding:"10px 16px 8px",borderBottom:`1px solid var(--gx-outline-variant)`,background:"var(--gx-surface-low)"}}>
              <GXHistogram bars={80} height={36} seed={2}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                <GXMono size={9.5} color="var(--gx-outline)">00:14</GXMono>
                <GXMono size={9.5} color="var(--gx-warning)">02:14 · now</GXMono>
              </div>
            </div>
            {/* rows */}
            <div className="no-scroll" style={{flex:1,padding:"0"}}>
              {LOG_STREAM.map((ln,i)=>(
                <div key={i} style={{
                  display:"grid",gridTemplateColumns:"100px 40px 70px 1fr",gap:10,
                  padding:"7px 14px",
                  background: ln.hi ? "rgba(255,185,69,0.07)" : "transparent",
                  borderLeft: `2px solid ${ln.hi ? "var(--gx-warning)" : "transparent"}`,
                  borderBottom:`1px solid var(--gx-outline-variant)`,
                  cursor:"pointer",
                }}>
                  <GXMono size={10.5} color="var(--gx-outline)">{ln.t}</GXMono>
                  <span style={{fontFamily:'"Geist Mono",monospace',fontSize:10,fontWeight:600,color:lvlColor[ln.lvl]}}>{ln.lvl}</span>
                  <GXMono size={10} color="var(--gx-tertiary)">{ln.cid}</GXMono>
                  <span style={{fontSize:11.5,color:ln.hi?"var(--gx-on-surface)":"var(--gx-on-surface-variant)",lineHeight:1.4}}>{ln.msg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Panel 2: AI assistant ── */}
          <div style={{display:"flex",flexDirection:"column",borderRight:`1px solid var(--gx-outline-variant)`}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid var(--gx-outline-variant)`,background:"var(--gx-surface-low)",display:"flex",alignItems:"center",gap:10}}>
              <GXIcon name="spark" size={16} stroke="var(--gx-tertiary)"/>
              <span style={{fontSize:13,fontWeight:700,color:"var(--gx-on-surface)"}}>Unleashed AI</span>
              <span className="gx-chip tertiary" style={{marginLeft:"auto",fontSize:10,padding:"3px 8px"}}>
                <PulseDot color="var(--gx-tertiary)" size={5}/>analyzing
              </span>
            </div>
            <div className="no-scroll" style={{flex:1,padding:"18px"}}>
              {/* hypothesis */}
              <div className="gx-card-ai" style={{marginBottom:16,padding:"18px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                  <GXMono caps size={9.5} color="var(--gx-tertiary)" tracking="0.18em">Hypothesis · 94% confidence</GXMono>
                  <span className="gx-chip tertiary" style={{marginLeft:"auto",fontSize:9.5,padding:"2px 8px"}}>12 citations</span>
                </div>
                <p style={{fontSize:13.5,color:"var(--gx-on-tertiary-c)",lineHeight:1.6,margin:0}}>
                  {aiText.slice(0, shown)}
                  {shown < aiText.length && <span style={{display:"inline-block",width:7,height:"1em",background:"var(--gx-tertiary)",verticalAlign:"-2px",animation:"gx-blink 1s steps(2) infinite"}}/>}
                </p>
              </div>
              {/* actions */}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <button className="gx-btn filled" style={{justifyContent:"center",gap:8}}>
                  <GXIcon name="check2" size={14}/>Confirm hypothesis
                </button>
                <button className="gx-btn tonal" style={{justifyContent:"center",gap:8}}>
                  <GXIcon name="search" size={14}/>Dig deeper
                </button>
                <button className="gx-btn ghost" style={{justifyContent:"center",gap:8,fontSize:12.5}}>
                  <GXIcon name="send" size={13}/>Ask follow-up…
                </button>
              </div>
              {/* evidence citations */}
              <div style={{marginTop:20}}>
                <GXMono caps size={10} color="var(--gx-outline)" tracking="0.18em" style={{display:"block",marginBottom:10}}>Cited log lines · 12</GXMono>
                {[
                  "02:14:38.228 WARN — RTP 0 packets 280ms",
                  "02:14:38.412 WARN — Kamailio keepalive timeout",
                  "02:14:38.720 ERR  — Audio gap CONFIRMED 1140ms",
                  "02:14:39.003 WARN — keepalive retry 2/3",
                  "02:14:39.501 ERR  — keepalive FAILED stale",
                ].map((c,i)=>(
                  <div key={i} style={{padding:"7px 10px",borderRadius:"var(--gx-sm)",background:"var(--gx-surface-high)",
                    fontFamily:'"Geist Mono",monospace',fontSize:10.5,color:"var(--gx-on-surface-variant)",
                    marginBottom:4,cursor:"pointer",borderLeft:"2px solid var(--gx-warning)"}}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Panel 3: Correlation + rail ── */}
          <div className="no-scroll" style={{padding:"18px 16px",display:"flex",flexDirection:"column",gap:18,background:"var(--gx-surface-low)"}}>
            <div>
              <GXMono caps size={10} color="var(--gx-outline)" tracking="0.18em" style={{display:"block",marginBottom:12}}>Correlation graph</GXMono>
              <GXCorrelation width={220} height={160}/>
            </div>
            <div style={{height:1,background:"var(--gx-outline-variant)"}}/>
            {/* datadog live */}
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <GXIcon name="datadog" size={14} stroke="var(--gx-tertiary)"/>
                <GXMono caps size={10} color="var(--gx-outline)" tracking="0.18em">Datadog Live</GXMono>
                <PulseDot size={5}/>
              </div>
              <GXHistogram bars={32} height={32} seed={5} color="var(--gx-tertiary)"/>
              <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
                {["sbc.macc911.us · CPU 72%","sbc.macc911.us · drops +340","kamailio.us-wa · restarts 3"].map((m,i)=>(
                  <div key={i} style={{fontSize:11,color:i===1||i===2?"var(--gx-warning)":"var(--gx-on-surface-variant)",fontFamily:'"Geist Mono",monospace'}}>{m}</div>
                ))}
              </div>
            </div>
            <div style={{height:1,background:"var(--gx-outline-variant)"}}/>
            {/* active filters */}
            <div>
              <GXMono caps size={10} color="var(--gx-outline)" tracking="0.18em" style={{display:"block",marginBottom:10}}>Active filters · 2</GXMono>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {["Call-ID · a7f-3c2","Station-ID · dispatch4"].map((f,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:"var(--gx-lg)",background:"var(--gx-secondary-c)"}}>
                    <GXMono size={11} color="var(--gx-on-secondary-c)">{f}</GXMono>
                    <GXIcon name="close" size={11} stroke="var(--gx-on-secondary-c)" style={{marginLeft:"auto",cursor:"pointer",opacity:0.6}}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginTop:"auto"}}>
              <button className="gx-btn filled" style={{width:"100%",justifyContent:"center",gap:8,fontSize:13}}>
                <GXIcon name="arrow" size={14}/>Proceed to Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </GXWindow>
  );
};

/* ══════════════════════════════════════════════════════════
   ROOM 3 — Submit Room
   Evidence checklist · closure note editor · submit CTA
   ══════════════════════════════════════════════════════════ */
const CLOSURE_NOTE = `**Root cause:** Kamailio 5.8.2 keepalive race condition on sbc.macc911.us causing periodic RTP audio gaps (avg 1,140ms) on inbound 911 calls routed through Dispatch 4.

**Diagnosis:** 8 of 8 sampled Call-IDs show identical RTP gap signatures aligned with the 320ms keepalive timeout. Cross-correlated with Datadog metrics: sbc.macc911.us CPU spike to 72% and packet drop increase of +340/min at timestamps matching audio gaps.

**Resolution:** Upgrade Kamailio to 5.8.4 on sbc.macc911.us (available in repo). Alternatively, adjust keepalive_interval to ≥500ms as an immediate mitigation.

**Evidence:** 152,501 log events analyzed · 12 correlated SIP call flows · Datadog metrics attached.`;

const GXSubmitRoom = () => {
  const evidence = [
    { name:"apex_us-wa-macc911_02-14.log",   lines:"87,412",  ok:true  },
    { name:"homer_sip_dispatch4_02-14.pcap",  lines:"23,881",  ok:true  },
    { name:"datadog_export_02-13_02-14.csv",  lines:"41,208",  ok:true  },
    { name:"carbyne_ticket_41637.pdf",         lines:"—",       ok:true  },
    { name:"correlation_graph.png",            lines:"export",  ok:false },
  ];

  return (
    <GXWindow title="NocLense · Submit Room — #41637"
      right={<><span className="mono" style={{color:"var(--gx-outline)"}}>Step 3 of 3</span></>}
    >
      <div style={{display:"grid",gridTemplateColumns:"220px 1fr",height:"100%"}}>
        <GXSidebar/>
        <div style={{background:"var(--gx-surface-dim)",overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <div className="no-scroll" style={{flex:1}}>
            <div style={{display:"grid",gridTemplateColumns:"280px 1fr 280px",height:"100%",gap:0}}>

              {/* left — summary */}
              <div style={{padding:"28px 24px",borderRight:`1px solid var(--gx-outline-variant)`,background:"var(--gx-surface-low)",display:"flex",flexDirection:"column",gap:18}}>
                <div>
                  <GXMono caps size={10} color="var(--gx-outline)" tracking="0.18em" style={{display:"block",marginBottom:12}}>Investigation summary</GXMono>
                  <div style={{background:"var(--gx-surface-c)",borderRadius:"var(--gx-xl)",padding:"16px"}}>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--gx-on-surface)",marginBottom:14,lineHeight:1.3}}>
                      Dispatch 4 — cannot hear caller audio on 911 calls
                    </div>
                    {[
                      { k:"Ticket",    v:"#41637 · High" },
                      { k:"CNC",       v:"us-wa-macc911-apex" },
                      { k:"Events",    v:"152,501 analyzed" },
                      { k:"Duration",  v:"1h 22m active" },
                      { k:"AI",        v:"94% confidence" },
                    ].map(r=>(
                      <div key={r.k} style={{display:"flex",gap:10,marginBottom:8,alignItems:"baseline"}}>
                        <GXMono size={10} caps color="var(--gx-outline)" tracking="0.14em" style={{minWidth:64}}>{r.k}</GXMono>
                        <span style={{fontSize:12,color:"var(--gx-on-surface)"}}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* progress steps */}
                <div>
                  <GXMono caps size={10} color="var(--gx-outline)" tracking="0.18em" style={{display:"block",marginBottom:12}}>Workflow</GXMono>
                  {[
                    { label:"Import Room",       done:true  },
                    { label:"Investigate Room",  done:true  },
                    { label:"Submit Room",        done:false, active:true },
                  ].map((s,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                      <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                        background: s.done ? "var(--gx-primary)" : s.active ? "var(--gx-secondary-c)" : "var(--gx-surface-highest)",
                        color: s.done ? "var(--gx-on-primary)" : s.active ? "var(--gx-on-secondary-c)" : "var(--gx-outline)"}}>
                        {s.done ? <GXIcon name="check" size={12}/> : <span style={{fontSize:10,fontWeight:700}}>{i+1}</span>}
                      </div>
                      <span style={{fontSize:13,color:s.done?"var(--gx-primary)":s.active?"var(--gx-on-surface)":"var(--gx-outline)",fontWeight:s.active?600:400}}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* center — editor */}
              <div style={{padding:"28px 32px",display:"flex",flexDirection:"column",gap:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:32,height:32,borderRadius:"var(--gx-lg)",background:"var(--gx-primary-c)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <GXIcon name="file" size={17} stroke="var(--gx-primary)"/>
                  </div>
                  <div>
                    <div style={{fontSize:18,fontWeight:800,letterSpacing:"-0.015em",color:"var(--gx-on-surface)"}}>Internal closure note</div>
                    <GXMono size={11} color="var(--gx-outline)">AI-drafted · editable · posts to Zendesk + Confluence</GXMono>
                  </div>
                  <span className="gx-chip tertiary" style={{marginLeft:"auto",fontSize:10,padding:"4px 10px",gap:6}}>
                    <GXIcon name="spark" size={11}/>AI drafted
                  </span>
                </div>

                <div style={{flex:1,background:"var(--gx-surface-high)",borderRadius:"var(--gx-xl)",padding:"20px 22px",fontFamily:'"Plus Jakarta Sans",sans-serif',fontSize:13.5,color:"var(--gx-on-surface)",lineHeight:1.7,whiteSpace:"pre-wrap",overflowY:"auto",minHeight:280}}>
                  {CLOSURE_NOTE}
                </div>

                {/* options */}
                <div style={{display:"flex",gap:20}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                    <div style={{width:36,height:20,borderRadius:10,background:"var(--gx-primary)",position:"relative"}}>
                      <div style={{position:"absolute",top:2,right:2,width:16,height:16,borderRadius:"50%",background:"var(--gx-on-primary)"}}/>
                    </div>
                    <span style={{fontSize:13,color:"var(--gx-on-surface)"}}>Post to Zendesk</span>
                  </label>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                    <div style={{width:36,height:20,borderRadius:10,background:"var(--gx-primary)",position:"relative"}}>
                      <div style={{position:"absolute",top:2,right:2,width:16,height:16,borderRadius:"50%",background:"var(--gx-on-primary)"}}/>
                    </div>
                    <span style={{fontSize:13,color:"var(--gx-on-surface)"}}>Save to Confluence memory</span>
                  </label>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                    <div style={{width:36,height:20,borderRadius:10,background:"var(--gx-secondary-c)",position:"relative"}}>
                      <div style={{position:"absolute",top:2,left:2,width:16,height:16,borderRadius:"50%",background:"var(--gx-on-secondary-c)"}}/>
                    </div>
                    <span style={{fontSize:13,color:"var(--gx-on-surface-variant)"}}>Create Jira ticket</span>
                  </label>
                </div>
              </div>

              {/* right — evidence + submit */}
              <div style={{padding:"28px 24px",borderLeft:`1px solid var(--gx-outline-variant)`,background:"var(--gx-surface-low)",display:"flex",flexDirection:"column",gap:18}}>
                <div>
                  <GXMono caps size={10} color="var(--gx-outline)" tracking="0.18em" style={{display:"block",marginBottom:12}}>Evidence checklist</GXMono>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {evidence.map((e,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--gx-surface-c)",borderRadius:"var(--gx-lg)"}}>
                        <div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                          background: e.ok ? "var(--gx-primary-c)" : "var(--gx-surface-highest)"}}>
                          {e.ok
                            ? <GXIcon name="check" size={11} stroke="var(--gx-primary)"/>
                            : <GXIcon name="plus"  size={11} stroke="var(--gx-outline)"/>
                          }
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11.5,fontFamily:'"Geist Mono",monospace',color:"var(--gx-on-surface-variant)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div>
                          <GXMono size={10} color="var(--gx-outline)">{e.lines}</GXMono>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* macro selector */}
                <div>
                  <GXMono caps size={10} color="var(--gx-outline)" tracking="0.18em" style={{display:"block",marginBottom:10}}>Zendesk macro</GXMono>
                  <div className="gx-input" style={{borderRadius:"var(--gx-md)"}}>
                    <GXIcon name="zendesk" size={14} stroke="var(--gx-outline)"/>
                    <input defaultValue="NOC Internal — Audio/SIP — Resolved" style={{fontFamily:'"Plus Jakarta Sans",sans-serif',fontSize:12.5,flex:1,background:"transparent",border:0,outline:0,color:"var(--gx-on-surface)"}}/>
                  </div>
                </div>

                {/* submit */}
                <div style={{marginTop:"auto",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{padding:"12px 14px",background:"var(--gx-primary-c)",borderRadius:"var(--gx-lg)",border:"1px solid rgba(142,240,183,0.2)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <GXIcon name="check2" size={14} stroke="var(--gx-primary)"/>
                      <GXMono size={11} color="var(--gx-primary)" caps tracking="0.12em">Ready to submit</GXMono>
                    </div>
                    <div style={{fontSize:12,color:"var(--gx-on-primary-c)"}}>4 of 5 evidence items checked · note drafted · ticket linked</div>
                  </div>
                  <button className="gx-btn filled" style={{width:"100%",justifyContent:"center",gap:10,padding:"13px",fontSize:14,fontWeight:700}}>
                    <GXIcon name="send" size={16}/>
                    Submit &amp; close ticket
                  </button>
                  <button className="gx-btn ghost" style={{width:"100%",justifyContent:"center",fontSize:12.5}}>
                    Save draft · return later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GXWindow>
  );
};

Object.assign(window, { GXImportRoom, GXInvestigateRoom, GXSubmitRoom });
