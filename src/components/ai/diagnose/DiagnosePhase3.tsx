/**
 * DiagnosePhase3.tsx
 *
 * Phase 3 of the NOC Diagnosis workflow.
 * Handles log archive generation and submitting the internal note to Zendesk.
 *
 * Modes:
 *   ticket present   — "Post Internal Note" to existing/newly-created ticket
 *   no ticket (skip) — "Copy to Clipboard" + optional "Create New Ticket" flow
 */
import { useState } from 'react';
import {
  ChevronLeft, Archive, Download, Paperclip, CheckCircle,
  Copy, ExternalLink, Plus,
} from 'lucide-react';
import type { AiSettings } from '../../../store/aiSettings';
import type { ZendeskTicket, ZendeskTicketDraft } from '../../../services/zendeskService';
import {
  postZendeskComment,
  uploadZendeskAttachment,
  createZendeskTicket,
} from '../../../services/zendeskService';
import { saveInvestigationToConfluence, type SavedInvestigation } from '../../../services/confluenceService';
import { generateLogArchive, downloadBlob } from '../../../utils/logArchive';
import type { LogEntry } from '../../../types';
import type { DiagnosisResult } from '../../../types/diagnosis';
import Spinner from '../../ui/Spinner';

interface Props {
  settings: AiSettings;
  ticket: ZendeskTicket | null;
  diagnosisResult: DiagnosisResult | null;
  customerTimezone: string;
  internalNote: string;
  logs: LogEntry[];
  defaultFilename: string;
  onBack: () => void;
  onDone: () => void;
}

const INPUT = 'w-full rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-[12px] text-[var(--foreground)] outline-none';
const LABEL = 'block text-[11px] font-medium text-[var(--muted-foreground)] mb-1';

