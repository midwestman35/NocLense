/**
 * Thrown when an EvidenceSet's investigationId does not match the
 * companion Investigation's id. Used by both the exporter and the
 * EvidenceContext restore path.
 */
export class InvestigationMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(
      `Investigation ID mismatch: expected "${expected}", got "${actual}". Refusing to mutate state with a mismatched pair.`,
    );
    this.name = 'InvestigationMismatchError';
  }
}
