// Shared primitives used by auth + dashboard artboards.
// Exposes to window so other Babel scripts can use them.

const MacWindow = ({ title = "NocLense", right = null, children, titleDot = true, style }) => (
  <div className="mac-window" style={style}>
    <div className="mac-titlebar">
      <div className="mac-lights">
        <span className="mac-light r" />
        <span className="mac-light y" />
        <span className="mac-light g" />
      </div>
      <div className="mac-title">
        {titleDot && <span className="dot" />}
        <span>{title}</span>
      </div>
      <div className="mac-title-right">{right}</div>
    </div>
    <div className="mac-body">{children}</div>
  </div>
);

// Shared SVG icons (line, 1.5 stroke)
const Icon = ({ name, size = 16, stroke = "currentColor", strokeWidth = 1.5, style }) => {
  const paths = {
    search:    <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    arrowRight:<><path d="M5 12h14M13 6l6 6-6 6"/></>,
    arrowUpRight:<><path d="M7 17 17 7M8 7h9v9"/></>,
    import:    <><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></>,
    doc:       <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></>,
    spark:     <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    lock:      <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    key:       <><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2M15 8l3 3M13 10l3 3"/></>,
    shield:    <><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z"/></>,
    user:      <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
    google:    <><path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.5c-.2 1.3-1 2.4-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.6z" fill="#4285F4" stroke="none"/><path d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.2H2.7v2.6C4.4 19.7 7.9 22 12 22z" fill="#34A853" stroke="none"/><path d="M6.2 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H2.7C2.2 8.9 2 10.4 2 12s.3 3.1.7 4.4l3.5-2.6z" fill="#FBBC04" stroke="none"/><path d="M12 5.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 2.9 14.7 2 12 2 7.9 2 4.4 4.3 2.7 7.6l3.5 2.6C7 7.6 9.3 5.8 12 5.8z" fill="#EA4335" stroke="none"/></>,
    okta:      <><circle cx="12" cy="12" r="7" strokeWidth="3"/></>,
    bolt:      <><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></>,
    activity:  <><path d="M3 12h4l3-9 4 18 3-9h4"/></>,
    clock:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    filter:    <><path d="M3 5h18M6 12h12M10 19h4"/></>,
    gear:      <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    bell:      <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/></>,
    check:     <><path d="m5 12 5 5L20 7"/></>,
    chevron:   <><path d="m9 6 6 6-6 6"/></>,
    dots:      <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    ticket:    <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v12"/></>,
    zap:       <><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></>,
    radar:     <><circle cx="12" cy="12" r="9"/><path d="M12 12 20 7"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></>,
    terminal:  <><path d="M4 6h16v12H4z"/><path d="m7 10 3 2-3 2M13 14h4"/></>,
    db:        <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    link:      <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
  };
  const p = paths[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>{p}</svg>
  );
};

// Animated cursor blink
const Cursor = ({ color = "var(--mint)" }) => (
  <span style={{ display:"inline-block", width:"7px", height:"1em", background:color, marginLeft:"2px", verticalAlign:"-2px", animation:"nl-blink 1s steps(2) infinite" }} />
);

// Tiny sparkline (svg path)
const Spark = ({ data = [3,5,4,6,8,6,9,7,11,9,12,10], color = "var(--mint)", w = 72, h = 22, fill = true }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const step = w / (data.length - 1);
  const pts = data.map((v,i) => [i*step, h - ((v-min)/(max-min||1))*(h-2) - 1]);
  const path = pts.map((p,i)=> (i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`)).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} style={{display:"block"}}>
      {fill && <path d={area} fill={color} opacity="0.12"/>}
      <path d={path} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// Live log bar histogram that subtly pulses
const LogHistogram = ({ bars = 48, accent = "var(--mint)", height = 36, seed = 0 }) => {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 800);
    return () => clearInterval(id);
  }, []);
  const vals = React.useMemo(() => {
    const arr = [];
    for (let i=0;i<bars;i++) {
      const s = Math.sin(i*0.6 + seed) * 0.5 + 0.5;
      const n = (Math.sin(i*1.3 + seed*0.7) * 0.5 + 0.5) * 0.4;
      arr.push(Math.max(0.08, s*0.6 + n));
    }
    return arr;
  }, [bars, seed]);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:"2px",height,width:"100%"}}>
      {vals.map((v,i)=>{
        const active = ((i + tick) % bars) < 3;
        return <div key={i} style={{
          flex:1,
          height:`${v*100}%`,
          background: active ? accent : "rgba(255,255,255,0.10)",
          boxShadow: active ? `0 0 6px ${accent}` : "none",
          borderRadius:"1px",
          transition:"background .4s, box-shadow .4s"
        }}/>;
      })}
    </div>
  );
};

// Ambient background with aurora + grid + noise
const Ambient = ({ children, variant = "default" }) => (
  <div style={{position:"absolute",inset:0,background:"var(--bg-0)",overflow:"hidden"}}>
    <div className="aurora" />
    <div className="grid-overlay" />
    <div className="noise" />
    <div style={{position:"relative",zIndex:3,height:"100%"}}>{children}</div>
  </div>
);

// keyframes injection (once)
if (typeof document !== "undefined" && !document.getElementById("nl-anim-css")) {
  const s = document.createElement("style");
  s.id = "nl-anim-css";
  s.textContent = `
    @keyframes nl-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
    @keyframes nl-pulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
    @keyframes nl-ring{0%{transform:scale(0.4);opacity:0.8}100%{transform:scale(2.4);opacity:0}}
    @keyframes nl-sweep{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    @keyframes nl-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes nl-drift-y{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes nl-caret{0%,49%{opacity:0}50%,100%{opacity:1}}
    @keyframes nl-stream-in{0%{transform:translateY(8px);opacity:0}100%{transform:translateY(0);opacity:1}}
    @keyframes nl-bar{0%{transform:scaleY(0.3)}50%{transform:scaleY(1)}100%{transform:scaleY(0.3)}}
    .nl-pulse-dot{animation:nl-pulse 2.2s ease-in-out infinite}
    .nl-radar-sweep{animation:nl-sweep 4s linear infinite;transform-origin:center}
    .nl-shimmer{
      background:linear-gradient(90deg, transparent 0%, rgba(142,240,183,0.25) 50%, transparent 100%);
      background-size:200% 100%;
      animation:nl-shimmer 2.5s linear infinite;
    }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { MacWindow, Icon, Cursor, Spark, LogHistogram, Ambient });
