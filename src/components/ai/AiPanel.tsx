import { useState, useRef, useEffect } from 'react';
import { Sparkles, AlertTriangle, MessageSquare, Tag, Settings, X, Send, RefreshCw, Stethoscope, Maximize2, Minimize2 } from 'lucide-react';
import { SkeletonAiPanel } from '../ui/Skeleton';
import Spinner from '../ui/Spinner';
import { useLogContext } from '../../contexts/LogContext';
import { loadAiSettings, type AiSettings } from '../../store/aiSettings';
import {
  summarizeLogs,
  detectAnomalies,
  autoTagLogs,
  chatWithLogs,
  type ChatMessage,
} from '../../services/unleashService';
import AiSettingsModal from './AiSettingsModal';
import DiagnoseTab from './DiagnoseTab';
import type { CitationId } from '../../types/canonical';

type Tab = 'diagnose' | 'summary' | 'anomalies' | 'chat' | 'tags';

interface TabResult {
  content: string;
  error: string | null;
  loading: boolean;
}

const EMPTY_RESULT: TabResult = { content: '', error: null, loading: false };
const WELCOME_DISMISSED_KEY = 'unleash_welcome_dismissed';

interface Props {
  onClose: () => void;
  /** Ticket ID arriving from the Import screen — auto-switches to Diagnose tab */
  pendingTicketId?: string;
  /** Call once the pending ticket has been handed off to DiagnoseTab */
  onTicketHandled?: () => void;
  /** Full investigation setup from InvestigationSetupModal — triggers auto-scan */
  pendingSetup?: import('../../types/investigation').InvestigationSetup | null;
  /** Call once the setup has been consumed */
  onSetupConsumed?: () => void;
  onCitationClick?: (citationId: CitationId) => void;
}

