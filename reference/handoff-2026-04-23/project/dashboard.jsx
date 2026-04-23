// Dashboard variations for NocLense standalone.
// Two directions:
//  D1. "Editorial" — minimal recent investigations list, generous whitespace, large type
//  D2. "Triage-dense" — more NOC-ops command surface, metrics strip + denser list + live log peek

const { MacWindow, Icon, Cursor, Spark, LogHistogram, Ambient } = window;
const { LogoMark } = window;

/* Shared fake data */
const INVESTIGATIONS = [
  { id:"41637", sev:"high",  open:true,  title:"Dispatch 4 — cannot hear caller audio on 911 calls (intermittent)", assignee:"K. Nguyen", cnc:"us-wa-macc911-apex",  phase:"Investigate", progress:0.72, lastEvent:"2m", events:2386, ai:"confirmed", color:"amber", spark:[4,6,5,7,9,7,11,9,14,10,16,12] },
  { id:"41629", sev:"med",   open:true,  title:"Station 17 intermittent registration flaps after 03:00 UTC",         assignee:"K. Nguyen", cnc:"us-ny-manh911",       phase:"Submit",      progress:0.94, lastEvent:"11m", events:1129, ai:"drafted",   color:"mint",  spark:[8,7,9,6,7,5,6,4,5,3,4,3] },
  { id:"41615", sev:"low",   open:true,  title:"Operator extension 4421 unable to login — SSO timeout",              assignee:"M. Alvarez",cnc:"eu-de-berlin-ops",    phase:"Investigate", progress:0.38, lastEvent:"48m", events:844,  ai:"thinking",  color:"violet",spark:[3,4,3,5,4,6,5,7,8,7,9,8] },
  { id:"41601", sev:"high",  open:false, title:"CAD map tiles failing to load for dispatcher cluster B",              assignee:"D. Park",   cnc:"us-ca-bayarea-911",   phase:"Closed",      progress:1,    lastEvent:"3h",  events:5612, ai:"resolved",  color:"mint",  spark:[12,10,8,6,4,3,2,2,1,1,1,0] },
  { id:"41588", sev:"med",   open:false, title:"Text-to-911 message queue backlog cleared after SIP restart",         assignee:"K. Nguyen", cnc:"us-tx-austin-911",    phase:"Closed",      progress:1,    lastEvent:"yesterday", events:3201, ai:"resolved", color:"mint", spark:[9,10,8,9,7,8,6,5,4,3,2,1] },
  { id:"41574", sev:"low",   open:false, title:"Kamailio keepalive drift on standby PBX · warning-level only",        assignee:"M. Alvarez",cnc:"ca-on-toronto-911",   phase:"Closed",      progress:1,    lastEvent:"yesterday", events:612,  ai:"resolved", color:"mint", spark:[3,3,4,3,4,3,3,2,2,2,1,1] },
];

const sevColor = s => s==="high"?"var(--red)":s==="med"?"var(--amber)":"var(--ink-2)";
const sevBg    = s => s==="high"?"rgba(255,107,122,0.1)":s==="med"?"rgba(247,185,85,0.1)":"rgba(255,255,255,0.04)";

/* ——————————————————————————————————————————————————————
   D1 · Editorial Dashboard
   Sidebar · big heading · Continue card · investigations table
   —————————————————————————————————————————————————————— */
