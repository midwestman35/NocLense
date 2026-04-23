// Investigate Room — log stream + AI assistant (the main workspace)
const { MacWindow, Icon, Cursor, LogHistogram } = window;
const { Sidebar, RoomTopbar } = window;

const LOG_ROWS = [
  { t:"04/05 02:14:15.115", lvl:"keepalive", m:"[Empty entry; APEX]",                            src:"Machine: Dispatch 4 · Stack: prod Call Center: us-wa-macc911-apex" },
  { t:"04/05 02:14:16.388", lvl:"keepalive", m:"[Empty entry; APEX]",                            src:"Machine: Dispatch 4 · Stack: prod Call Center: us-wa-macc911-apex" },
  { t:"04/05 02:14:16.388", lvl:"keepalive", m:"[Empty entry; APEX]",                            src:"Machine: Dispatch 4 · Stack: prod Call Center: us-wa-macc911-apex", hi:true },
  { t:"04/05 02:14:18.507", lvl:"keepalive", m:"[Empty entry; APEX]",                            src:"Machine: Dispatch 4 · Stack: prod Call Center: us-wa-macc911-apex", hi:true },
  { t:"04/05 02:14:18.507", lvl:"keepalive", m:"[Empty entry; APEX]",                            src:"Machine: Dispatch 4 · Stack: prod Call Center: us-wa-macc911-apex", hi:true },
  { t:"04/05 02:14:18.507", lvl:"keepalive", m:"[Empty entry; APEX]",                            src:"Machine: Dispatch 4 · Stack: prod Call Center: us-wa-macc911-apex" },
  { t:"04/05 02:14:18.689", lvl:"keepalive", m:"[Empty entry; APEX]",                            src:"Machine: Dispatch 4 · Stack: prod Call Center: us-wa-macc911-apex" },
  { t:"04/05 02:14:18.689", lvl:"keepalive", m:"[Empty entry; APEX]",                            src:"Machine: Dispatch 4 · Stack: prod Call Center: us-wa-macc911-apex" },
  { t:"04/05 02:14:18.689", lvl:"keepalive", m:"[Empty entry; APEX]",                            src:"Machine: Dispatch 4 · Stack: prod Call Center: us-wa-macc911-apex" },
  { t:"04/05 02:14:19.137", lvl:"info",      m:`[INFO] [4/5/2026, 12:02:15 AM,561] [CCS-SDK]: | sip.Transport | Received WebSocket text message: SIP/2.0 200 OK ViA: SIP/2.0/WSS 62b4e032-f48d-4eef-a83c-d8a74384e4a9.pssap;branch=z9…`,  src:"", mint:true },
];

const lvlColor = l => l==="info"?"var(--mint)":l==="warn"?"var(--amber)":l==="err"?"var(--red)":"var(--ink-3)";

const InvestigateRoom = () => (
  <MacWindow title="NocLense · Investigate" right={<span className="mono" style={{color:"var(--mint)"}}>⬤ live</span>}>
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr 360px",height:"100%",background:"var(--bg-0)"}}>
      <Sidebar active="inv"/>
      <div style={{display:"flex",flexDirection:"column",overflow:"hidden",borderRight:"0.5px solid var(--line)"}}>
        <RoomTopbar ticket="41637" phase="Investigate"/>
        <LogStreamPanel/>
      </div>
      <AIAssistantPanel/>
    </div>
  </MacWindow>
);

