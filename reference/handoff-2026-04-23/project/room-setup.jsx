// Investigation Setup modal — full app dimmed behind, modal centered.
const { MacWindow, Icon } = window;
const { Sidebar, DashEditorial } = window;

const SetupModal = () => (
  <MacWindow title="NocLense · Setup" right={<span className="mono" style={{color:"var(--mint)"}}>⬤ connected</span>}>
    <div style={{position:"absolute",inset:0,background:"var(--bg-0)"}}>
      {/* Dimmed backdrop of the app */}
      <div style={{position:"absolute",inset:0,filter:"blur(8px) brightness(0.5) saturate(0.7)",opacity:0.5}}>
        <div style={{display:"grid",gridTemplateColumns:"220px 1fr",height:"100%"}}>
          <Sidebar active="imp"/>
          <div/>
        </div>
      </div>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)"}}/>

      {/* Modal */}
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:560,maxHeight:"90%"}}>
        <div className="glass" style={{
          padding:0,overflow:"hidden",
          background:"linear-gradient(180deg, rgba(20,24,32,0.95), rgba(12,15,20,0.92))",
          boxShadow:"0 40px 100px -20px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(142,240,183,0.15), 0 0 80px -30px rgba(142,240,183,0.2)",
        }}>
          {/* header */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 20px",borderBottom:"0.5px solid var(--line)"}}>
            <Icon name="spark" size={14} stroke="var(--violet)"/>
            <span style={{fontSize:13.5,fontWeight:500,color:"var(--ink-0)"}}>Investigation Setup</span>
            <span style={{marginLeft:"auto",width:20,height:20,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--ink-3)"}}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l8 8M10 2l-8 8"/></svg>
            </span>
          </div>

          <div className="no-scrollbar" style={{padding:"18px 20px 20px",maxHeight:560,overflowY:"auto"}}>
            {/* Ticket loaded */}
            <div style={{
              padding:"12px 14px",borderRadius:8,marginBottom:16,
              background:"rgba(142,240,183,0.05)",border:"0.5px solid rgba(142,240,183,0.25)"
            }}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <Icon name="check" size={12} stroke="var(--mint)"/>
                <span style={{fontSize:10.5,letterSpacing:"0.16em",color:"var(--mint)",fontFamily:'"Geist Mono",monospace'}}>TICKET LOADED</span>
              </div>
              <div style={{fontSize:13.5,color:"var(--ink-0)",fontWeight:500,lineHeight:1.35}}>
                #41637: Dispatch 4 — cannot hear caller audio on 911 calls (intermittent)
              </div>
              <div style={{fontSize:11,color:"var(--ink-2)",fontFamily:'"Geist Mono",monospace',marginTop:5}}>
                open · K. Nguyen · MACC 911 (Washington)
              </div>
            </div>

            <FormRow label="Attachments — select which to import">
              <div style={{padding:"10px 12px",borderRadius:7,background:"rgba(255,255,255,0.02)",border:"0.5px dashed var(--line-2)",fontSize:12,color:"var(--ink-3)"}}>
                No attachments on this ticket.
              </div>
            </FormRow>

            <FormRow label="Customer timezone" badge="from Zendesk" badgeColor="mint">
              <div className="field" style={{padding:"9px 12px"}}>
                <input defaultValue="Pacific (US & Canada)" />
                <Icon name="chevron" size={14} stroke="var(--ink-3)" style={{transform:"rotate(90deg)"}}/>
              </div>
              <div style={{fontSize:10.5,color:"var(--ink-3)",marginTop:5}}>Correlates ticket-reported times with log timestamps.</div>
            </FormRow>

            {/* Datadog enrichment */}
            <div style={{
              border:"0.5px solid rgba(165,140,255,0.25)",
              borderRadius:10,padding:"14px 14px 16px",margin:"18px 0 14px",
              background:"linear-gradient(180deg, rgba(165,140,255,0.04), transparent)"
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <Icon name="db" size={13} stroke="var(--violet)"/>
                <span style={{fontSize:13,fontWeight:500,color:"var(--ink-0)"}}>Datadog Enrichment</span>
                <span className="tag violet" style={{padding:"1px 7px",fontSize:9.5}}>ON</span>
                <Icon name="chevron" size={13} stroke="var(--ink-3)" style={{marginLeft:"auto",transform:"rotate(90deg)"}}/>
              </div>

              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <Toggle on/>
                <span style={{fontSize:12.5,color:"var(--ink-1)"}}>Pull live Datadog logs for this investigation</span>
              </div>
              <button className="btn ghost" style={{padding:"4px 10px",fontSize:11.5,color:"var(--ink-2)"}}>
                <Icon name="zap" size={12}/> Test Connection
              </button>

              <div style={{height:"0.5px",background:"var(--line)",margin:"14px 0 12px"}}/>

              <Field label="Call Center Name (CNC)">
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                  <div className="field" style={{padding:"8px 11px"}}>
                    <input defaultValue="e.g. us-il-glenview-apex" style={{color:"var(--ink-3)"}}/>
                  </div>
                  <button className="btn" style={{padding:"8px 12px",fontSize:11.5,color:"var(--violet)",borderColor:"rgba(165,140,255,0.3)"}}>
                    <Icon name="radar" size={12}/> Discover Stations
                  </button>
                </div>
                <Hint>The Datadog <span className="mono">@log_networkData.callCenterName</span> value. Type-to-match or auto-fills from APEX fields.</Hint>
              </Field>

              <Field label="Stations / Hosts (comma-separated, optional)">
                <div className="field" style={{padding:"8px 11px"}}>
                  <input defaultValue="us-wa-macc911-apex"/>
                </div>
                <Hint>The <span className="mono">@log_networkData.hostName</span> value from Datadog (not the physical station ID).</Hint>
              </Field>

              <Field label="Query / Filter">
                <div className="field mono" style={{padding:"8px 11px",fontFamily:'"Geist Mono",monospace'}}>
                  <input defaultValue='@org:"MACC 911 (Washington)" service:apex' style={{fontFamily:'"Geist Mono",monospace',fontSize:12}}/>
                </div>
              </Field>

              <Field label="Time window (last 2 h by default)">
                <div style={{
                  padding:"9px 12px",borderRadius:7,
                  background:"rgba(142,240,183,0.05)",border:"0.5px solid rgba(142,240,183,0.25)",
                  fontFamily:'"Geist Mono",monospace',fontSize:12,color:"var(--ink-0)"
                }}>
                  9:17:43 AM → 11:17:43 AM <span style={{color:"var(--ink-3)"}}>(120 min)</span>
                </div>
                <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:10.5,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',letterSpacing:"0.08em",marginRight:4}}>EXPAND</span>
                  {["−3h","−1h","−30m","reset","+30m","+1h","+3h"].map(v=>(
                    <span key={v} style={{
                      fontFamily:'"Geist Mono",monospace',fontSize:10.5,
                      padding:"2px 7px",borderRadius:4,
                      border:"0.5px solid var(--line-2)",
                      color: v==="reset"?"var(--mint)":"var(--ink-2)",
                      background: v==="reset"?"rgba(142,240,183,0.06)":"rgba(255,255,255,0.02)",
                      cursor:"pointer"
                    }}>{v}</span>
                  ))}
                </div>
              </Field>

              <Field label="Indexes (blank = all)">
                <div className="field" style={{padding:"8px 11px"}}>
                  <input defaultValue="main, ops" style={{fontFamily:'"Geist Mono",monospace',fontSize:12}}/>
                </div>
              </Field>
            </div>
          </div>

          {/* Footer */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderTop:"0.5px solid var(--line)",background:"rgba(0,0,0,0.25)"}}>
            <div style={{flex:1,fontSize:11,color:"var(--ink-3)",fontFamily:'"Geist Mono",monospace',letterSpacing:"0.06em"}}>
              ⏎ to start · esc to cancel
            </div>
            <button className="btn">Cancel</button>
            <button className="btn primary" style={{background:"linear-gradient(180deg, #3a2a6e, #241845)",borderColor:"rgba(165,140,255,0.4)",color:"var(--violet)"}}>
              <Icon name="spark" size={13}/> Start Investigation
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div style={{position:"absolute",bottom:28,right:28}}>
        <div className="glass-2" style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,fontSize:12.5}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"var(--mint)"}} className="nl-pulse-dot"/>
          <span style={{color:"var(--ink-1)"}}>Imported 1 dataset</span>
        </div>
      </div>
    </div>
  </MacWindow>
);

