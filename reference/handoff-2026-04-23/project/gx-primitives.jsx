// GX Primitives — shared components derived from DESIGN.md tokens
// Exports to window for other Babel scripts

const GXWindow = ({ title = "NocLense", right = null, children }) => (
  <div className="gx-window">
    <div className="gx-titlebar">
      <div className="gx-lights">
        <span className="gx-light r"/><span className="gx-light y"/><span className="gx-light g"/>
      </div>
      <div className="gx-title">
        <span className="live-dot"/>
        <span>{title}</span>
      </div>
      <div className="gx-titlebar-right">{right}</div>
    </div>
    <div className="gx-body">{children}</div>
  </div>
);

const GXIcon = ({ name, size = 16, stroke = "currentColor", sw = 1.75 }) => {
  const P = {
    search:     <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    plus:       <><path d="M12 5v14M5 12h14"/></>,
    arrow:      <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    upload:     <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    download:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    file:       <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></>,
    folder:     <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>,
    zip:        <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M10 13h4M10 17h4M12 9v8"/></>,
    ticket:     <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v12"/></>,
    spark:      <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    activity:   <><path d="M3 12h4l3-9 4 18 3-9h4"/></>,
    import:     <><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></>,
    radar:      <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 20 7"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></>,
    check:      <><path d="m5 12 5 5L20 7"/></>,
    check2:     <><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></>,
    chevron:    <><path d="m9 6 6 6-6 6"/></>,
    lock:       <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    key:        <><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2M15 8l3 3M13 10l3 3"/></>,
    shield:     <><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z"/></>,
    user:       <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
    users:      <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    gear:       <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    bolt:       <><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></>,
    terminal:   <><path d="M4 6h16v12H4z"/><path d="m7 10 3 2-3 2M13 14h4"/></>,
    db:         <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    link:       <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
    dots:       <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    filter:     <><path d="M3 5h18M6 12h12M10 19h4"/></>,
    close:      <><path d="M18 6 6 18M6 6l12 12"/></>,
    home:       <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    datadog:    <><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12h8M12 8v8"/></>,
    confluence: <><path d="M3 7c7-4 11 0 18-4M3 17c7-4 11 0 18-4"/><circle cx="12" cy="12" r="2"/></>,
    zendesk:    <><path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z"/><path d="M8 14l8-8M8 10h4M12 14h4"/></>,
    pdf:        <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h1.5a1.5 1.5 0 0 0 0-3H9v6M16 10h-2v6M14 13h2"/></>,
    csv:        <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8 13a2 2 0 0 0 2 2h4a2 2 0 0 0 0-4h-4a2 2 0 0 1 0-4h4a2 2 0 0 1 2 2"/></>,
    send:       <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    copy:       <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    bell:       <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {P[name] || <circle cx="12" cy="12" r="9"/>}
    </svg>
  );
};

// Animated Geist-mono data label
const GXMono = ({ children, size = 11, color = "var(--gx-on-surface-variant)", caps = false, tracking = "0.12em" }) => (
  <span className="mono" style={{ fontSize:size, color, letterSpacing:tracking, textTransform: caps?"uppercase":"none", lineHeight:1 }}>
    {children}
  </span>
);

// Live pulse dot
const PulseDot = ({ color = "var(--gx-primary)", size = 7 }) => (
  <span style={{ display:"inline-block", width:size, height:size, borderRadius:"50%", background:color,
    boxShadow:`0 0 ${size+2}px ${color}`, animation:"gx-pulse 2s ease-in-out infinite", flexShrink:0 }}/>
);