const LogStreamPanel = () => (
  <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {/* Panel header */}
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:"0.5px solid var(--line)"}}>
      <Icon name="chevron" size={11} stroke="var(--ink-3)" style={{transform:"rotate(90deg)"}}/>
      <Icon name="doc" size={13} stroke="var(--mint)"/>
      <span style={{fontSize:11,letterSpacing:"0.16em",color:"var(--ink-1)",fontFamily:'"Geist Mono",monospace'}}>LOG STREAM</span>
      <span style={{fontSize:11.5,color:"var(--ink-3)"}}>No active case · Create or select a case to capture evidence and build a handoff pack.</span>
      <span style={{marginLeft:"auto",fontSize:11,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>2,386 events</span>
      <Icon name="arrowUpRight" size={13} stroke="var(--ink-3)" style={{cursor:"pointer"}}/>
    </div>

    {/* Toolbar */}
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 20px",borderBottom:"0.5px solid var(--line)",background:"rgba(255,255,255,0.01)"}}>
      <div className="field" style={{flex:1,padding:"7px 11px"}}>
        <span className="lead"><Icon name="search" size={12}/></span>
        <input placeholder="Search logs (tracking, Call-ID, message, component)…" style={{fontSize:12}}/>
      </div>
      <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,background:"rgba(142,240,183,0.06)",border:"0.5px solid rgba(142,240,183,0.25)",fontSize:11.5,color:"var(--mint)",fontFamily:'"Geist Mono",monospace'}}>
        <Icon name="filter" size={11}/> Filter <span style={{color:"var(--ink-0)"}}>ALL Logs</span>
        <Icon name="chevron" size={10} style={{transform:"rotate(90deg)"}}/>
      </div>
      <button className="btn ghost" style={{padding:"5px 10px",fontSize:11.5}}>Favorites</button>
      <button className="btn ghost" style={{padding:"5px 10px",fontSize:11.5,color:"var(--violet)"}}>AI highlighted <span style={{color:"var(--ink-3)",marginLeft:4}}>0</span></button>
      <button className="btn ghost" style={{padding:"5px 10px",fontSize:11.5}}>Collapse similar</button>
      <span style={{fontSize:11,fontFamily:'"Geist Mono",monospace',color:"var(--ink-2)",marginLeft:4}}>2,386 / 2,386</span>
    </div>

    {/* Histogram */}
    <div style={{padding:"10px 20px 6px",borderBottom:"0.5px solid var(--line)"}}>
      <LogHistogram bars={80} height={44}/>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>
        <span>00:14</span><span>00:44</span><span>01:14</span><span>01:44</span><span style={{color:"var(--amber)"}}>02:14 · now</span>
      </div>
    </div>

    {/* Meta bar */}
    <div style={{display:"flex",alignItems:"center",gap:14,padding:"8px 20px",borderBottom:"0.5px solid var(--line)",fontSize:11,fontFamily:'"Geist Mono",monospace',color:"var(--ink-3)"}}>
      <span style={{color:"var(--ink-2)"}}>Log window</span>
      <span>2,386 events · 2:03:18 AM → 2:14:46 AM</span>
      <span style={{color:"var(--amber)",background:"rgba(247,185,85,0.08)",padding:"1px 6px",borderRadius:3,border:"0.5px solid rgba(247,185,85,0.2)"}}>WARN 2</span>
      <span style={{color:"var(--violet)",background:"rgba(165,140,255,0.08)",padding:"1px 6px",borderRadius:3,border:"0.5px solid rgba(165,140,255,0.22)"}}>INFO 2,367</span>
      <span style={{color:"var(--ink-2)"}}>DBG 17</span>
    </div>

    {/* Column headers */}
    <div style={{display:"grid",gridTemplateColumns:"24px 160px 90px 80px 40px 1fr",gap:12,padding:"8px 20px",borderBottom:"0.5px solid var(--line)",fontSize:10,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.14em",color:"var(--ink-3)",textTransform:"uppercase"}}>
      <span>#</span><span>Timestamp ▾</span><span>Type</span><span>Service</span><span>Lvl</span><span>Message</span>
    </div>

    {/* Filter chips row */}
    <div style={{display:"flex",gap:6,padding:"8px 20px",borderBottom:"0.5px solid var(--line)",flexWrap:"wrap"}}>
      <LogChip label="All" count="2,386" active/>
      <LogChip label="prod-Respective" count="576"/>
      <LogChip label="prod-LogNicelyData" count="1,840"/>
      <LogChip label="prod-MonitoringSystem" count="21"/>
    </div>

    {/* Log rows */}
    <div className="no-scrollbar" style={{flex:1,overflowY:"auto",fontFamily:'"Geist Mono",monospace',fontSize:11.5}}>
      {LOG_ROWS.map((r,i)=>(
        <div key={i} style={{
          display:"grid",gridTemplateColumns:"24px 160px 90px 80px 40px 1fr 16px",gap:12,
          padding:"7px 20px",
          borderBottom:"0.5px solid rgba(255,255,255,0.03)",
          background: r.hi ? "rgba(165,140,255,0.04)" : r.mint ? "rgba(142,240,183,0.04)" : "transparent",
          borderLeft: r.hi ? "2px solid var(--violet)" : r.mint ? "2px solid var(--mint)" : "2px solid transparent",
          alignItems:"center",cursor:"pointer"
        }}>
          <Icon name="chevron" size={10} stroke="var(--ink-3)"/>
          <span style={{color:"var(--ink-2)"}}>{r.t}</span>
          <span style={{color:lvlColor(r.lvl)}}>{r.lvl==="info" ? <span className="tag" style={{padding:"0 6px",fontSize:9.5}}>Info</span> : <span className="tag ink" style={{padding:"0 6px",fontSize:9.5}}>keepalive</span>}</span>
          <span style={{color:"var(--ink-3)"}}>apex</span>
          <span style={{color:lvlColor(r.lvl)}}>{r.lvl==="info"?"I":"K"}</span>
          <div style={{minWidth:0}}>
            <div style={{color: r.mint?"var(--mint)":"var(--ink-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.m}</div>
            {r.src && <div style={{color:"var(--ink-3)",fontSize:10.5,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.src}</div>}
          </div>
          <Icon name="spark" size={10} stroke={r.hi?"var(--violet)":"var(--ink-4)"}/>
        </div>
      ))}
    </div>
  </div>
);

const LogChip = ({ label, count, active }) => (
  <span style={{
    fontFamily:'"Geist Mono",monospace',fontSize:10.5,
    padding:"3px 9px",borderRadius:100,
    background: active?"rgba(142,240,183,0.06)":"rgba(255,255,255,0.03)",
    border:`0.5px solid ${active?"rgba(142,240,183,0.25)":"var(--line-2)"}`,
    color: active?"var(--mint)":"var(--ink-2)",
    display:"inline-flex",gap:7
  }}>
    {label}<span style={{color: active?"var(--mint)":"var(--ink-3)",opacity:0.85}}>{count}</span>
  </span>
);



const AIAssistantPanel = () => (
  <div style={{display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(180deg, rgba(165,140,255,0.03), transparent 40%)"}}>
    {/* header */}
    <div style={{padding:"14px 18px",borderBottom:"0.5px solid var(--line)",display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:26,height:26,borderRadius:7,background:"rgba(165,140,255,0.1)",border:"0.5px solid rgba(165,140,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Icon name="spark" size={14} stroke="var(--violet)"/>
      </div>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:500,color:"var(--ink-0)"}}>AI ASSISTANT</span>
          <span className="tag violet" style={{padding:"1px 7px",fontSize:9.5}}>UNLEASHED</span>
        </div>
        <div style={{fontSize:11,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>2,386 logs · ready</div>
      </div>
      <Icon name="gear" size={13} stroke="var(--ink-3)" style={{cursor:"pointer"}}/>
    </div>

    {/* Intro card */}
    <div style={{padding:"14px 18px",borderBottom:"0.5px solid var(--line)"}}>
      <div style={{
        padding:"12px 14px",borderRadius:8,
        background:"rgba(165,140,255,0.04)",border:"0.5px solid rgba(165,140,255,0.2)"
      }}>
        <div style={{fontSize:12.5,color:"var(--ink-0)",fontWeight:500,marginBottom:6}}>Unleashed AI is ready for your team</div>
        <div style={{fontSize:11.5,color:"var(--ink-2)",lineHeight:1.5}}>
          Pre-configured with your team's <span style={{color:"var(--ink-1)"}}>Confluence, Zendesk, and Slack</span> knowledge — no setup needed.
        </div>
        <div style={{fontSize:11,color:"var(--ink-3)",lineHeight:1.55,marginTop:8}}>
          <strong style={{color:"var(--ink-2)"}}>Summary / Anomalies / Auto-tag</strong> — one-click log analysis. <strong style={{color:"var(--ink-2)"}}>Chat</strong> — ask anything about your logs. <strong style={{color:"var(--ink-2)"}}>Ticket</strong> — fetch a Zendesk ticket for context. <strong style={{color:"var(--ink-2)"}}>Diagnose</strong> — AI correlates the ticket with your logs, highlights relevant entries in search, and guides you to resolution with Zendesk + Jira integration.
        </div>
        <div style={{fontSize:10.5,color:"var(--violet)",marginTop:8,fontFamily:'"Geist Mono",monospace'}}>
          Responses may take 15–30 seconds.
        </div>
      </div>
    </div>

    {/* Mode tabs */}
    <div style={{display:"flex",gap:4,padding:"10px 18px 0",borderBottom:"0.5px solid var(--line)"}}>
      {[
        { k:"Diagnose", active:true },
        { k:"Summary" },
        { k:"Anomalies" },
        { k:"Chat" },
        { k:"Auto-tag" }
      ].map(t=>(
        <div key={t.k} style={{
          padding:"7px 10px",fontSize:11.5,cursor:"pointer",
          color: t.active?"var(--violet)":"var(--ink-2)",
          borderBottom: t.active?"1.5px solid var(--violet)":"1.5px solid transparent",
          fontFamily:'"Geist Mono",monospace',letterSpacing:"0.08em",textTransform:"uppercase"
        }}>{t.k}</div>
      ))}
    </div>

    {/* Diagnose stepper */}
    <div style={{padding:"14px 18px",borderBottom:"0.5px solid var(--line)"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,fontSize:11,fontFamily:'"Geist Mono",monospace',color:"var(--ink-3)"}}>
        <StepBadge n="1" done label="Ticket & Scan"/>
        <div style={{flex:0,width:12,height:"0.5px",background:"var(--line-2)"}}/>
        <StepBadge n="2" active label="Review & Refine"/>
        <div style={{flex:0,width:12,height:"0.5px",background:"var(--line-2)"}}/>
        <StepBadge n="3" label="Submit"/>
      </div>
      <div style={{padding:"10px 12px",borderRadius:7,background:"rgba(165,140,255,0.05)",border:"0.5px solid rgba(165,140,255,0.22)"}}>
        <div style={{fontSize:11,color:"var(--violet)",letterSpacing:"0.08em",fontFamily:'"Geist Mono",monospace',marginBottom:4}}>STEP 2 — REVIEW & REFINE</div>
        <div style={{fontSize:12,color:"var(--ink-1)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <span>Star logs to add them to the note.</span>
          <button className="btn primary" style={{padding:"5px 10px",fontSize:11.5,background:"linear-gradient(180deg, #3a2a6e, #241845)",borderColor:"rgba(165,140,255,0.4)",color:"var(--violet)"}}>
            Next <Icon name="chevron" size={11}/>
          </button>
        </div>
      </div>
    </div>

    {/* AI content */}
    <div className="no-scrollbar" style={{flex:1,overflowY:"auto",padding:"14px 18px",fontSize:12.5,color:"var(--ink-1)",lineHeight:1.55}}>
      <p style={{margin:"0 0 12px"}}>
        <strong style={{color:"var(--ink-0)"}}>Dispatch 4 lost inbound caller audio</strong> because the CCS-SDK SIP Registrar repeatedly toggled <span style={{color:"var(--amber)"}}>Waiting</span> state while a Kamailio upstream kept responding <span className="mono" style={{color:"var(--violet)"}}>200 OK</span> to stale OPTIONS keepalives.
      </p>
      <p style={{margin:"0 0 12px",color:"var(--ink-2)"}}>
        The registration flap meant the PBX briefly lacked a valid contact for inbound media, so early-media RTP was not bridged for ~5 seconds per cycle, matching the symptom ("I can hear them but they can't hear me" reported for multiple 911 calls).
      </p>

      <div style={{fontSize:10,letterSpacing:"0.16em",color:"var(--violet)",fontFamily:'"Geist Mono",monospace',margin:"18px 0 8px"}}>TROUBLESHOOTING</div>
      <p style={{margin:"0 0 10px",color:"var(--ink-2)"}}>Supervisor restarted Dispatch 4 workstation at 02:12:00 PDT — issue cleared.</p>

      <div style={{fontSize:10,letterSpacing:"0.16em",color:"var(--violet)",fontFamily:'"Geist Mono",monospace',margin:"16px 0 8px"}}>INTERNAL NOTE DRAFT</div>
      <div style={{
        padding:"10px 12px",borderRadius:6,background:"rgba(0,0,0,0.3)",border:"0.5px solid var(--line-2)",
        fontFamily:'"Geist Mono",monospace',fontSize:11.5,color:"var(--ink-1)",lineHeight:1.5
      }}>
        The Dispatch 4 workstation lost inbound caller audio because its CCS-SDK SIP Registrar began flapping against the Kamailio 5.8.0 WSS endpoint. You can see the cycle clearly in the first dozen CCS-SDK entries — <span className="mono" style={{color:"var(--mint)"}}>sip.Registrar</span> | Waiting toggled to true immediately, followed by Waiting toggled to false after 100ms. In a tight loop, while upstream Kamailio kept replying 200 OK to OPTIONS keepalives<Cursor color="var(--violet)"/>
      </div>
    </div>

    {/* Chat input */}
    <div style={{padding:"10px 14px",borderTop:"0.5px solid var(--line)",background:"rgba(0,0,0,0.2)"}}>
      <div className="field" style={{padding:"8px 11px"}}>
        <Icon name="spark" size={13} stroke="var(--violet)"/>
        <input placeholder="Ask about these logs…" style={{fontSize:12}}/>
        <span className="kbd">⏎</span>
      </div>
    </div>
  </div>
);

const StepBadge = ({ n, label, active, done }) => (
  <div style={{display:"inline-flex",alignItems:"center",gap:5}}>
    <span style={{
      width:16,height:16,borderRadius:"50%",
      display:"inline-flex",alignItems:"center",justifyContent:"center",
      fontSize:9,fontWeight:600,
      background: done?"var(--mint)":active?"var(--violet)":"rgba(255,255,255,0.05)",
      color: done||active?"#0a1e15":"var(--ink-3)",
      boxShadow: active?"0 0 8px var(--violet)":"none"
    }}>{done?"✓":n}</span>
    <span style={{color: done?"var(--mint)":active?"var(--violet)":"var(--ink-3)",fontSize:10.5,letterSpacing:"0.08em"}}>{label}</span>
  </div>
);

Object.assign(window, { InvestigateRoom });