export default function AiPanel({
  onClose,
  pendingTicketId,
  onTicketHandled,
  pendingSetup,
  onSetupConsumed,
  onCitationClick,
}: Props) {
  const { filteredLogs, logs } = useLogContext();
  const activeLogs = filteredLogs.length > 0 ? filteredLogs : logs;

  const [tab, setTab] = useState<Tab>('diagnose');
  const [popped, setPopped] = useState(false);
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean>(
    () => localStorage.getItem(WELCOME_DISMISSED_KEY) === 'true'
  );

  const [summary, setSummary] = useState<TabResult>(EMPTY_RESULT);
  const [anomalies, setAnomalies] = useState<TabResult>(EMPTY_RESULT);
  const [tagsResult, setTagsResult] = useState<TabResult>(EMPTY_RESULT);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // When a ticket arrives from the Import screen, switch to Diagnose tab automatically
  useEffect(() => {
    if (pendingTicketId) {
      setTab('diagnose');
    }
  }, [pendingTicketId]);

  function dismissWelcome() {
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    setWelcomeDismissed(true);
  }

  const hasLogs = activeLogs.length > 0;
  const logCount = activeLogs.length;

  async function runSummary() {
    setSummary({ content: '', error: null, loading: true });
    try {
      const result = await summarizeLogs(settings, activeLogs);
      setSummary({ content: result, error: null, loading: false });
    } catch (e: any) {
      setSummary({ content: '', error: e.message, loading: false });
    }
  }

  async function runAnomalies() {
    setAnomalies({ content: '', error: null, loading: true });
    try {
      const result = await detectAnomalies(settings, activeLogs);
      setAnomalies({ content: result, error: null, loading: false });
    } catch (e: any) {
      setAnomalies({ content: '', error: e.message, loading: false });
    }
  }

  async function runTags() {
    setTagsResult({ content: '', error: null, loading: true });
    try {
      const result = await autoTagLogs(settings, activeLogs);
      setTagsResult({ content: result, error: null, loading: false });
    } catch (e: any) {
      setTagsResult({ content: '', error: e.message, loading: false });
    }
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    setChatError(null);
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'User', text: msg }];
    setChatHistory(newHistory);
    setChatLoading(true);
    try {
      const reply = await chatWithLogs(settings, msg, activeLogs, chatHistory);
      setChatHistory(h => [...h, { role: 'Assistant', text: reply }]);
    } catch (e: any) {
      setChatError(e.message);
    } finally {
      setChatLoading(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'diagnose', label: 'Diagnose', icon: <Stethoscope size={14} /> },
    { id: 'summary', label: 'Summary', icon: <Sparkles size={14} /> },
    { id: 'anomalies', label: 'Anomalies', icon: <AlertTriangle size={14} /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={14} /> },
    { id: 'tags', label: 'Auto-tag', icon: <Tag size={14} /> },
  ];

  const panelStyle: React.CSSProperties = popped
    ? {
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 200,
        width: 'min(55vw, 960px)',
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg,rgba(15,19,25,0.94),rgba(10,13,18,0.96))',
        color: 'var(--card-foreground)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
        borderLeft: '1px solid var(--border)',
      }
    : {
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'transparent', color: 'var(--card-foreground)',
      };

  return (
    <>
      <AiSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={s => setSettings(s)}
      />

      {/* Semi-transparent backdrop when popped out */}
      {popped && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 199, backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(1px)' }}
          onClick={() => setPopped(false)}
        />
      )}

      <div style={panelStyle}>
        {/* Panel Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          background: 'var(--panel-header-surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
              Unleashed AI
            </span>
            {hasLogs && (
              <span style={{
                fontSize: '11px', color: 'var(--muted-foreground)',
                backgroundColor: 'var(--muted)', padding: '2px 6px', borderRadius: '10px',
              }}>
                {logCount.toLocaleString()} logs
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setSettingsOpen(true)}
              title="AI Settings"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '4px', borderRadius: '6px' }}
            >
              <Settings size={15} />
            </button>
            <button
              onClick={() => setPopped(p => !p)}
              title={popped ? 'Collapse panel' : 'Expand panel'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '4px', borderRadius: '6px' }}
            >
              {popped ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            {onClose && !popped && (
              <button
                onClick={onClose}
                title="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '4px', borderRadius: '6px' }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Welcome Banner */}
        {!welcomeDismissed && (
          <div style={{
            margin: '10px 12px 0', padding: '10px 12px', borderRadius: '8px', flexShrink: 0,
            backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Sparkles size={14} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--foreground)', marginBottom: '4px' }}>
                    Unleashed AI is ready for your team
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.6' }}>
                    Pre-configured with your team's Confluence, Zendesk, and Slack knowledge — no setup needed.<br />
                    <strong style={{ color: 'var(--foreground)' }}>Summary / Anomalies / Auto-tag</strong> — one-click log analysis.{' '}
                    <strong style={{ color: 'var(--foreground)' }}>Chat</strong> — ask anything about your logs.{' '}
                    <strong style={{ color: 'var(--foreground)' }}>Ticket</strong> — fetch a Zendesk ticket for context.{' '}
                    <strong style={{ color: 'var(--foreground)' }}>Diagnose</strong> — AI correlates the ticket with your logs, highlights relevant entries in violet, and guides you to resolution with Zendesk + Jira integration.<br />
                    <span style={{ opacity: 0.7 }}>Responses may take 15–30 seconds.</span>
                  </p>
                </div>
              </div>
              <button
                onClick={dismissWelcome}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '0', flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0,
          backgroundColor: 'var(--background)', marginTop: welcomeDismissed ? '0' : '8px',
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '10px 2px', border: 'none', cursor: 'pointer', fontSize: '11px',
                fontWeight: tab === t.id ? '600' : '400',
                color: tab === t.id ? 'var(--success)' : 'var(--muted-foreground)',
                backgroundColor: 'transparent',
                borderBottom: tab === t.id ? '2px solid var(--success)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                transition: 'all 0.15s',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content — Diagnose always mounts (works without logs); others gate on hasLogs */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* No logs placeholder — only shown when not on Diagnose tab */}
          {!hasLogs && tab !== 'diagnose' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center' }}>
              <div>
                <Sparkles size={28} style={{ color: 'var(--muted-foreground)', margin: '0 auto 10px' }} />
                <p style={{ fontSize: '13px', color: 'var(--foreground)', marginBottom: '4px' }}>No logs loaded</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Open a log file to use AI analysis</p>
              </div>
            </div>
          )}

          {hasLogs && (
          <>

            {tab === 'summary' && (
              <AnalysisTab
                result={summary}
                onRun={runSummary}
                runLabel="Summarize Logs"
                emptyPrompt="Get a plain-language summary of what happened in this log session. Responses may take 15–30 seconds."
                icon={<Sparkles size={20} style={{ color: 'var(--success)' }} />}
              />
            )}

            {tab === 'anomalies' && (
              <AnalysisTab
                result={anomalies}
                onRun={runAnomalies}
                runLabel="Detect Anomalies"
                emptyPrompt="Find errors, anomalies, and root causes in the loaded logs. Responses may take 15–30 seconds."
                icon={<AlertTriangle size={20} style={{ color: 'var(--warning)' }} />}
              />
            )}

            {tab === 'tags' && (
              <AnalysisTab
                result={tagsResult}
                onRun={runTags}
                runLabel="Classify Logs"
                emptyPrompt="Group log entries into categories (SIP, NETWORK, AUTH, etc.) and summarize each group."
                icon={<Tag size={20} style={{ color: 'var(--info)' }} />}
              />
            )}

            {/* Chat tab — always mounted, hidden when inactive to preserve history */}
            <div style={{ flex: 1, display: tab === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {chatHistory.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <MessageSquare size={24} style={{ color: 'var(--muted-foreground)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '13px', color: 'var(--foreground)' }}>Ask anything about the loaded logs</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                      e.g. "What caused the 500 error?" — responses take 15–30 sec
                    </p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} style={{
                    maxWidth: '90%', padding: '9px 12px', borderRadius: '10px', fontSize: '12px', lineHeight: '1.5',
                    alignSelf: msg.role === 'User' ? 'flex-end' : 'flex-start',
                    backgroundColor: msg.role === 'User' ? 'var(--success)' : 'var(--muted)',
                    color: msg.role === 'User' ? '#fff' : 'var(--foreground)',
                  }}>
                    {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{
                    alignSelf: 'flex-start', padding: '9px 12px', borderRadius: '10px',
                    backgroundColor: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <Spinner size="sm" className="text-[var(--success)]" label="Thinking" />
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Thinking... (15–30 sec)</span>
                  </div>
                )}
                {chatError && <ErrorBox message={chatError} onDismiss={() => setChatError(null)} />}
                <div ref={chatBottomRef} />
              </div>

              {chatHistory.length > 0 && (
                <div style={{ padding: '0 12px 4px' }}>
                  <button
                    onClick={() => { setChatHistory([]); setChatError(null); }}
                    style={{ fontSize: '11px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={11} /> Clear chat
                  </button>
                </div>
              )}

              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
                  placeholder="Ask about these logs..."
                  disabled={chatLoading}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px',
                    backgroundColor: 'var(--input)', border: '1px solid var(--border)',
                    color: 'var(--foreground)', outline: 'none',
                  }}
                />
                <button
                  onClick={() => void sendChat()}
                  disabled={!chatInput.trim() || chatLoading}
                  style={{
                    padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    backgroundColor: chatInput.trim() && !chatLoading ? 'var(--success)' : 'var(--muted)',
                    color: chatInput.trim() && !chatLoading ? '#fff' : 'var(--muted-foreground)',
                    transition: 'all 0.15s',
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>

          </>
          )}

          {/* Diagnose tab — always mounted, works with or without local logs */}
          <div style={{ display: tab === 'diagnose' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <DiagnoseTab
              initialTicketId={pendingTicketId}
              onTicketConsumed={onTicketHandled}
              pendingSetup={pendingSetup}
              onSetupConsumed={onSetupConsumed}
              onCitationClick={onCitationClick}
            />
          </div>
        </div>
      </div>

    </>
  );
}

function AnalysisTab({ result, onRun, runLabel, emptyPrompt, icon }: {
  result: TabResult;
  onRun: () => void;
  runLabel: string;
  emptyPrompt: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <button
        onClick={onRun}
        disabled={result.loading}
        style={{
          width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid var(--border)',
          cursor: result.loading ? 'not-allowed' : 'pointer',
          backgroundColor: result.loading ? 'var(--muted)' : 'var(--success)',
          color: result.loading ? 'var(--muted-foreground)' : '#fff',
          fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'all 0.15s',
        }}
      >
        {result.loading
          ? <><Spinner size="md" label="Analyzing" /> Analyzing... (15–30 sec)</>
          : runLabel
        }
      </button>

      {result.error && <ErrorBox message={result.error} onDismiss={() => {}} />}

      {result.loading && !result.content && <SkeletonAiPanel />}

      {result.content ? (
        <div style={{
          fontSize: '12px', lineHeight: '1.6', color: 'var(--foreground)',
          backgroundColor: 'var(--muted)', borderRadius: '8px', padding: '12px',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          border: '1px solid var(--border)',
        }}>
          {result.content}
        </div>
      ) : !result.loading && !result.error && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted-foreground)' }}>
          {icon}
          <p style={{ fontSize: '11px', marginTop: '8px', lineHeight: '1.5' }}>{emptyPrompt}</p>
        </div>
      )}
    </div>
  );
}

function ErrorBox({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div style={{
      backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: '8px', padding: '9px 12px', fontSize: '11px', color: 'var(--destructive)',
      display: 'flex', gap: '8px', alignItems: 'flex-start',
    }}>
      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', padding: 0 }}>
        <X size={12} />
      </button>
    </div>
  );
}
