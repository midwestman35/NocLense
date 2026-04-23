// GX Dashboard — Editorial direction, M3 tonal surfaces

const { GXWindow, GXIcon, GXMono, PulseDot, GXSpark, GXLogo, GXAvatar, IntPill, GXCorrelation } = window;

const INVS = [
  { id:"41637", sev:"high",  open:true,  title:"Dispatch 4 — cannot hear caller audio on 911 calls (intermittent)", assignee:"KN", aname:"K. Nguyen",  cnc:"us-wa-macc911-apex",  phase:"Investigate", pct:0.72, last:"2m",  events:2386, aiState:"confirmed",  spark:[4,6,5,7,9,7,11,9,14,10,16,12] },
  { id:"41629", sev:"med",   open:true,  title:"Station 17 intermittent registration flaps after 03:00 UTC",       assignee:"KN", aname:"K. Nguyen",  cnc:"us-ny-manh911",       phase:"Submit",      pct:0.94, last:"11m", events:1129, aiState:"drafted",    spark:[8,7,9,6,7,5,6,4,5,3,4,3] },
  { id:"41615", sev:"low",   open:true,  title:"Operator extension 4421 unable to login — SSO timeout",            assignee:"MA", aname:"M. Alvarez", cnc:"eu-de-berlin-ops",    phase:"Investigate", pct:0.38, last:"48m", events:844,  aiState:"thinking",   spark:[3,4,3,5,4,6,5,7,8,7,9,8] },
  { id:"41601", sev:"high",  open:false, title:"CAD map tiles failing to load for dispatcher cluster B",            assignee:"DP", aname:"D. Park",    cnc:"us-ca-bayarea-911",   phase:"Closed",      pct:1,    last:"3h",  events:5612, aiState:"resolved",   spark:[12,10,8,6,4,3,2,1,1,1,1,0] },
  { id:"41588", sev:"med",   open:false, title:"Text-to-911 message queue backlog cleared after SIP restart",       assignee:"KN", aname:"K. Nguyen",  cnc:"us-tx-austin-911",    phase:"Closed",      pct:1,    last:"yesterday", events:3201, aiState:"resolved", spark:[9,10,8,9,7,8,6,5,4,3,2,1] },
];

const sevChip = s => (
  <span className={`gx-chip ${s}`} style={{padding:"3px 10px",fontSize:10.5}}>
    {s.toUpperCase()}
  </span>
);

const aiLabel = {
  confirmed: { color:"var(--gx-primary)",   t:"Hypothesis confirmed" },
  drafted:   { color:"var(--gx-primary)",   t:"Closure note drafted" },
  thinking:  { color:"var(--gx-tertiary)",  t:"Analyzing…" },
  resolved:  { color:"var(--gx-outline)",   t:"Resolved" },
};

const GXDashEditorial = () => {
  const open   = INVS.filter(i => i.open);
  const closed = INVS.filter(i => !i.open);

  return (
    <GXWindow
      title="NocLense"
      right={<><span className="mono">⌘K</span><span style={{margin:"0 8px",color:"var(--gx-outline-variant)"}}>·</span><span className="mono" style={{color:"var(--gx-primary)"}}>⬤ connected</span></>}
    >
      <div style={{display:"grid",gridTemplateColumns:"220px 1fr",height:"100%"}}>
        {/* sidebar */}
        <GXSidebar/>

        {/* main */}
        <div style={{position:"relative",overflow:"hidden",background:"var(--gx-surface-dim)"}}>
          {/* aurora accent */}
          <div style={{position:"absolute",top:0,left:0,right:0,height:300,
            background:"radial-gradient(70% 50% at 70% 0%, rgba(0,82,45,0.28), transparent 80%)",
            pointerEvents:"none"}}/>

          <div className="no-scroll" style={{height:"100%",padding:"44px 52px 60px",position:"relative",zIndex:1}}>
            {/* greeting row */}
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:36}}>
              <div>
                <GXMono caps size={10.5} tracking="0.18em" color="var(--gx-outline)" style={{display:"block",marginBottom:12}}>
                  Tuesday · Apr 22 · 02:14 PDT
                </GXMono>
                <h1 style={{fontSize:44,fontWeight:800,letterSpacing:"-0.03em",margin:0,lineHeight:1.05,color:"var(--gx-on-surface)"}}>
                  Good evening,{" "}
                  <span style={{color:"var(--gx-primary)",fontStyle:"italic",fontWeight:700}}>Kev.</span>
                </h1>
                <p style={{fontSize:15,color:"var(--gx-on-surface-variant)",margin:"10px 0 0",lineHeight:1.5}}>
                  3 open investigations, 1 flagged high. Shift ends in 4h 18m.
                </p>
              </div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button className="gx-btn surface" style={{gap:8}}>
                  <GXIcon name="import" size={14}/> Import logs
                </button>
                <button className="gx-btn filled" style={{gap:8}}>
                  <GXIcon name="plus" size={14}/> New investigation
                </button>
              </div>
            </div>

            {/* continue card */}
            <ContinueCard inv={open[0]}/>

            {/* open list */}
            <SectionLabel label="Open" count={3} hint="correlate · diagnose · close"/>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
              {open.map(i => <InvRow key={i.id} i={i}/>)}
            </div>

            <SectionLabel label="Closed this week" hint="archived to Confluence" mt={40}/>
            <div style={{display:"flex",flexDirection:"column"}}>
              {closed.map(i => <ClosedRow key={i.id} i={i}/>)}
            </div>

            {/* footer */}
            <div style={{marginTop:52,paddingTop:24,borderTop:`1px solid var(--gx-outline-variant)`,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <GXMono size={11} color="var(--gx-outline)">12 operators online · global</GXMono>
              <GXMono size={11} color="var(--gx-outline)">Unleashed AI · 12k / 128k tokens</GXMono>
              <GXMono size={11} color="var(--gx-primary)">⬤ carbyne.zendesk.com · datadoghq.eu</GXMono>
            </div>
          </div>
        </div>
      </div>
    </GXWindow>
  );
};