export default function DiagnosePhase3({
  settings,
  ticket,
  diagnosisResult,
  customerTimezone,
  internalNote,
  logs,
  defaultFilename,
  onBack,
  onDone,
}: Props) {
  // Archive options
  const [includeArchive, setIncludeArchive] = useState(true);
  const [archiveFilename, setArchiveFilename] = useState(defaultFilename);
  const [downloadLocal, setDownloadLocal] = useState(true);
  const [attachToZd, setAttachToZd] = useState(!!ticket);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ ticketId: number | string } | null>(null);
  const [attachmentFailed, setAttachmentFailed] = useState(false);
  const [retryingAttachment, setRetryingAttachment] = useState(false);
  const [confluenceResult, setConfluenceResult] = useState<SavedInvestigation | null>(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Create new ticket flow (skip mode)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleSubmit(targetTicket: ZendeskTicket) {
    setSubmitting(true);
    setSubmitError(null);
    setAttachmentFailed(false);
    try {
      let uploadToken: string | undefined;

      // Generate and handle archive
      if (includeArchive) {
        const blob = await generateLogArchive(logs, archiveFilename);

        if (downloadLocal) {
          downloadBlob(blob, archiveFilename);
        }

        if (attachToZd && settings.zendeskToken) {
          try {
            uploadToken = await uploadZendeskAttachment(settings, blob, `${archiveFilename}.zip`);
          } catch {
            setAttachmentFailed(true);
          }
        }
      }

      await postZendeskComment(settings, targetTicket.id, internalNote, uploadToken);
      setSubmitSuccess({ ticketId: targetTicket.id });

      // Save investigation to Confluence (non-blocking — don't fail the submit)
      if (diagnosisResult) {
        saveInvestigationToConfluence(settings, targetTicket, diagnosisResult, internalNote, customerTimezone)
          .then(result => setConfluenceResult(result))
          .catch(err => console.warn('[Confluence] Failed to save investigation:', err));
      }
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetryAttachment(ticketId: number | string) {
    if (!includeArchive || !settings.zendeskToken) return;
    setRetryingAttachment(true);
    try {
      const blob = await generateLogArchive(logs, archiveFilename);
      const token = await uploadZendeskAttachment(settings, blob, `${archiveFilename}.zip`);
      // Post a follow-up comment with just the attachment
      await postZendeskComment(settings, ticketId, '(Log archive attached)', token);
      setAttachmentFailed(false);
    } catch (e: unknown) {
      // Still failed — keep the warning visible
      setSubmitError(`Attachment retry failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRetryingAttachment(false);
    }
  }

  async function handleCreateAndPost() {
    if (!newSubject.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const draft: ZendeskTicketDraft = {
        subject: newSubject.trim(),
        description: internalNote,
        requesterEmail: newEmail.trim() || undefined,
      };
      const newTicket = await createZendeskTicket(settings, draft);
      await handleSubmit(newTicket);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(internalNote).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  // ── Success screen ──────────────────────────────────────────────
  if (submitSuccess) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <CheckCircle size={40} className={attachmentFailed ? 'text-amber-400' : 'text-[var(--success)]'} />
        <div>
          <p className="text-[14px] font-semibold" style={{ color: 'var(--foreground)' }}>
            {attachmentFailed ? 'Note posted — attachment failed' : 'Internal note posted!'}
          </p>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            Ticket #{submitSuccess.ticketId} has been updated with your diagnosis note.
          </p>
          {includeArchive && downloadLocal && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              Log archive downloaded as <span className="font-mono">{archiveFilename}.zip</span>
            </p>
          )}
        </div>
        {attachmentFailed && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
            <p className="text-[11px] text-amber-400 font-medium">
              The log archive could not be uploaded to Zendesk. The internal note was posted without the attachment.
            </p>
            {submitError && (
              <p className="mt-1 text-[10px] text-red-400">{submitError}</p>
            )}
            <button
              type="button"
              onClick={() => handleRetryAttachment(submitSuccess.ticketId)}
              disabled={retryingAttachment}
              className="mt-2 flex items-center gap-1.5 rounded border px-3 py-1 text-[11px] font-medium transition-colors hover:bg-amber-500/10 disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {retryingAttachment ? <Spinner size={11} label="Retrying" /> : <Paperclip size={11} />}
              {retryingAttachment ? 'Retrying…' : 'Retry Attachment Upload'}
            </button>
          </div>
        )}
        {confluenceResult && (
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            Investigation saved to{' '}
            <a href={confluenceResult.url} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300 underline">
              Confluence
            </a>
          </p>
        )}
        <div className="flex gap-2">
          {settings.zendeskSubdomain && (
            <a
              href={`https://${settings.zendeskSubdomain}.zendesk.com/agent/tickets/${submitSuccess.ticketId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--muted)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <ExternalLink size={11} /> View in Zendesk
            </a>
          )}
          <button
            type="button"
            onClick={onDone}
            className="rounded px-3 py-1.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: 'var(--success)' }}
          >
            New Diagnosis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Phase nav */}
      <div
        className="flex shrink-0 items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] transition-colors hover:text-[var(--foreground)]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ChevronLeft size={13} /> Back
        </button>
        <span className="text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
          Step 3 — Submit
        </span>
        <div className="w-14" />
      </div>

      <div className="flex flex-col gap-4 p-3">

        {/* Note preview */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-foreground)' }}>
            Note to be posted
          </p>
          <pre
            className="max-h-48 overflow-y-auto rounded border p-3 font-mono text-[10px] leading-relaxed"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)', color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {internalNote || '(empty)'}
          </pre>
        </div>

        {/* Archive section */}
        <div className="rounded border p-3" style={{ borderColor: 'var(--border)' }}>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={includeArchive}
              onChange={e => setIncludeArchive(e.target.checked)}
              className="accent-violet-500"
            />
            <Archive size={13} style={{ color: 'var(--muted-foreground)' }} />
            <span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>
              Include log archive
            </span>
          </label>

          {includeArchive && (
            <div className="mt-3 flex flex-col gap-2 pl-5">
              <div>
                <label className={LABEL}>Archive filename</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={archiveFilename}
                    onChange={e => setArchiveFilename(e.target.value)}
                    className={INPUT}
                  />
                  <span className="shrink-0 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>.zip</span>
                </div>
                <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  Naming: OrgName_SiteOrPosition_YYYY-MM-DD_logs
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-[11px]" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={downloadLocal}
                  onChange={e => setDownloadLocal(e.target.checked)}
                  className="accent-violet-500"
                />
                <Download size={11} style={{ color: 'var(--muted-foreground)' }} />
                Download to my computer
              </label>

              {ticket && (
                <label className="flex cursor-pointer items-center gap-2 text-[11px]" style={{ color: 'var(--foreground)' }}>
                  <input
                    type="checkbox"
                    checked={attachToZd}
                    onChange={e => setAttachToZd(e.target.checked)}
                    className="accent-violet-500"
                  />
                  <Paperclip size={11} style={{ color: 'var(--muted-foreground)' }} />
                  Attach to Zendesk ticket #{ticket?.id}
                </label>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {submitError && (
          <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
            {submitError}
          </p>
        )}

        {ticket ? (
          // Has ticket — post as internal note
          <button
            type="button"
            onClick={() => handleSubmit(ticket)}
            disabled={submitting || !internalNote.trim()}
            className="flex items-center justify-center gap-2 rounded py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--success)' }}
          >
            {submitting ? <Spinner size="md" label="Posting" /> : <CheckCircle size={14} />}
            {submitting ? 'Posting…' : `Post Internal Note to #${ticket.id}`}
          </button>
        ) : (
          // No ticket — copy or create
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded border py-2 text-[12px] font-medium transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: copied ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'var(--muted)', color: copied ? 'var(--success)' : 'var(--foreground)' }}
            >
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Note to Clipboard'}
            </button>

            {includeArchive && (
              <button
                type="button"
                onClick={async () => {
                  const blob = await generateLogArchive(logs, archiveFilename);
                  if (downloadLocal) downloadBlob(blob, archiveFilename);
                  onDone();
                }}
                className="flex items-center justify-center gap-2 rounded border py-2 text-[12px] font-medium transition-colors"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
              >
                <Download size={14} /> Download Log Archive
              </button>
            )}

            <div className="relative flex items-center gap-2 py-1">
              <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>or</span>
              <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
            </div>

            {!showCreateForm ? (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="flex items-center justify-center gap-2 rounded border py-2 text-[12px] font-medium transition-colors hover:bg-[var(--muted)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <Plus size={14} /> Create New Zendesk Ticket
              </button>
            ) : (
              <div className="rounded border p-3" style={{ borderColor: 'var(--border)' }}>
                <p className="mb-2 text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
                  New Zendesk Ticket
                </p>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className={LABEL}>Subject <span className="text-red-400">*</span></label>
                    <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Brief issue summary" className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Requester Email <span style={{ color: 'var(--muted-foreground)' }}>(optional)</span></label>
                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="customer@example.com" className={INPUT} />
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    The internal note above will be posted as a private comment on the new ticket.
                  </p>
                  {createError && <p className="text-[11px] text-red-400">{createError}</p>}
                  <button
                    type="button"
                    onClick={handleCreateAndPost}
                    disabled={creating || !newSubject.trim()}
                    className="flex items-center justify-center gap-2 rounded py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--success)' }}
                  >
                    {creating ? <Spinner size="md" label="Creating" /> : <CheckCircle size={14} />}
                    {creating ? 'Creating & Posting…' : 'Create Ticket & Post Note'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
