export type Phase = 'import' | 'setup' | 'investigate' | 'submit';

export type CardId =
  | 'log-stream'
  | 'ai-assistant'
  | 'evidence'
  | 'similar-tickets'
  | 'correlation-graph'
  | 'datadog-live';

export interface CardState {
  id: CardId;
  expanded: boolean;
}

export const PHASE_ORDER: Phase[] = ['import', 'setup', 'investigate', 'submit'];

export const PHASE_LABELS: Record<Phase, string> = {
  import: 'Import',
  setup: 'Setup',
  investigate: 'Investigate',
  submit: 'Submit',
};