const DashEditorial = () => {
  const open = INVESTIGATIONS.filter(i => i.open);
  const closed = INVESTIGATIONS.filter(i => !i.open);

  return (
    <MacWindow
      title="NocLense"
      right={<>
        <span className="mono">⌘K</span>
        <span style={{opacity:0.4}}>·</span>
        <span className="mono" style={{color:"var(--mint)"}}>⬤ connected</span>
      </>}
    >
      <div style={{display:"grid",gridTemplateColumns:"220px 1fr",height:"100%",background:"var(--bg-0)"}}>
        <Sidebar active="home"/>
        <div style={{overflow:"hidden",position:"relative",background:"linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 60%)"}}>
          {/* subtle aurora */}
          <div style={{position:"absolute",inset:0,background:"radial-gradient(60% 40% at 80% 0%, rgba(142,240,183,0.08), transparent 70%)",pointerEvents:"none"}}/>

          <div className="no-scrollbar" style={{position:"relative",zIndex:1,overflowY:"auto",height:"100%",padding:"44px 56px 64px"}}>
            {/* greeting */}
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:38}}>
              <div>
                <div style={{fontFamily:'"Geist Mono",monospace',fontSize:11,color:"var(--ink-3)",letterSpacing:"0.16em",marginBottom:10}}>
                  TUESDAY · APR 22 · 02:14 PDT
                </div>
                <h1 style={{fontSize:40,fontWeight:400,letterSpacing:"-0.025em",margin:0,color:"var(--ink-0)",lineHeight:1.1}}>
                  Good evening, <span className="serif" style={{color:"var(--mint)"}}>Kev</span>.
                </h1>
                <p style={{fontSize:14.5,color:"var(--ink-2)",margin:"10px 0 0",maxWidth:520,lineHeight:1.5}}>
                  3 open investigations, 1 flagged high. Your shift runs for another 4h 18m.
                </p>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn"><Icon name="import" size={14}/> Import logs <span className="kbd" style={{marginLeft:4}}>⌘O</span></button>
                <button className="btn primary"><Icon name="plus" size={14}/> New investigation</button>
              </div>
            </div>

            {/* Continue card */}
            <ContinueCard investigation={open[0]}/>

            {/* Open investigations list */}
            <SectionHeader label="Open · 3" hint="—  correlate, diagnose, close"/>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:18}}>
              {open.map(i => <InvestigationRow key={i.id} i={i}/>)}
            </div>

            <SectionHeader label="Recently closed · this week" hint="— archived to Confluence"/>
            <div style={{display:"flex",flexDirection:"column",gap:0,marginTop:12}}>
              {closed.map(i => <ClosedRow key={i.id} i={i}/>)}
            </div>

            <div style={{marginTop:56,paddingTop:28,borderTop:"0.5px solid var(--line)",display:"flex",justifyContent:"space-between",alignItems:"center",color:"var(--ink-3)",fontSize:11.5,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.08em"}}>
              <span>12 operators online · global</span>
              <span>Unleashed AI · 12k / 128k tokens</span>
              <span style={{color:"var(--mint)"}}>⬤ carbyne.zendesk.com · datadoghq.eu</span>
            </div>
          </div>
        </div>
      </div>
    </MacWindow>
  );
};

/* ——— D1 pieces ——— */

