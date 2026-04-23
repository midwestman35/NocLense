// Import Room — empty state. Drop files or paste a Zendesk ticket.
const { MacWindow, Icon } = window;
const { Sidebar } = window;
const { RoomTopbar } = window;

const FORMATS = [
  { name:"APEX",        desc:"Application logs and exported text files.",     icon:"doc" },
  { name:"Datadog",     desc:"CSV or text imports from Datadog.",              icon:"db" },
  { name:"AWS Console", desc:"Paste CloudWatch or AWS console log output.",    icon:"terminal" },
  { name:"Homer SIP",   desc:"SIP call-flow PCAPs and packet captures.",       icon:"radar" },
  { name:"Call Log CSV",desc:"Per-call CDR exports with timestamps.",          icon:"ticket" },
  { name:"Unknown",     desc:"Use when the source is mixed or uncertain.",     icon:"doc" },
];

const ImportRoom = () => (
  <MacWindow title="NocLense · Import" right={<span className="mono" style={{color:"var(--mint)"}}>⬤ connected</span>}>
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr",height:"100%",background:"var(--bg-0)"}}>
      <Sidebar active="imp"/>
      <div style={{overflow:"hidden",position:"relative",display:"flex",flexDirection:"column"}}>
        <RoomTopbar phase="Import" empty/>
        <div style={{position:"absolute",top:54,left:0,right:0,height:260,background:"radial-gradient(60% 40% at 50% 0%, rgba(142,240,183,0.06), transparent 70%)",pointerEvents:"none"}}/>

        <div className="no-scrollbar" style={{flex:1,overflowY:"auto",padding:"48px 56px 48px",position:"relative"}}>
          <div style={{maxWidth:880,margin:"0 auto"}}>
            <div style={{fontFamily:'"Geist Mono",monospace',fontSize:11,color:"var(--ink-3)",letterSpacing:"0.16em",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"var(--mint)"}} className="nl-pulse-dot"/>
              — ROOM 1 / 3 · IMPORT
            </div>
            <h1 style={{fontSize:38,fontWeight:400,letterSpacing:"-0.025em",margin:0,lineHeight:1.1,color:"var(--ink-0)"}}>
              Start an <span className="serif" style={{color:"var(--mint)"}}>investigation</span>.
            </h1>
            <p style={{fontSize:14,color:"var(--ink-2)",margin:"10px 0 0",maxWidth:540,lineHeight:1.55}}>
              Drop log files or paste a Zendesk ticket. NocLense will parse, correlate, and prepare your workspace.
            </p>

            {/* Two primary paths: upload vs paste */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:30}}>
              <PathCard icon="import" title="Upload files"
                desc={<>Use <span className="mono" style={{color:"var(--ink-1)"}}>.log</span>, <span className="mono" style={{color:"var(--ink-1)"}}>.txt</span>, <span className="mono" style={{color:"var(--ink-1)"}}>.csv</span>, <span className="mono" style={{color:"var(--ink-1)"}}>.zip</span>, or <span className="mono" style={{color:"var(--ink-1)"}}>.pdf</span> exports.</>}
                kbd="⌘O"/>
              <PathCard icon="terminal" title="Paste logs"
                desc={<>Best for AWS Console output or short incident windows copied from live tooling.</>}
                kbd="⌘V"/>
            </div>

            <SectionLabel label="SOURCE" hint="— optional, helps NocLense parse correctly"/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:14}}>
              {FORMATS.map(f => <FormatTile key={f.name} {...f} active={f.name==="APEX"}/>)}
            </div>

            <div style={{textAlign:"center",color:"var(--ink-3)",fontSize:12.5,margin:"34px 0 8px"}}>
              Start with files or paste, then build evidence and handoff notes from one workspace.
            </div>

            {/* Zendesk paste */}
            <div className="glass-2" style={{padding:"18px 20px",marginTop:22}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <Icon name="ticket" size={14} stroke="var(--mint)"/>
                <span style={{fontSize:13,fontWeight:500,color:"var(--ink-0)"}}>Zendesk Ticket</span>
                <span className="tag" style={{padding:"1px 7px",fontSize:9.5}}>OPTIONAL</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10}}>
                <div className="field" style={{padding:"10px 12px"}}>
                  <span className="lead"><Icon name="link" size={14}/></span>
                  <input placeholder="Ticket # or URL" />
                </div>
                <button className="btn primary" style={{padding:"10px 18px"}}>
                  <Icon name="spark" size={13}/> Investigate
                </button>
              </div>
              <div style={{fontSize:11.5,color:"var(--ink-3)",marginTop:10,lineHeight:1.5}}>
                Enter a ticket number to begin a diagnosis session. Log files are optional — AI can pull context from Datadog and the ticket itself.
              </div>
            </div>

            {/* Dropzone */}
            <div style={{
              marginTop:16,
              border:"1px dashed var(--line-bright)",
              borderRadius:12,padding:"40px 20px",textAlign:"center",
              background:"linear-gradient(180deg, rgba(142,240,183,0.025), transparent)",
              cursor:"pointer",transition:"border-color .15s, background .15s",
              position:"relative",overflow:"hidden"
            }}>
              <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 50%, rgba(142,240,183,0.08), transparent 60%)",opacity:0.6,pointerEvents:"none"}}/>
              <div style={{position:"relative",zIndex:1}}>
                <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:42,height:42,borderRadius:10,
                  background:"rgba(142,240,183,0.08)",border:"0.5px solid rgba(142,240,183,0.25)",marginBottom:12}}>
                  <Icon name="import" size={20} stroke="var(--mint)"/>
                </div>
                <div style={{fontSize:15,color:"var(--ink-0)",fontWeight:500,marginBottom:6}}>Choose files to import</div>
                <div style={{fontSize:12,color:"var(--ink-3)"}}>
                  Supports <span className="mono" style={{color:"var(--ink-1)"}}>.log</span>, <span className="mono" style={{color:"var(--ink-1)"}}>.txt</span>, <span className="mono" style={{color:"var(--ink-1)"}}>.csv</span>, <span className="mono" style={{color:"var(--ink-1)"}}>.zip</span>, <span className="mono" style={{color:"var(--ink-1)"}}>.pdf</span>. Multiple files are merged by timestamp.
                </div>
              </div>
            </div>

            <div style={{marginTop:36,paddingTop:20,borderTop:"0.5px solid var(--line)",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',letterSpacing:"0.08em"}}>
              <span>8 supported formats · auto-detected</span>
              <span>Files remain local · IndexedDB streaming over 50MB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </MacWindow>
);

const PathCard = ({ icon, title, desc, kbd }) => (
  <div className="glass-2" style={{padding:"16px 18px",display:"flex",gap:14,alignItems:"flex-start",cursor:"pointer",transition:"border-color .15s"}}>
    <div style={{width:32,height:32,borderRadius:8,background:"rgba(142,240,183,0.06)",border:"0.5px solid rgba(142,240,183,0.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--mint)",flexShrink:0}}>
      <Icon name={icon} size={15}/>
    </div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
        <span style={{fontSize:13.5,fontWeight:500,color:"var(--ink-0)"}}>{title}</span>
        <span className="kbd" style={{marginLeft:"auto"}}>{kbd}</span>
      </div>
      <div style={{fontSize:12,color:"var(--ink-2)",lineHeight:1.5}}>{desc}</div>
    </div>
  </div>
);

const FormatTile = ({ icon, name, desc, active }) => (
  <div style={{
    padding:"12px 14px",borderRadius:10,cursor:"pointer",
    background: active ? "rgba(142,240,183,0.04)" : "rgba(255,255,255,0.015)",
    border: `0.5px solid ${active ? "rgba(142,240,183,0.25)" : "var(--line)"}`,
    transition:"border-color .15s, background .15s"
  }}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
      <Icon name={icon} size={12} stroke={active?"var(--mint)":"var(--ink-2)"}/>
      <span style={{fontSize:12.5,fontWeight:500,color: active?"var(--mint)":"var(--ink-1)"}}>{name}</span>
      {active && <span style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:"var(--mint)",boxShadow:"0 0 6px var(--mint)"}}/>}
    </div>
    <div style={{fontSize:11,color:"var(--ink-3)",lineHeight:1.45}}>{desc}</div>
  </div>
);

const SectionLabel = ({ label, hint }) => (
  <div style={{display:"flex",alignItems:"baseline",gap:12,marginTop:32,paddingBottom:10,borderBottom:"0.5px solid var(--line)"}}>
    <div style={{fontSize:10.5,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.16em",color:"var(--ink-1)"}}>{label}</div>
    <div style={{fontSize:11.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace'}}>{hint}</div>
  </div>
);

Object.assign(window, { ImportRoom, SectionLabel });
