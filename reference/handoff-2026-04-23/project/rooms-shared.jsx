// Shared room chrome — topbar + phase stepper — reused across Import/Investigate/Submit
const { MacWindow, Icon, Cursor, Spark, LogHistogram, Ambient } = window;

const Phases = ({ current }) => {
  const steps = ["Import","Investigate","Submit"];
  const idx = steps.indexOf(current);
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      {steps.map((s,i)=>(
        <React.Fragment key={s}>
          <div style={{display:"flex",alignItems:"center",gap:6,opacity: i<=idx?1:0.5}}>
            <span style={{width:6,height:6,borderRadius:"50%",
              background: i<=idx?"var(--mint)":"var(--ink-3)",
              boxShadow: i===idx?"0 0 8px var(--mint)":"none",
            }} className={i===idx?"nl-pulse-dot":""}/>
            <span style={{fontSize:11.5,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.1em",color: i===idx?"var(--mint)":i<idx?"var(--ink-1)":"var(--ink-3)"}}>{s}</span>
          </div>
          {i<steps.length-1 && <div style={{width:24,height:"0.5px",background:"var(--line-2)"}}/>}
        </React.Fragment>
      ))}
    </div>
  );
};

const RoomTopbar = ({ ticket, phase, right, empty }) => (
  <div style={{
    display:"flex",alignItems:"center",gap:14,
    padding:"14px 26px",
    borderBottom:"0.5px solid var(--line)",
    background:"linear-gradient(180deg, rgba(255,255,255,0.02), transparent)",
    position:"relative",zIndex:2,flexShrink:0
  }}>
    {empty ? (
      <div style={{fontSize:12.5,color:"var(--ink-2)"}}>No active case — import logs or paste a Zendesk ticket to begin.</div>
    ) : ticket && (
      <>
        <span style={{fontFamily:'"Geist Mono",monospace',fontSize:12,color:"var(--ink-1)"}}>#{ticket}</span>
        <span className="tag red" style={{padding:"2px 7px"}}>HIGH</span>
        <span className="tag ink" style={{padding:"2px 7px",color:"var(--ink-2)"}}>OPEN</span>
        <span style={{fontSize:12.5,color:"var(--ink-1)",maxWidth:440,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          Dispatch 4 — cannot hear caller audio on 911 calls (intermittent)
        </span>
      </>
    )}
    <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:16}}>
      <div style={{display:"flex",gap:6}}>
        <button className="btn ghost" style={{padding:"4px 10px",fontSize:11.5}}><Icon name="import" size={12}/> Import</button>
        <button className="btn ghost" style={{padding:"4px 10px",fontSize:11.5}}><Icon name="arrowUpRight" size={12}/> Export</button>
        <button className="btn ghost" style={{padding:"4px 10px",fontSize:11.5,color:"var(--red)"}}>Clear</button>
      </div>
      <div style={{width:"0.5px",height:16,background:"var(--line-2)"}}/>
      <Phases current={phase}/>
      {right}
    </div>
  </div>
);

Object.assign(window, { RoomTopbar, Phases });