const GXSidebar = () => {
  const items = [
    { id:"home", icon:"home",     label:"Home",         kbd:"⌘1" },
    { id:"imp",  icon:"import",   label:"Import",       kbd:"⌘2" },
    { id:"inv",  icon:"radar",    label:"Investigate",  kbd:"⌘3" },
    { id:"sub",  icon:"check2",   label:"Submit",       kbd:"⌘4" },
  ];
  const ints = [
    { icon:"zendesk",    label:"Zendesk",    meta:"14 open" },
    { icon:"datadog",    label:"Datadog",    meta:"live" },
    { icon:"confluence", label:"Confluence", meta:"stale 3d" },
    { icon:"db",         label:"Jira",       meta:"3 open" },
  ];
  return (
    <aside className="gx-rail">
      {/* logo */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"6px 8px",marginBottom:14}}>
        <GXLogo size={28}/>
        <div>
          <div style={{fontSize:14,fontWeight:700,letterSpacing:"-0.01em",color:"var(--gx-on-surface)"}}>NocLense</div>
          <GXMono caps size={9.5} tracking="0.14em" color="var(--gx-outline)">Carbyne · NOC</GXMono>
        </div>
      </div>

      {items.map((it,idx) => (
        <div key={it.id} className={`gx-nav-item${idx===0?" active":""}`}>
          <GXIcon name={it.icon} size={17}/>
          <span style={{flex:1}}>{it.label}</span>
          <GXMono size={10.5} color={idx===0?"var(--gx-on-secondary-c)":"var(--gx-outline)"}>{it.kbd}</GXMono>
        </div>
      ))}

      <div style={{height:1,background:"var(--gx-outline-variant)",margin:"12px 8px"}}/>
      <GXMono caps size={9.5} tracking="0.2em" color="var(--gx-outline)" style={{padding:"0 8px",marginBottom:4}}>Integrations</GXMono>

      {ints.map(it => (
        <div key={it.label} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:"var(--gx-lg)",cursor:"pointer",color:"var(--gx-on-surface-variant)"}}>
          <GXIcon name={it.icon} size={15}/>
          <span style={{flex:1,fontSize:13}}>{it.label}</span>
          <GXMono size={10.5} color="var(--gx-outline)">{it.meta}</GXMono>
        </div>
      ))}

      <div style={{flex:1}}/>
      {/* user */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:"var(--gx-xl)",background:"var(--gx-surface-high)",border:"1px solid var(--gx-outline-variant)"}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg, var(--gx-secondary-c), var(--gx-primary-c))",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"var(--gx-on-secondary-c)",flexShrink:0}}>KN</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--gx-on-surface)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>K. Nguyen</div>
          <GXMono caps size={9.5} tracking="0.12em" color="var(--gx-outline)">Shift A</GXMono>
        </div>
        <GXIcon name="gear" size={15} stroke="var(--gx-outline)"/>
      </div>
    </aside>
  );
};

const ContinueCard = ({ inv: i }) => (
  <div className="gx-card-primary" style={{marginBottom:44,position:"relative",overflow:"hidden"}}>
    {/* glow accent */}
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg, transparent, var(--gx-primary), transparent)",opacity:0.7}}/>

    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <span className="gx-chip primary" style={{gap:6}}><PulseDot size={5}/>Continue where you left off</span>
      {sevChip(i.sev)}
      <GXMono size={11} color="var(--gx-on-primary-c)">#{i.id} · last touched {i.last} ago</GXMono>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
        <GXIcon name="spark" size={13} stroke="var(--gx-tertiary)"/>
        <span style={{fontSize:12.5,color:"var(--gx-tertiary)"}}>Unleashed AI has a hypothesis</span>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:32,alignItems:"center"}}>
      <div>
        <h2 style={{fontSize:20,fontWeight:700,letterSpacing:"-0.015em",margin:0,lineHeight:1.25,color:"var(--gx-on-primary-c)"}}>
          {i.title}
        </h2>
        <div style={{display:"flex",gap:20,marginTop:12}}>
          <GXMono size={11.5} color="var(--gx-primary)">cnc · {i.cnc}</GXMono>
          <GXMono size={11.5} color="var(--gx-on-primary-c)">{i.events.toLocaleString()} events</GXMono>
          <GXMono size={11.5} color="var(--gx-primary)">{i.phase}</GXMono>
        </div>
        <div style={{display:"flex",gap:8,marginTop:18}}>
          <button className="gx-btn filled" style={{gap:8}}>
            <GXIcon name="arrow" size={14}/>Resume investigation
          </button>
          <button className="gx-btn ghost" style={{gap:8,color:"var(--gx-on-primary-c)"}}>
            <GXIcon name="file" size={14}/>Review draft
          </button>
        </div>
      </div>
      <GXCorrelation width={260} height={150}/>
    </div>
  </div>
);