const FormRow = ({ label, badge, badgeColor, children }) => (
  <div style={{marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
      <Icon name="clock" size={11} stroke="var(--ink-3)"/>
      <span style={{fontSize:11.5,color:"var(--ink-2)"}}>{label}</span>
      {badge && <span className="tag" style={{padding:"1px 6px",fontSize:9.5,color: badgeColor==="mint"?"var(--mint)":"var(--ink-2)"}}>{badge}</span>}
    </div>
    {children}
  </div>
);

const Field = ({ label, children }) => (
  <div style={{marginBottom:12}}>
    <div style={{fontSize:11.5,color:"var(--ink-2)",marginBottom:6}}>{label}</div>
    {children}
  </div>
);

const Hint = ({ children }) => (
  <div style={{fontSize:10.5,color:"var(--ink-3)",marginTop:5,lineHeight:1.5}}>{children}</div>
);

const Toggle = ({ on }) => (
  <div style={{
    width:34,height:19,borderRadius:10,padding:2,
    background: on?"rgba(142,240,183,0.25)":"rgba(255,255,255,0.06)",
    border:`0.5px solid ${on?"rgba(142,240,183,0.4)":"var(--line-2)"}`,
    display:"flex",alignItems:"center",justifyContent:on?"flex-end":"flex-start",
    transition:"all .2s",cursor:"pointer"
  }}>
    <div style={{width:13,height:13,borderRadius:"50%",background:on?"var(--mint)":"var(--ink-3)",boxShadow: on?"0 0 8px var(--mint)":"none"}}/>
  </div>
);

Object.assign(window, { SetupModal });