// Tonal sparkline (no fill, clean line)
const GXSpark = ({ data = [3,5,4,7,6,9,8,11,9,12,10,13], color = "var(--gx-primary)", w=72, h=22 }) => {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i*step, h - ((v-min)/range)*(h-3) - 1.5]);
  const d = pts.map((p,i) => (i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`)).join(" ");
  return (
    <svg width={w} height={h} style={{display:"block",flexShrink:0}}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
    </svg>
  );
};

// Log histogram — animated bars
const GXHistogram = ({ bars=64, color="var(--gx-primary)", height=44, seed=0 }) => {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const id = setInterval(()=>setTick(t=>t+1),700); return()=>clearInterval(id); },[]);
  const vals = React.useMemo(() => Array.from({length:bars},(_,i)=>Math.max(0.08,
    (Math.sin(i*0.55+seed)*0.45+0.5)*0.65 + (Math.sin(i*1.2+seed*0.8)*0.3+0.5)*0.35
  )),[bars,seed]);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:"1.5px",height,width:"100%"}}>
      {vals.map((v,i)=>{
        const lit = ((i+tick)%bars) < 4;
        return <div key={i} style={{
          flex:1, height:`${v*100}%`, borderRadius:"2px 2px 0 0",
          background: lit ? color : "rgba(255,255,255,0.08)",
          boxShadow: lit ? `0 0 8px ${color}55` : "none",
          transition:"background .35s, box-shadow .35s"
        }}/>;
      })}
    </div>
  );
};

// NocLense logomark — M3 style with rounder shape
const GXLogo = ({ size = 32 }) => (
  <div style={{
    width:size, height:size, borderRadius:size*0.3,
    background:`linear-gradient(160deg, var(--gx-primary-c), #001a0f)`,
    display:"flex",alignItems:"center",justifyContent:"center",
    boxShadow:`0 4px 16px -4px rgba(142,240,183,0.4), 0 0 0 1px rgba(142,240,183,0.15)`,
    flexShrink:0,
  }}>
    <svg width={size*0.56} height={size*0.56} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="var(--gx-primary)" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="4"   stroke="var(--gx-primary)" strokeWidth="1.5" opacity="0.55"/>
      <circle cx="12" cy="12" r="1.8" fill="var(--gx-primary)"/>
      <path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5" stroke="var(--gx-primary)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </div>
);

// Radar glyph
const GXRadar = ({ size=88 }) => (
  <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
    <div style={{position:"absolute",inset:0,borderRadius:"50%",background:`radial-gradient(circle, rgba(142,240,183,0.14), transparent 70%)`,border:"1px solid rgba(142,240,183,0.2)"}}/>
    <div style={{position:"absolute",inset:"16%",borderRadius:"50%",border:"1px dashed rgba(142,240,183,0.18)"}}/>
    <div style={{position:"absolute",inset:"32%",borderRadius:"50%",border:"1px dashed rgba(142,240,183,0.15)"}}/>
    <div style={{position:"absolute",inset:"44%",borderRadius:"50%",background:"var(--gx-primary)",boxShadow:"0 0 12px var(--gx-primary)"}}/>
    <svg style={{position:"absolute",inset:0,animation:"gx-sweep 4s linear infinite",transformOrigin:"50% 50%"}} viewBox="0 0 100 100">
      <defs><linearGradient id="gxsweep" x1="50%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="var(--gx-primary)" stopOpacity="0.7"/>
        <stop offset="100%" stopColor="var(--gx-primary)" stopOpacity="0"/>
      </linearGradient></defs>
      <path d="M50 50 L100 50 A50 50 0 0 1 75 93 Z" fill="url(#gxsweep)"/>
    </svg>
    <div style={{position:"absolute",top:"20%",left:"68%",width:5,height:5,borderRadius:"50%",background:"var(--gx-primary)",animation:"gx-pulse 2.2s ease-in-out infinite"}}/>
    <div style={{position:"absolute",top:"65%",left:"22%",width:4,height:4,borderRadius:"50%",background:"var(--gx-warning)",animation:"gx-pulse 1.8s ease-in-out .4s infinite"}}/>
  </div>
);