const Sidebar = ({ active }) => {
  const items = [
    { id:"home",   icon:"activity", label:"Home",         kbd:"⌘1" },
    { id:"imp",    icon:"import",   label:"Import",       kbd:"⌘2" },
    { id:"inv",    icon:"radar",    label:"Investigate",  kbd:"⌘3" },
    { id:"sub",    icon:"check",    label:"Submit",       kbd:"⌘4" },
  ];
  const refs = [
    { icon:"ticket", label:"Zendesk queue", meta:"14" },
    { icon:"db",     label:"Datadog",       meta:"live" },
    { icon:"doc",    label:"Confluence",    meta:"·" },
    { icon:"terminal", label:"AWS console", meta:"" },
  ];
  return (
    <aside style={{
      borderRight:"0.5px solid var(--line)",
      background:"linear-gradient(180deg, rgba(255,255,255,0.02), transparent)",
      display:"flex",flexDirection:"column",padding:"20px 14px",gap:4,
    }}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 8px",marginBottom:12}}>
        <LogoMark size={24}/>
        <div>
          <div style={{fontSize:13,fontWeight:500,letterSpacing:"-0.01em"}}>NocLense</div>
          <div style={{fontSize:10,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',letterSpacing:"0.1em"}}>CARBYNE · NOC</div>
        </div>
      </div>

      {items.map(it => (
        <div key={it.id} style={{
          display:"flex",alignItems:"center",gap:10,
          padding:"7px 10px",borderRadius:7,fontSize:13,
          color: active===it.id ? "var(--ink-0)" : "var(--ink-1)",
          background: active===it.id ? "rgba(255,255,255,0.05)" : "transparent",
          border:`0.5px solid ${active===it.id?"var(--line-2)":"transparent"}`,
          cursor:"pointer",
        }}>
          <Icon name={it.icon} size={14}/>
          <span style={{flex:1}}>{it.label}</span>
          <span className="kbd" style={{fontSize:10}}>{it.kbd}</span>
        </div>
      ))}

      <div style={{fontSize:10,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',letterSpacing:"0.14em",margin:"20px 10px 8px"}}>INTEGRATIONS</div>
      {refs.map(r => (
        <div key={r.label} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",borderRadius:7,fontSize:12.5,color:"var(--ink-2)",cursor:"pointer"}}>
          <Icon name={r.icon} size={13}/>
          <span style={{flex:1}}>{r.label}</span>
          <span style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>{r.meta}</span>
        </div>
      ))}

      <div style={{flex:1}}/>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 8px",borderRadius:8,border:"0.5px solid var(--line)",background:"rgba(255,255,255,0.02)"}}>
        <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#8ef0b7,#4fb987)",display:"flex",alignItems:"center",justifyContent:"center",color:"#0a1e15",fontSize:11,fontWeight:600}}>KN</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>K. Nguyen</div>
          <div style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',letterSpacing:"0.08em"}}>SHIFT · A</div>
        </div>
        <Icon name="gear" size={13} stroke="var(--ink-3)"/>
      </div>
    </aside>
  );
};

const ContinueCard = ({ investigation: i }) => (
  <div className="glass" style={{padding:"22px 26px",marginBottom:48,position:"relative",overflow:"hidden"}}>
    {/* shimmer accent on left */}
    <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:"linear-gradient(180deg, transparent, var(--mint), transparent)",opacity:0.7}}/>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
      <span className="tag"><span style={{width:5,height:5,borderRadius:"50%",background:"var(--mint)"}} className="nl-pulse-dot"/> Continue where you left off</span>
      <span className="tag amber" style={{textTransform:"uppercase"}}>HIGH</span>
      <span style={{fontFamily:'"Geist Mono",monospace',fontSize:11.5,color:"var(--ink-3)"}}>#{i.id} · last touched 2m ago</span>
      <span style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center",fontSize:11.5,color:"var(--ink-2)"}}>
        <Icon name="spark" size={12} stroke="var(--violet)"/> Unleashed AI has a hypothesis
      </span>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:32,alignItems:"center"}}>
      <div>
        <div style={{fontSize:22,fontWeight:500,letterSpacing:"-0.015em",lineHeight:1.25,color:"var(--ink-0)",textWrap:"balance"}}>
          {i.title}
        </div>
        <div style={{display:"flex",gap:16,marginTop:14,fontSize:12,color:"var(--ink-2)",fontFamily:'"Geist Mono",monospace'}}>
          <span><span style={{color:"var(--ink-3)"}}>cnc ·</span> {i.cnc}</span>
          <span><span style={{color:"var(--ink-3)"}}>events ·</span> {i.events.toLocaleString()}</span>
          <span><span style={{color:"var(--ink-3)"}}>phase ·</span> <span style={{color:"var(--mint)"}}>{i.phase}</span></span>
        </div>
        <div style={{display:"flex",gap:8,marginTop:18}}>
          <button className="btn primary"><Icon name="arrowRight" size={13}/> Resume investigation</button>
          <button className="btn"><Icon name="doc" size={13}/> Review closure note draft</button>
          <button className="btn ghost" style={{color:"var(--ink-3)"}}><Icon name="dots" size={14}/></button>
        </div>
      </div>
      {/* correlation graph preview */}
      <CorrelationGlyph/>
    </div>
  </div>
);

