// Submit Room — closure note draft + evidence pack + handoff
const { MacWindow, Icon, Cursor, Spark } = window;
const { Sidebar, RoomTopbar } = window;

const SubmitRoom = () => (
  <MacWindow title="NocLense · Submit" right={<span className="mono" style={{color:"var(--mint)"}}>⬤ ready to hand off</span>}>
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr",height:"100%",background:"var(--bg-0)"}}>
      <Sidebar active="sub"/>
      <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <RoomTopbar ticket="41637" phase="Submit"/>
        <div style={{position:"absolute",top:72,left:240,right:0,height:200,background:"radial-gradient(50% 60% at 50% 0%, rgba(142,240,183,0.06), transparent 70%)",pointerEvents:"none"}}/>

        <div className="no-scrollbar" style={{flex:1,overflowY:"auto",padding:"36px 48px 48px",position:"relative"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            {/* Intro */}
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:26}}>
              <div>
                <div style={{fontFamily:'"Geist Mono",monospace',fontSize:11,color:"var(--ink-3)",letterSpacing:"0.16em",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{width:5,height:5,borderRadius:"50%",background:"var(--mint)"}} className="nl-pulse-dot"/>
                  — ROOM 3 / 3 · SUBMIT
                </div>
                <h1 style={{fontSize:32,fontWeight:400,letterSpacing:"-0.025em",margin:0,lineHeight:1.1,color:"var(--ink-0)"}}>
                  Review.
                </h1>
                <p style={{fontSize:13.5,color:"var(--ink-2)",margin:"8px 0 0",maxWidth:540,lineHeight:1.5}}>
                  Review your AI-drafted closure note, pin evidence, and hand off to Zendesk. A copy archives to Confluence for next time.
                </p>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn"><Icon name="arrowUpRight" size={13}/> Export .noclense</button>
                <button className="btn primary"><Icon name="check" size={13}/> Post to Zendesk</button>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:20}}>
              {/* LEFT — closure note */}
              <ClosureCard/>

              {/* RIGHT — evidence + integrations */}
              <div style={{display:"flex",flexDirection:"column",gap:20}}>
                <EvidenceCard/>
                <HandoffCard/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </MacWindow>
);