const SectionLabel = ({ label, count, hint, mt=0 }) => (
  <div style={{display:"flex",alignItems:"baseline",gap:14,marginTop:mt,paddingBottom:14,borderBottom:`1px solid var(--gx-outline-variant)`}}>
    <span style={{fontSize:12,fontWeight:700,color:"var(--gx-on-surface)",letterSpacing:"-0.005em"}}>{label}{count ? ` · ${count}` : ""}</span>
    <GXMono size={11} color="var(--gx-outline)">{hint}</GXMono>
  </div>
);

const InvRow = ({ i }) => (
  <div style={{
    display:"grid",gridTemplateColumns:"72px 1fr 220px 180px 110px 28px",gap:18,alignItems:"center",
    padding:"14px 18px",background:"var(--gx-surface-c)",borderRadius:"var(--gx-lg)",cursor:"pointer",
    transition:"background .15s",
  }}
  onMouseEnter={e=>e.currentTarget.style.background="var(--gx-surface-high)"}
  onMouseLeave={e=>e.currentTarget.style.background="var(--gx-surface-c)"}>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <GXMono size={12} color="var(--gx-on-surface)">#{i.id}</GXMono>
      {sevChip(i.sev)}
    </div>
    <div style={{minWidth:0}}>
      <div style={{fontSize:14,fontWeight:600,color:"var(--gx-on-surface)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i.title}</div>
      <div style={{marginTop:4,display:"flex",gap:10}}>
        <GXMono size={11} color="var(--gx-outline)">{i.cnc}</GXMono>
        <GXMono size={11} color="var(--gx-outline)">{i.events.toLocaleString()} events</GXMono>
        <GXMono size={11} color="var(--gx-outline)">last {i.last}</GXMono>
      </div>
    </div>
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
        <GXSpark data={i.spark} color={i.sev==="high"?"var(--gx-error)":i.sev==="med"?"var(--gx-warning)":"var(--gx-primary)"} w={60} h={18}/>
        <GXMono size={10.5} color="var(--gx-outline)">{i.phase.toUpperCase()}</GXMono>
      </div>
      <div className="gx-progress">
        <div className="gx-progress-fill" style={{width:`${i.pct*100}%`,
          background: i.sev==="high"?"var(--gx-error)":i.sev==="med"?"var(--gx-warning)":"var(--gx-primary)"
        }}/>
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:7}}>
      <GXIcon name="spark" size={13} stroke={aiLabel[i.aiState].color}/>
      <span style={{fontSize:12,color:aiLabel[i.aiState].color,fontWeight:500}}>{aiLabel[i.aiState].t}</span>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:7}}>
      <div style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,var(--gx-secondary-c),var(--gx-primary-c))",
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:9.5,fontWeight:700,color:"var(--gx-on-secondary-c)"}}>
        {i.assignee}
      </div>
      <GXMono size={10.5} color="var(--gx-on-surface-variant)">{i.aname}</GXMono>
    </div>
    <GXIcon name="chevron" size={15} stroke="var(--gx-outline)"/>
  </div>
);

const ClosedRow = ({ i }) => (
  <div style={{display:"grid",gridTemplateColumns:"72px 1fr 180px 80px 120px",gap:18,alignItems:"center",
    padding:"12px 4px",borderBottom:`1px solid var(--gx-outline-variant)`}}>
    <GXMono size={11.5} color="var(--gx-outline)">#{i.id}</GXMono>
    <div style={{fontSize:13,color:"var(--gx-on-surface-variant)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i.title}</div>
    <GXMono size={11} color="var(--gx-outline)">{i.cnc}</GXMono>
    <GXMono size={11} color="var(--gx-outline)">{i.last}</GXMono>
    <div style={{display:"flex",alignItems:"center",gap:7}}>
      <GXIcon name="check2" size={13} stroke="var(--gx-primary)"/>
      <GXMono size={11} color="var(--gx-primary)">Archived</GXMono>
    </div>
  </div>
);

Object.assign(window, { GXDashEditorial, GXSidebar });