// Avatar chip
const GXAvatar = ({ initials, name, role, size=32 }) => (
  <div style={{display:"flex",alignItems:"center",gap:10}}>
    <div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg, var(--gx-secondary-c), var(--gx-primary-c))`,
      display:"flex",alignItems:"center",justifyContent:"center",color:"var(--gx-on-secondary-c)",
      fontSize:size*0.38,fontWeight:700,flexShrink:0}}>
      {initials}
    </div>
    {name && <div>
      <div style={{fontSize:13,fontWeight:600,color:"var(--gx-on-surface)"}}>{name}</div>
      {role && <div className="mono" style={{fontSize:10,color:"var(--gx-outline)",letterSpacing:"0.12em",textTransform:"uppercase"}}>{role}</div>}
    </div>}
  </div>
);

// Integration status pill
const IntPill = ({ name, ok, warn }) => (
  <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:"var(--gx-full)",
    background: ok?"rgba(142,240,183,0.07)":warn?"rgba(255,185,69,0.07)":"rgba(255,255,255,0.04)",
    border:`1px solid ${ok?"rgba(142,240,183,0.2)":warn?"rgba(255,185,69,0.2)":"var(--gx-outline-variant)"}`,
    fontSize:11.5,fontFamily:'"Geist Mono",monospace',letterSpacing:"0.06em",
    color:ok?"var(--gx-primary)":warn?"var(--gx-warning)":"var(--gx-outline)"}}>
    <PulseDot color={ok?"var(--gx-primary)":warn?"var(--gx-warning)":"var(--gx-outline)"} size={5}/>
    {name}
  </div>
);

// Correlation graph SVG
const GXCorrelation = ({ width=240, height=140 }) => (
  <div style={{position:"relative",width,height}}>
    <div className="mono" style={{fontSize:9.5,letterSpacing:"0.18em",color:"var(--gx-outline)",marginBottom:8,textTransform:"uppercase"}}>SIP correlation flow</div>
    <svg width={width} height={height-20} viewBox={`0 0 ${width} ${height-20}`} style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="gxnode"><stop offset="0%" stopColor="var(--gx-primary)" stopOpacity=".9"/><stop offset="100%" stopColor="var(--gx-primary)" stopOpacity="0"/></radialGradient>
        <radialGradient id="gxwarn"><stop offset="0%" stopColor="var(--gx-warning)" stopOpacity=".9"/><stop offset="100%" stopColor="var(--gx-warning)" stopOpacity="0"/></radialGradient>
      </defs>
      <path d={`M20,60 C70,20 150,100 220,50`} stroke="var(--gx-primary)" strokeWidth="1.25" fill="none" opacity="0.45" strokeDasharray="3 4"/>
      <path d={`M20,60 C70,100 150,25 220,90`} stroke="var(--gx-tertiary)" strokeWidth="1.25" fill="none" opacity="0.35" strokeDasharray="3 4"/>
      <path d="M20,60 L220,60"                 stroke="var(--gx-warning)" strokeWidth="1"    fill="none" opacity="0.3"/>
      {[[20,60,"gxnode"],[85,60,"gxwarn"],[155,60,"gxwarn"],[220,60,"gxnode"],[85,22,"gxnode"],[155,98,"gxnode"]].map(([x,y,g],i)=>(
        <g key={i}>
          <circle cx={x} cy={y} r={14} fill={`url(#${g})`} opacity={0.22}/>
          <circle cx={x} cy={y} r={4} fill={g==="gxwarn"?"var(--gx-warning)":"var(--gx-primary)"}/>
          {g==="gxwarn" && <circle cx={x} cy={y} r={6} fill="none" stroke="var(--gx-warning)" strokeWidth="1" style={{transformOrigin:`${x}px ${y}px`,animation:"gx-ring 2.2s ease-out infinite"}}/>}
        </g>
      ))}
    </svg>
    <div className="mono" style={{fontSize:9.5,color:"var(--gx-outline)",letterSpacing:"0.08em",marginTop:6}}>
      8 calls · 3 stations · <span style={{color:"var(--gx-warning)"}}>1 anomaly</span>
    </div>
  </div>
);

Object.assign(window, {
  GXWindow, GXIcon, GXMono, PulseDot, GXSpark, GXHistogram, GXLogo, GXRadar, GXAvatar, IntPill, GXCorrelation
});