const ClosureCard = () => (
  <div className="glass" style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:14,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:"linear-gradient(180deg, transparent, var(--mint), transparent)",opacity:0.7}}/>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <Icon name="doc" size={13} stroke="var(--mint)"/>
      <span style={{fontSize:11,letterSpacing:"0.16em",color:"var(--ink-1)",fontFamily:'"Geist Mono",monospace'}}>CLOSURE NOTE</span>
      <span className="tag" style={{padding:"1px 7px",fontSize:9.5}}>AI-DRAFTED · 94% CONFIDENCE</span>
      <span style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center",fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>
        <span>EDITED 2m AGO</span>
        <Icon name="dots" size={14} stroke="var(--ink-3)"/>
      </span>
    </div>

    {/* Title row */}
    <div style={{fontSize:17,color:"var(--ink-0)",fontWeight:500,letterSpacing:"-0.01em",lineHeight:1.35}}>
      Confirmed: SIP registrar flapping against Kamailio WSS keepalive caused intermittent one-way audio.
    </div>

    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span className="tag ink" style={{padding:"2px 8px"}}>Edit before posting to Zendesk</span>
      <span className="tag" style={{padding:"2px 8px"}}>RESOLVED</span>
    </div>

    {/* Note body */}
    <div style={{
      padding:"14px 16px",borderRadius:8,
      background:"rgba(0,0,0,0.3)",border:"0.5px solid var(--line-2)",
      fontSize:12.5,color:"var(--ink-1)",lineHeight:1.6,
      fontFamily:'"Geist Mono",monospace',maxHeight:320,overflow:"hidden",position:"relative"
    }}>
      <div style={{color:"var(--ink-3)",marginBottom:10,fontSize:10.5,letterSpacing:"0.14em",textTransform:"uppercase"}}>— INTERNAL NOTE —</div>
      <p style={{margin:"0 0 10px"}}><span style={{color:"var(--ink-0)"}}>Root cause.</span> The Dispatch 4 workstation lost inbound caller audio because its CCS-SDK SIP Registrar began flapping against the <span style={{color:"var(--mint)"}}>Kamailio 5.8.0 WSS</span> endpoint. The cycle is visible in the first dozen CCS-SDK entries — <span style={{color:"var(--mint)"}}>sip.Registrar | Waiting → true</span> immediately followed by <span style={{color:"var(--mint)"}}>Waiting → false</span> after ~100ms.</p>
      <p style={{margin:"0 0 10px"}}><span style={{color:"var(--ink-0)"}}>Impact.</span> Four 911 calls affected on Dispatch 4 between 02:03–02:14 PDT. Early-media RTP was unbridged for ~5s per flap cycle, matching the "can't hear me" reports.</p>
      <p style={{margin:"0 0 10px"}}><span style={{color:"var(--ink-0)"}}>Resolution.</span> Supervisor restarted the workstation at <span style={{color:"var(--mint)"}}>02:12:00 PDT</span>. Post-restart, the Registrar held a clean contact binding and keepalives stabilized<Cursor color="var(--mint)"/></p>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:60,background:"linear-gradient(180deg, transparent, rgba(0,0,0,0.3))"}}/>
    </div>

    {/* Streaming bar */}
    <div style={{display:"flex",alignItems:"center",gap:10,fontSize:11.5,color:"var(--violet)",fontFamily:'"Geist Mono",monospace'}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:"var(--violet)"}} className="nl-pulse-dot"/>
      <span>Unleashed AI · writing</span>
      <div style={{flex:1,height:3,borderRadius:100,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
        <div className="nl-shimmer" style={{height:"100%",width:"62%"}}/>
      </div>
      <span style={{color:"var(--ink-3)"}}>2.1k / 3.4k tokens</span>
    </div>

    <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:4,borderTop:"0.5px solid var(--line)",marginTop:4}}>
      <button className="btn ghost" style={{padding:"6px 10px",fontSize:11.5}}><Icon name="spark" size={12}/> Regenerate</button>
      <button className="btn ghost" style={{padding:"6px 10px",fontSize:11.5}}>Tone · <span style={{color:"var(--ink-1)"}}>Technical</span></button>
      <button className="btn ghost" style={{padding:"6px 10px",fontSize:11.5}}>Length · <span style={{color:"var(--ink-1)"}}>Medium</span></button>
      <span style={{marginLeft:"auto",fontSize:11,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>cites 12 log lines · 3 similar tickets</span>
    </div>
  </div>
);

const EvidenceCard = () => {
  const items = [
    { t:"02:03:18", kind:"LOG", msg:"sip.Registrar | Waiting toggled true", tone:"violet", tag:"CCS-SDK" },
    { t:"02:03:18", kind:"LOG", msg:"sip.Registrar | Waiting toggled false (+102ms)", tone:"violet", tag:"CCS-SDK" },
    { t:"02:03:22", kind:"CORR",msg:"Call-ID 62b4e03…pssap — early media unbridged 4.8s", tone:"amber", tag:"SIP" },
    { t:"02:05:41", kind:"DD",  msg:"Kamailio 200 OK to stale OPTIONS (n=17)", tone:"mint",  tag:"DATADOG" },
    { t:"02:12:00", kind:"OP",  msg:"Workstation restart by supervisor", tone:"mint", tag:"OPS" },
  ];
  const colorMap = { violet:"var(--violet)", amber:"var(--amber)", mint:"var(--mint)" };
  return (
    <div className="glass" style={{padding:"16px 18px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <Icon name="doc" size={13} stroke="var(--mint)"/>
        <span style={{fontSize:11,letterSpacing:"0.16em",color:"var(--ink-1)",fontFamily:'"Geist Mono",monospace'}}>EVIDENCE SUMMARY</span>
        <span style={{marginLeft:"auto",fontSize:11,color:"var(--mint)",fontFamily:'"Geist Mono",monospace'}}>5 items pinned</span>
      </div>
      <div style={{fontSize:11.5,color:"var(--ink-3)",marginBottom:12,lineHeight:1.5}}>
        Pinned from the AI Assistant via <span className="kbd">⌃</span> <span className="kbd">⇧</span> <span className="kbd">P</span>. These attach as an inline table in Zendesk and a page in Confluence.
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
        {items.map((e,i)=>(
          <div key={i} style={{
            display:"grid",gridTemplateColumns:"58px 48px 1fr 16px",gap:10,alignItems:"center",
            padding:"8px 10px",borderRadius:7,
            border:"0.5px solid var(--line)",background:"rgba(255,255,255,0.015)"
          }}>
            <span style={{fontFamily:'"Geist Mono",monospace',fontSize:10.5,color:"var(--ink-3)"}}>{e.t}</span>
            <span style={{fontFamily:'"Geist Mono",monospace',fontSize:9.5,letterSpacing:"0.1em",color:colorMap[e.tone],padding:"1px 5px",borderRadius:3,border:`0.5px solid ${colorMap[e.tone]}33`,background:`${colorMap[e.tone]}14`,textAlign:"center"}}>{e.kind}</span>
            <span style={{fontSize:11.5,color:"var(--ink-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.msg}</span>
            <Icon name="arrowUpRight" size={11} stroke="var(--ink-3)"/>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <button className="btn" style={{padding:"8px",fontSize:12,justifyContent:"center"}}>
          <Icon name="doc" size={12}/> Copy Jira template
        </button>
        <button className="btn" style={{padding:"8px",fontSize:12,justifyContent:"center"}}>
          <Icon name="arrowUpRight" size={12}/> Export .noclense
        </button>
      </div>
    </div>
  );
};

const HandoffCard = () => (
  <div className="glass" style={{padding:"16px 18px"}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
      <Icon name="link" size={13} stroke="var(--violet)"/>
      <span style={{fontSize:11,letterSpacing:"0.16em",color:"var(--ink-1)",fontFamily:'"Geist Mono",monospace'}}>HANDOFF</span>
      <span style={{marginLeft:"auto",fontSize:11,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>3 targets</span>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <Handoff name="Zendesk" detail="#41637 · post internal note + resolved" on icon="ticket"/>
      <Handoff name="Confluence" detail="→ NOC · Known Issues · new page" on icon="doc"/>
      <Handoff name="Jira"  detail="Create CAR-★ for Kamailio WSS keepalive regression"  icon="link"/>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14,paddingTop:12,borderTop:"0.5px solid var(--line)"}}>
      <Icon name="clock" size={12} stroke="var(--ink-3)"/>
      <span style={{fontSize:11.5,color:"var(--ink-2)"}}>Est. time-to-resolution</span>
      <span style={{marginLeft:"auto",fontSize:13,fontFamily:'"Geist Mono",monospace',color:"var(--mint)"}}>08m 54s</span>
    </div>
  </div>
);

const Handoff = ({ name, detail, on, icon }) => (
  <div style={{
    display:"grid",gridTemplateColumns:"28px 1fr auto",gap:10,alignItems:"center",
    padding:"10px 12px",borderRadius:8,
    background: on?"rgba(142,240,183,0.04)":"rgba(255,255,255,0.015)",
    border:`0.5px solid ${on?"rgba(142,240,183,0.22)":"var(--line)"}`
  }}>
    <div style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,0.03)",border:"0.5px solid var(--line-2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Icon name={icon} size={12} stroke={on?"var(--mint)":"var(--ink-2)"}/>
    </div>
    <div>
      <div style={{fontSize:12.5,color:"var(--ink-0)",fontWeight:500}}>{name}</div>
      <div style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',marginTop:1}}>{detail}</div>
    </div>
    <div style={{
      width:28,height:17,borderRadius:10,padding:2,
      background: on?"rgba(142,240,183,0.2)":"rgba(255,255,255,0.06)",
      border:`0.5px solid ${on?"rgba(142,240,183,0.4)":"var(--line-2)"}`,
      display:"flex",alignItems:"center",justifyContent:on?"flex-end":"flex-start",
      transition:"all .2s",cursor:"pointer"
    }}>
      <div style={{width:11,height:11,borderRadius:"50%",background:on?"var(--mint)":"var(--ink-3)",boxShadow: on?"0 0 6px var(--mint)":"none"}}/>
    </div>
  </div>
);

Object.assign(window, { SubmitRoom });
