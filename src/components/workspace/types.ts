export type Phase = 'import' | 'investigate' | 'submit';

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

export const PHASE_ORDER: Phase[] = ['import', 'investigate', 'submit'];

export const PHASE_LABELS: Record<Phase, string> = {
  import: 'Import',
  investigate: 'Investigate',
  submit: 'Submit',
};
