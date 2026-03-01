import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUp, Paperclip, Search, Sparkles } from 'lucide-react';

export interface SplashPageProps {
  hasLogs: boolean;
  onUploadClick: () => void;
  onPromptSelect: (prompt: string) => void;
  onSubmitPrompt: (prompt: string) => void;
}

interface InfoCard {
  title: string;
  items: string[];
  icon: React.ReactNode;
}

const PROMPT_SUGGESTIONS: string[] = [
  'Find all SIP error bursts in the last 10 minutes',
  'Summarize the top call failures by correlation ID',
  'Show timeline anomalies around dropped calls',
  'Highlight repeated warning patterns by endpoint',
  'Explain likely root cause for transaction timeouts',
  'Compare successful vs failed INVITE sequences',
];

const INFO_CARDS: InfoCard[] = [
  {
    title: 'Examples',
    icon: <Search className="text-[var(--accent-blue)]" size={40} />,
    items: [
      'Pinpoint where a call setup failed',
      'Trace events for one Call-ID end-to-end',
      'Summarize noisy warning spikes by component',
    ],
  },
  {
    title: 'Capabilities',
    icon: <Sparkles className="text-[var(--accent-blue)]" size={40} />,
    items: [
      'Correlates logs by IDs and timestamps',
      'Surfaces key events and probable causes',
      'Suggests next troubleshooting steps',
    ],
  },
  {
    title: 'Limitations',
    icon: <AlertTriangle className="text-[var(--accent-blue)]" size={40} />,
    items: [
      'Analysis quality depends on uploaded logs',
      'Missing context can reduce confidence',
      'AI suggestions still require operator review',
    ],
  },
];

function SplashPage({
  hasLogs,
  onUploadClick,
  onPromptSelect,
  onSubmitPrompt,
}: SplashPageProps) {
  const [promptInput, setPromptInput] = useState<string>('');

  const trimmedPrompt = useMemo(() => promptInput.trim(), [promptInput]);
  const isSubmitDisabled = !hasLogs || trimmedPrompt.length === 0;

  const handlePromptChipClick = useCallback(
    (prompt: string) => {
      setPromptInput(prompt);
      if (hasLogs) {
        onPromptSelect(prompt);
      }
    },
    [hasLogs, onPromptSelect]
  );

  const handleSubmit = useCallback(() => {
    if (isSubmitDisabled) {
      return;
    }

    onSubmitPrompt(trimmedPrompt);
  }, [isSubmitDisabled, onSubmitPrompt, trimmedPrompt]);

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleSubmit();
    },
    [handleSubmit]
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-8 md:px-8 md:py-10">
        <section className="rounded-xl border border-[var(--border-color)] bg-[var(--accent-blue)]/10 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-blue)]">
                Upload required first
              </p>
              <p className="text-sm text-[var(--text-secondary)] md:text-base">
                Upload logs before analysis to enable prompt submission and get accurate results.
              </p>
            </div>
            <button
              type="button"
              onClick={onUploadClick}
              className="inline-flex items-center justify-center rounded-md bg-[var(--accent-blue)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-blue)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/50"
            >
              Upload logs
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-light)]/40 p-6 md:p-8">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Welcome to NocLense v2</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight md:text-4xl">
            Start with logs, then ask focused questions.
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-[var(--text-secondary)] md:text-base">
            Analyze SIP and telecom events with guided prompts, timeline-aware context, and quick
            troubleshooting summaries.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {INFO_CARDS.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-none"
            >
              <div className="flex flex-col gap-2 px-4 pt-6 pb-4">
                {card.icon}
                <p className="text-medium text-[var(--text-primary)]">{card.title}</p>
              </div>
              <div className="flex flex-col gap-2 px-4 pb-6">
                {card.items.map((item) => (
                  <div
                    key={item}
                    className="rounded-lg bg-[var(--bg-light)] min-h-[50px] px-3 py-2 flex items-center"
                  >
                    <p className="text-sm text-[var(--text-secondary)]">{item}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Prompt suggestions
          </h2>
          <div className="overflow-x-auto flex flex-nowrap gap-2 pb-2 -mx-1 scrollbar-thin">
            {PROMPT_SUGGESTIONS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handlePromptChipClick(prompt)}
                className="flex h-14 flex-col items-start gap-0 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--accent-blue)]/50 hover:bg-[var(--accent-blue)]/10 shrink-0"
              >
                <p className="font-medium">{prompt}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <label htmlFor="splash-prompt-input" className="text-sm font-medium">
            Ask for analysis
          </label>
          <form
            onSubmit={handleFormSubmit}
            className="rounded-xl bg-[var(--bg-light)] hover:bg-[var(--bg-light)]/80 flex w-full flex-col items-start transition-colors border border-[var(--border-color)]"
          >
            <div className="relative w-full">
              <textarea
                id="splash-prompt-input"
                aria-label="Ask for analysis"
                value={promptInput}
                onChange={(event) => setPromptInput(event.target.value)}
                placeholder="Example: Identify probable root cause for repeated BYE retries."
                rows={3}
                className="w-full resize-none rounded-xl bg-transparent border-0 shadow-none pt-4 pl-4 pb-4 pr-12 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-secondary)]/70 focus:ring-0"
              />
              <button
                type="submit"
                disabled={isSubmitDisabled}
                title="Send message"
                className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: isSubmitDisabled ? 'var(--border-color)' : 'var(--accent-blue)',
                }}
              >
                <ArrowUp size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="flex w-full items-center justify-between gap-2 overflow-auto px-4 pb-4">
              <div className="flex w-full gap-1 md:gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]/50 transition-colors"
                >
                  <Paperclip size={18} className="text-[var(--text-secondary)]" />
                  Attach
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] py-1">
                {promptInput.length}/2000
              </p>
            </div>
          </form>
          {!hasLogs && (
            <p className="text-sm text-[var(--text-secondary)] px-2">
              Upload logs to enable analysis
            </p>
          )}
          <p className="text-xs text-[var(--text-secondary)] px-2">
            NocLense AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SplashPage;
