import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StageBar from './StageBar';
import { DIAGNOSE_PIPELINE_STAGES } from './pipelineUi';

describe('StageBar', () => {
  it('renders the six pipeline stages', () => {
    render(<StageBar />);

    expect(screen.getByLabelText('Diagnosis pipeline')).toBeTruthy();
    for (const stage of DIAGNOSE_PIPELINE_STAGES) {
      expect(screen.getByText(stage.label)).toBeTruthy();
    }
  });

  it('marks completed, active, and pending stages', () => {
    render(
      <StageBar
        activeStage="hypothesize"
        completedStages={['ingest', 'pattern']}
      />
    );

    expect(screen.getByText('Ingest').closest('[data-stage-state]')).toHaveAttribute(
      'data-stage-state',
      'complete'
    );
    expect(screen.getByText('Pattern').closest('[data-stage-state]')).toHaveAttribute(
      'data-stage-state',
      'complete'
    );
    expect(screen.getByText('Hypothesize').closest('[data-stage-state]')).toHaveAttribute(
      'data-stage-state',
      'active'
    );
    expect(screen.getByText('Collect').closest('[data-stage-state]')).toHaveAttribute(
      'data-stage-state',
      'pending'
    );
  });
});