const CorrelationGlyph = () => (
  <div style={{position:"relative",height:180,borderLeft:"0.5px solid var(--line)",paddingLeft:28}}>
    <div style={{fontSize:10.5,letterSpacing:"0.14em",color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',marginBottom:10}}>CORRELATION · SIP FLOW</div>
    <svg width="100%" height="140" viewBox="0 0 260 140" style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="node-mint" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--mint)" stopOpacity="1"/>
          <stop offset="100%" stopColor="var(--mint)" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* arcs */}
      <path d="M20,70 C 80,20 160,120 240,50" stroke="var(--mint)" strokeWidth="1" fill="none" opacity="0.5" strokeDasharray="2 3"/>
      <path d="M20,70 C 80,120 160,30 240,100" stroke="var(--violet)" strokeWidth="1" fill="none" opacity="0.4" strokeDasharray="2 3"/>
      <path d="M20,70 L 100,70 L 180,70 L 240,70" stroke="var(--amber)" strokeWidth="1" fill="none" opacity="0.3"/>
      {/* nodes */}
      {[[20,70,"mint"],[100,70,"amber"],[180,70,"amber"],[240,70,"mint"],[100,25,"mint"],[180,115,"violet"],[100,115,"violet"],[180,25,"mint"]].map(([x,y,c],i)=>(
        <g key={i}>
          <circle cx={x} cy={y} r="12" fill={`url(#node-mint)`} opacity="0.25"/>
          <circle cx={x} cy={y} r="3.5" fill={`var(--${c})`}/>
        </g>
      ))}
      {/* active pulsing node */}
      <circle cx="100" cy="70" r="5" fill="none" stroke="var(--amber)" strokeWidth="1" style={{transformOrigin:"100px 70px",animation:"nl-ring 2s ease-out infinite"}}/>
    </svg>
    <div style={{position:"absolute",bottom:0,left:28,right:0,fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',letterSpacing:"0.08em"}}>
      8 calls · 3 stations · <span style={{color:"var(--amber)"}}>1 anomaly</span>
    </div>
  </div>
);

const SectionHeader = ({ label, hint }) => (
  <div style={{display:"flex",alignItems:"baseline",gap:14,marginTop:44,paddingBottom:14,borderBottom:"0.5px solid var(--line)"}}>
    <div style={{fontSize:11,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.16em",color:"var(--ink-1)",textTransform:"uppercase"}}>{label}</div>
    <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>{hint}</div>
  </div>
);

const aiStates = {
  confirmed: { color:"var(--mint)",   label:"Hypothesis confirmed" },
  drafted:   { color:"var(--mint)",   label:"Closure note drafted" },
  thinking:  { color:"var(--violet)", label:"Analyzing · 42s" },
  resolved:  { color:"var(--ink-2)",  label:"Resolved" },
};

const InvestigationRow = ({ i }) => (
  <div style={{
    display:"grid",gridTemplateColumns:"72px 1fr 220px 140px 100px 32px",gap:20,alignItems:"center",
    padding:"14px 18px",
    background:"linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))",
    border:"0.5px solid var(--line)",borderRadius:10,
    transition:"border-color .15s, background .15s",cursor:"pointer"
  }} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--line-bright)"}
     onMouseLeave={e=>e.currentTarget.style.borderColor="var(--line)"}>
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      <span style={{fontFamily:'"Geist Mono",monospace',fontSize:12,color:"var(--ink-1)"}}>#{i.id}</span>
      <span style={{
        fontFamily:'"Geist Mono",monospace',fontSize:9.5,letterSpacing:"0.1em",textTransform:"uppercase",
        padding:"1px 6px",borderRadius:3,width:"fit-content",
        background:sevBg(i.sev),color:sevColor(i.sev),border:`0.5px solid ${sevColor(i.sev)}33`
      }}>{i.sev}</span>
    </div>

    <div style={{minWidth:0}}>
      <div style={{fontSize:14,color:"var(--ink-0)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:450}}>{i.title}</div>
      <div style={{fontSize:11.5,color:"var(--ink-3)",marginTop:3,fontFamily:'"Geist Mono",monospace'}}>
        <span>{i.cnc}</span><span style={{margin:"0 8px",opacity:0.4}}>·</span><span>{i.events.toLocaleString()} events</span><span style={{margin:"0 8px",opacity:0.4}}>·</span><span>last {i.lastEvent}</span>
      </div>
    </div>

    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <Spark data={i.spark} color={sevColor(i.sev)} w={64} h={20}/>
      <div style={{flex:1}}>
        <div style={{height:3,borderRadius:100,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
          <div style={{width:`${i.progress*100}%`,height:"100%",background:aiStates[i.ai].color,boxShadow:`0 0 6px ${aiStates[i.ai].color}`}}/>
        </div>
        <div style={{fontSize:10.5,color:"var(--ink-3)",marginTop:4,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.06em"}}>{i.phase.toUpperCase()}</div>
      </div>
    </div>

    <div style={{display:"flex",alignItems:"center",gap:7,fontSize:11.5,color:aiStates[i.ai].color,fontFamily:'"Geist Mono",monospace'}}>
      <Icon name="spark" size={12}/>
      <span>{aiStates[i.ai].label}</span>
    </div>

    <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5,color:"var(--ink-2)"}}>
      <div style={{width:18,height:18,borderRadius:"50%",background:"linear-gradient(135deg,#334155,#1f2937)",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--ink-1)"}}>
        {i.assignee.split(" ").map(s=>s[0]).join("")}
      </div>
      <span style={{fontFamily:'"Geist Mono",monospace',fontSize:10.5}}>{i.assignee.split(" ")[0][0]}. {i.assignee.split(" ")[1]}</span>
    </div>

    <Icon name="chevron" size={14} stroke="var(--ink-3)"/>
  </div>
);

const ClosedRow = ({ i }) => (
  <div style={{display:"grid",gridTemplateColumns:"72px 1fr 160px 110px 120px",gap:20,alignItems:"center",padding:"12px 0",borderBottom:"0.5px solid var(--line)",color:"var(--ink-2)"}}>
    <span style={{fontFamily:'"Geist Mono",monospace',fontSize:11.5,color:"var(--ink-3)"}}>#{i.id}</span>
    <span style={{fontSize:13,color:"var(--ink-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i.title}</span>
    <span style={{fontFamily:'"Geist Mono",monospace',fontSize:11,color:"var(--ink-3)"}}>{i.cnc}</span>
    <span style={{fontSize:11.5,fontFamily:'"Geist Mono",monospace',color:"var(--ink-3)"}}>{i.lastEvent}</span>
    <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11.5,color:"var(--mint-dim)",fontFamily:'"Geist Mono",monospace'}}>
      <Icon name="check" size={12}/> Archived
    </span>
  </div>
);

/* ——————————————————————————————————————————————————————
   D2 · Triage-dense Dashboard
   Command-surface: top metrics strip, live log peek, dense list,
   right rail with AI activity + queue health
   —————————————————————————————————————————————————————— */
const DashTriage = () => (
  <MacWindow
    title="NocLense · Triage"
    right={<><span className="mono" style={{color:"var(--ink-3)"}}>carbyne.zendesk.com</span><span style={{opacity:0.4}}>·</span><span className="mono" style={{color:"var(--mint)"}}>⬤ live</span></>}
  >
    <div style={{display:"grid",gridTemplateColumns:"64px 1fr 340px",height:"100%",background:"var(--bg-0)"}}>
      {/* rail */}
      <RailNarrow/>
      {/* main */}
      <div className="no-scrollbar" style={{overflow:"auto",padding:"20px 28px 28px",position:"relative"}}>
        {/* bg */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:220,background:"radial-gradient(60% 60% at 50% 0%, rgba(142,240,183,0.06), transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          <HeaderBar/>
          <MetricsStrip/>
          <LiveLogPeek/>
          <TriageTable/>
        </div>
      </div>
      {/* right rail */}
      <RightRail/>
    </div>
  </MacWindow>
);

/* ——— D2 pieces ——— */

const RailNarrow = () => {
  const items = [
    { icon:"activity", active:true, label:"Home" },
    { icon:"import",  label:"Import" },
    { icon:"radar",   label:"Investigate" },
    { icon:"check",   label:"Submit" },
    { icon:"db",      label:"Datadog" },
    { icon:"ticket",  label:"Queue" },
  ];
  return (
    <aside style={{borderRight:"0.5px solid var(--line)",display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 0",gap:6,background:"linear-gradient(180deg, rgba(255,255,255,0.015), transparent)"}}>
      <div style={{marginBottom:8}}><LogoMark size={28}/></div>
      {items.map((it,i)=>(
        <div key={i} title={it.label} style={{
          width:38,height:38,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
          color: it.active?"var(--mint)":"var(--ink-2)",
          background: it.active?"rgba(142,240,183,0.06)":"transparent",
          border:`0.5px solid ${it.active?"rgba(142,240,183,0.25)":"transparent"}`,
          cursor:"pointer"
        }}>
          <Icon name={it.icon} size={16}/>
        </div>
      ))}
      <div style={{flex:1}}/>
      <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#8ef0b7,#4fb987)",display:"flex",alignItems:"center",justifyContent:"center",color:"#0a1e15",fontSize:12,fontWeight:600,marginTop:8}}>KN</div>
    </aside>
  );
};

const HeaderBar = () => (
  <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:22}}>
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <h1 style={{fontSize:22,fontWeight:500,letterSpacing:"-0.01em",margin:0}}>Triage</h1>
        <span className="tag"><span style={{width:5,height:5,borderRadius:"50%",background:"var(--mint)"}} className="nl-pulse-dot"/> LIVE</span>
      </div>
      <div style={{fontSize:11.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',marginTop:4,letterSpacing:"0.06em"}}>
        TUE · APR 22 · 02:14:38 PDT  ·  SHIFT A  ·  US/EU ROTATION
      </div>
    </div>
    <div style={{flex:1,display:"flex",justifyContent:"center"}}>
      <div style={{width:420}}>
        <div className="field" style={{padding:"8px 12px"}}>
          <span className="lead"><Icon name="search" size={13}/></span>
          <input placeholder="Search tickets, call-IDs, operators, stations…" style={{fontSize:12.5}}/>
          <span className="kbd">⌘K</span>
        </div>
      </div>
    </div>
    <button className="btn"><Icon name="import" size={13}/> Import</button>
    <button className="btn primary"><Icon name="plus" size={13}/> New</button>
  </div>
);

const MetricsStrip = () => {
  const metrics = [
    { label:"OPEN",     value:"3",      sub:"1 high · 1 med · 1 low", color:"var(--ink-0)",  spark:[1,2,3,2,3,3,3,3,3,3,3,3] },
    { label:"MTTR 24H", value:"07:41",  sub:"-12% vs 7d avg",         color:"var(--mint)",   spark:[9,8,9,7,8,6,7,5,6,4,5,4] },
    { label:"EVENTS/MIN", value:"2,386",sub:"us-wa-macc911-apex",     color:"var(--amber)",  spark:[3,5,4,6,8,6,9,7,11,9,12,10] },
    { label:"AI LATENCY", value:"14s",  sub:"Unleashed · p95",        color:"var(--violet)", spark:[4,3,4,3,5,4,3,4,3,4,3,3] },
    { label:"QUEUE",    value:"14",     sub:"3 escalated · 2 unread", color:"var(--ink-0)",  spark:[12,13,14,14,13,14,15,14,14,14,14,14] },
  ];
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:0,marginBottom:18,border:"0.5px solid var(--line)",borderRadius:12,overflow:"hidden",background:"rgba(255,255,255,0.015)"}}>
      {metrics.map((m,i)=>(
        <div key={i} style={{padding:"14px 16px",borderRight: i<4?"0.5px solid var(--line)":"none",position:"relative"}}>
          <div style={{fontSize:10,letterSpacing:"0.16em",color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>{m.label}</div>
          <div style={{fontSize:22,fontWeight:450,letterSpacing:"-0.015em",color:m.color,margin:"6px 0 2px",fontFamily:'"Geist Mono",monospace'}}>{m.value}</div>
          <div style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>{m.sub}</div>
          <div style={{position:"absolute",right:10,top:12,opacity:0.9}}><Spark data={m.spark} color={m.color} w={54} h={18} fill/></div>
        </div>
      ))}
    </div>
  );
};

const LiveLogPeek = () => (
  <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:14,marginBottom:22}}>
    <div style={{border:"0.5px solid var(--line)",borderRadius:12,padding:"12px 14px",background:"linear-gradient(180deg, rgba(255,255,255,0.02), transparent)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:"var(--mint)",boxShadow:"0 0 8px var(--mint)"}} className="nl-pulse-dot"/>
        <span style={{fontSize:10.5,letterSpacing:"0.16em",color:"var(--ink-2)",fontFamily:'"Geist Mono",monospace'}}>LIVE · #41637 · us-wa-macc911-apex</span>
        <span style={{marginLeft:"auto",fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>2,386 events / last 2h</span>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:1.5,height:56}}>
        <LogHistogram bars={100} height={56}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>
        <span>00:14</span><span>01:14</span><span style={{color:"var(--amber)"}}>02:14 · now</span>
      </div>
    </div>
    <div style={{border:"0.5px solid var(--line)",borderRadius:12,padding:"12px 14px",display:"flex",flexDirection:"column",gap:6,background:"linear-gradient(180deg, rgba(165,140,255,0.04), transparent)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <Icon name="spark" size={13} stroke="var(--violet)"/>
        <span style={{fontSize:11,color:"var(--violet)",letterSpacing:"0.14em",fontFamily:'"Geist Mono",monospace'}}>UNLEASHED AI</span>
      </div>
      <div style={{fontSize:13,color:"var(--ink-0)",lineHeight:1.4}}>
        "The SIP Registrar is flapping against the Kamailio 5.8 keepalive. <span style={{color:"var(--mint)"}}>Cycle confirmed</span> across 8 calls."
      </div>
      <div style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',marginTop:"auto"}}>
        hypothesis · 94% · cites 12 log lines
      </div>
    </div>
  </div>
);

const TriageTable = () => {
  const open = INVESTIGATIONS.filter(i => i.open);
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
        <div style={{fontSize:11,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.16em",color:"var(--ink-1)"}}>OPEN · 3</div>
        <div style={{flex:1,height:"0.5px",background:"var(--line)"}}/>
        <FilterChip label="Mine" active count={2}/>
        <FilterChip label="Team"/>
        <FilterChip label="High"/>
        <FilterChip label="Needs review"/>
        <button className="btn ghost" style={{padding:"4px 8px",fontSize:12}}><Icon name="filter" size={12}/> Filter</button>
      </div>

      {/* column headers */}
      <div style={{display:"grid",gridTemplateColumns:"60px 1fr 170px 180px 130px 24px",gap:16,alignItems:"center",padding:"6px 12px",fontSize:10,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.16em",color:"var(--ink-3)",textTransform:"uppercase"}}>
        <span>#</span><span>Ticket</span><span>Progress</span><span>AI</span><span>Assignee</span><span/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        {open.map(i => (
          <div key={i.id} style={{
            display:"grid",gridTemplateColumns:"60px 1fr 170px 180px 130px 24px",gap:16,alignItems:"center",
            padding:"12px 12px",borderRadius:8,cursor:"pointer",
            background:"linear-gradient(180deg, rgba(255,255,255,0.02), transparent)",
            border:"0.5px solid var(--line)"
          }}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:sevColor(i.sev),boxShadow:`0 0 6px ${sevColor(i.sev)}`}} className={i.sev==="high"?"nl-pulse-dot":""}/>
              <span style={{fontFamily:'"Geist Mono",monospace',fontSize:11.5,color:"var(--ink-1)"}}>{i.id}</span>
            </div>
            <div>
              <div style={{fontSize:13,color:"var(--ink-0)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i.title}</div>
              <div style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',marginTop:2}}>{i.cnc} · {i.events.toLocaleString()} events · last {i.lastEvent}</div>
            </div>
            <div>
              <div style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',marginBottom:4}}>{i.phase.toUpperCase()} · {Math.round(i.progress*100)}%</div>
              <div style={{height:3,borderRadius:100,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                <div style={{width:`${i.progress*100}%`,height:"100%",background:aiStates[i.ai].color,boxShadow:`0 0 8px ${aiStates[i.ai].color}`}}/>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7,fontSize:11.5,color:aiStates[i.ai].color,fontFamily:'"Geist Mono",monospace'}}>
              <Icon name="spark" size={12}/>{aiStates[i.ai].label}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5,color:"var(--ink-2)"}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"linear-gradient(135deg,#334155,#1f2937)",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--ink-1)"}}>
                {i.assignee.split(" ").map(s=>s[0]).join("")}
              </div>
              <span style={{fontFamily:'"Geist Mono",monospace',fontSize:10.5}}>{i.assignee}</span>
            </div>
            <Icon name="chevron" size={13} stroke="var(--ink-3)"/>
          </div>
        ))}
      </div>
    </div>
  );
};

const FilterChip = ({ label, active, count }) => (
  <div style={{
    padding:"4px 10px",borderRadius:100,fontSize:11.5,cursor:"pointer",
    display:"inline-flex",alignItems:"center",gap:6,
    background: active?"rgba(142,240,183,0.08)":"rgba(255,255,255,0.03)",
    border:`0.5px solid ${active?"rgba(142,240,183,0.3)":"var(--line-2)"}`,
    color: active?"var(--mint)":"var(--ink-2)"
  }}>
    {label}
    {count!=null && <span style={{fontFamily:'"Geist Mono",monospace',fontSize:10,color:active?"var(--mint)":"var(--ink-3)",opacity:0.8}}>{count}</span>}
  </div>
);

const RightRail = () => {
  return (
    <aside style={{borderLeft:"0.5px solid var(--line)",background:"linear-gradient(180deg, rgba(255,255,255,0.015), transparent)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div className="no-scrollbar" style={{overflowY:"auto",padding:"20px 18px 24px",display:"flex",flexDirection:"column",gap:18}}>
        {/* AI activity */}
        <div>
          <RailHeader icon="spark" color="var(--violet)" label="AI ACTIVITY"/>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:10}}>
            <AIActivity t="2m"  state="streaming" msg="Drafting closure note for #41637…"/>
            <AIActivity t="14m" state="ok" msg="Auto-tagged #41629 as SIP · keepalive drift · resolved"/>
            <AIActivity t="38m" state="ok" msg="Found 7 similar tickets for #41615 in Confluence"/>
            <AIActivity t="1h"  state="warn" msg="Datadog rate-limit on /logs · retrying"/>
          </div>
        </div>

        {/* Team */}
        <div>
          <RailHeader icon="user" color="var(--mint)" label="OPERATORS · 4 ACTIVE"/>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
            <OperatorRow initials="KN" name="Kev Nguyen"  status="investigating" ticket="#41637"/>
            <OperatorRow initials="MA" name="Maya Alvarez" status="drafting" ticket="#41629"/>
            <OperatorRow initials="DP" name="Dani Park"    status="idle"/>
            <OperatorRow initials="TS" name="Tomo Sato"    status="idle"/>
          </div>
        </div>

        {/* Integrations */}
        <div>
          <RailHeader icon="link" color="var(--ink-2)" label="INTEGRATIONS"/>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
            <IntegrationRow name="Zendesk"    detail="carbyne.zendesk.com" ok/>
            <IntegrationRow name="Datadog"    detail="datadoghq.eu" ok/>
            <IntegrationRow name="Unleashed"  detail="12k / 128k tokens" ok/>
            <IntegrationRow name="Confluence" detail="parent page stale 3d" warn/>
            <IntegrationRow name="Jira"       detail="CAR-123 · 3 open" ok/>
          </div>
        </div>
      </div>
    </aside>
  );
};

const RailHeader = ({ icon, color, label }) => (
  <div style={{display:"flex",alignItems:"center",gap:8}}>
    <Icon name={icon} size={12} stroke={color}/>
    <span style={{fontSize:10.5,letterSpacing:"0.16em",color:"var(--ink-2)",fontFamily:'"Geist Mono",monospace'}}>{label}</span>
    <div style={{flex:1,height:"0.5px",background:"var(--line)"}}/>
  </div>
);

const AIActivity = ({ t, state, msg }) => {
  const colorMap = { streaming:"var(--violet)", ok:"var(--mint)", warn:"var(--amber)" };
  return (
    <div style={{display:"grid",gridTemplateColumns:"28px 1fr",gap:10,alignItems:"flex-start"}}>
      <div style={{fontFamily:'"Geist Mono",monospace',fontSize:10,color:"var(--ink-3)",paddingTop:2}}>{t}</div>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:colorMap[state]}} className={state==="streaming"?"nl-pulse-dot":""}/>
          <span style={{fontSize:10,color:colorMap[state],fontFamily:'"Geist Mono",monospace',letterSpacing:"0.12em",textTransform:"uppercase"}}>{state}</span>
        </div>
        <div style={{fontSize:12.5,color:"var(--ink-1)",lineHeight:1.4}}>
          {state==="streaming" ? <>{msg}<Cursor/></> : msg}
        </div>
      </div>
    </div>
  );
};

const OperatorRow = ({ initials, name, status, ticket }) => {
  const colorMap = { investigating:"var(--amber)", drafting:"var(--mint)", idle:"var(--ink-3)" };
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0"}}>
      <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#334155,#1f2937)",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--ink-0)",fontWeight:500,position:"relative"}}>
        {initials}
        <span style={{position:"absolute",right:-1,bottom:-1,width:8,height:8,borderRadius:"50%",background:colorMap[status],border:"1.5px solid var(--bg-1)"}}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12.5,color:"var(--ink-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
        <div style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>{status}{ticket ? ` · ${ticket}`:""}</div>
      </div>
    </div>
  );
};

const IntegrationRow = ({ name, detail, ok, warn }) => (
  <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 8px",borderRadius:6,border:"0.5px solid var(--line)",background:"rgba(255,255,255,0.015)"}}>
    <span style={{width:6,height:6,borderRadius:"50%",background:ok?"var(--mint)":warn?"var(--amber)":"var(--ink-3)",boxShadow:`0 0 6px ${ok?"var(--mint)":warn?"var(--amber)":"transparent"}`}}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:12,color:"var(--ink-1)"}}>{name}</div>
      <div style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{detail}</div>
    </div>
  </div>
);

Object.assign(window, { DashEditorial, DashTriage });
