import { useEffect, useMemo, useState, type JSX } from 'react';
import { caseLibraryService, type SimilarCaseMatch } from '../../services/caseLibraryService';
import { caseRepository } from '../../services/caseRepository';
import type { Case } from '../../types/case';
import { Button, Card, CardContent, Icon } from '../ui';
import { AppShellSidebar } from '../app/AppShellSidebar';
import { LoadingLabel } from '../loading/LoadingLabel';
import { ClosedRow } from './ClosedRow';
import { ContinueCard } from './ContinueCard';
import { InvestigationRow } from './InvestigationRow';
import { LiveLogPeek } from './LiveLogPeek';
import { MetricsStrip } from './MetricsStrip';

interface DashboardScreenProps {
  onOpenWorkspace: () => void;
}

export function DashboardScreen({
  onOpenWorkspace,
}: DashboardScreenProps): JSX.Element {
  const [cases, setCases] = useState<Case[]>([]);
  const [similarMatches, setSimilarMatches] = useState<SimilarCaseMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async (): Promise<void> => {
      setIsLoading(true);

      try {
        const nextCases = await caseRepository.listCases({ orderBy: 'updatedAt', limit: 10 });
        if (cancelled) return;

        setCases(nextCases);
        setError(null);

        const focusCase = nextCases.find((caseItem) => caseItem.status !== 'resolved') ?? nextCases[0] ?? null;
        if (!focusCase) {
          setSimilarMatches([]);
          return;
        }

        try {
          const matches = await caseLibraryService.findSimilar(focusCase, {
            topK: 3,
            filters: { excludeCaseIds: [focusCase.id] },
          });

          if (!cancelled) {
            setSimilarMatches(matches);
          }
        } catch {
          if (!cancelled) {
            setSimilarMatches([]);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setCases([]);
          setSimilarMatches([]);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard cases.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const openCases = useMemo(
    () => cases.filter((caseItem) => caseItem.status !== 'resolved'),
    [cases],
  );
  const closedCases = useMemo(
    () => cases.filter((caseItem) => caseItem.status === 'resolved'),
    [cases],
  );
  const leadCase = openCases[0] ?? cases[0] ?? null;
  const greetingDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date());

  return (
    <div className="flex h-screen w-full bg-[var(--bg-0)] text-[var(--ink-0)]">
      <AppShellSidebar
        activeRoom="home"
        onNavigate={(room) => {
          if (room === 'home') return;
          onOpenWorkspace();
        }}
        openCount={openCases.length}
        closedCount={closedCases.length}
        primaryAction={{ label: 'Open workspace', onClick: onOpenWorkspace }}
      />

      <div className="relative flex-1 min-w-0 overflow-hidden">
        <div className="relative h-full overflow-y-auto px-6 py-8 sm:px-8 xl:px-12 xl:py-10">
              <header className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-3">
                  <p className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-3)]">{greetingDate}</p>
                  <div className="space-y-2">
                    <h1 className="text-4xl font-normal leading-none tracking-[-0.03em] text-[var(--ink-0)]">
                      <LoadingLabel
                        text="Let's begin"
                        ariaStatus="Let's begin"
                        style={{ fontSize: 'inherit', letterSpacing: 'inherit', fontFamily: 'inherit' }}
                      />
                    </h1>
                    <p className="max-w-[48rem] text-sm leading-6 text-[var(--ink-2)]">
                      {openCases.length > 0
                        ? `${openCases.length} active investigations are ready to resume. ${closedCases.length} resolved cases remain available in the local library.`
                        : 'No investigations are persisted yet. Import logs or create a case to start the four-room workflow.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="ghost" onClick={onOpenWorkspace}>
                    <Icon name="import" size={14} />
                    Import logs
                  </Button>
                  <Button type="button" onClick={onOpenWorkspace}>
                    <Icon name="plus" size={14} />
                    New investigation
                  </Button>
                </div>
              </header>

              <div className="space-y-8">
                <MetricsStrip cases={cases} similarCount={similarMatches.length} />

                {isLoading ? (
                  <DashboardStateCard
                    title="Loading dashboard"
                    body="Reading persisted cases from the local repository and warming the case library context."
                  />
                ) : error ? (
                  <DashboardStateCard title="Unable to load dashboard" body={error} tone="error" />
                ) : cases.length === 0 ? (
                  <DashboardStateCard
                    title="No investigations yet"
                    body="The dashboard is wired to the real case repository. Import logs or create a case to populate this surface."
                  />
                ) : (
                  <>
                    {leadCase ? (
                      <ContinueCard caseItem={leadCase} relatedCount={similarMatches.length} onResume={onOpenWorkspace} />
                    ) : null}

                    <LiveLogPeek caseItem={leadCase} similarMatches={similarMatches} />

                    <section className="space-y-4">
                      <SectionHeader label={`Open · ${openCases.length}`} hint="real cases from IndexedDB" />
                      {openCases.length === 0 ? (
                        <DashboardStateCard
                          title="No open cases"
                          body="Resolved cases still appear below. Start a new investigation from the workspace to repopulate this list."
                        />
                      ) : (
                        <div className="space-y-3">
                          {openCases.map((caseItem) => (
                            <InvestigationRow key={caseItem.id} caseItem={caseItem} onOpenWorkspace={onOpenWorkspace} />
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="space-y-4">
                      <SectionHeader label="Recently closed" hint="case library history" />
                      {closedCases.length === 0 ? (
                        <DashboardStateCard
                          title="No archived cases"
                          body="Resolved cases will appear here once investigations are closed and retained in the repository."
                        />
                      ) : (
                        <div className="divide-y divide-[var(--line)]">
                          {closedCases.map((caseItem) => (
                            <ClosedRow key={caseItem.id} caseItem={caseItem} />
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}

function DashboardStateCard({
  title,
  body,
  tone = 'default',
}: {
  title: string;
  body: string;
  tone?: 'default' | 'error';
}): JSX.Element {
  return (
    <Card className={tone === 'error' ? 'border-[rgba(255,107,122,0.24)] bg-[rgba(255,107,122,0.06)]' : 'border-[var(--line)] bg-[rgba(255,255,255,0.02)]'}>
      <CardContent className="space-y-2 p-5">
        <p className={`mono text-[10px] uppercase tracking-[0.16em] ${tone === 'error' ? 'text-[var(--red)]' : 'text-[var(--ink-3)]'}`}>
          {tone === 'error' ? 'Dashboard error' : 'Dashboard state'}
        </p>
        <h2 className="text-lg font-medium tracking-[-0.02em] text-[var(--ink-0)]">{title}</h2>
        <p className="text-sm leading-6 text-[var(--ink-2)]">{body}</p>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ label, hint }: { label: string; hint: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-3 sm:flex-row sm:items-baseline">
      <p className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-1)]">{label}</p>
      <p className="mono text-[11px] text-[var(--ink-3)]">{hint}</p>
    </div>
  );
}

