import { describe, expect, it } from 'vitest';
import { buildJiraTemplate } from '../jiraTemplateBuilder';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asInvestigationId,
  type Investigation,
} from '../../types/canonical';

const base: Investigation = {
  schemaVersion: INVESTIGATION_SCHEMA_VERSION,
  id: asInvestigationId('inv-1'),
  createdAt: 1000,
  updatedAt: 1000,
  blocks: [],
  citations: {},
};

describe('buildJiraTemplate', () => {
  it('returns a formatted string', () => {
    const { formatted } = buildJiraTemplate(base);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('uses action block summary when action kind is jira', () => {
    const inv: Investigation = {
      ...base,
      blocks: [
        {
          id: asBlockId('a1'),
          kind: 'action',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            summary: 'Escalate to R&D',
            payload: {
              kind: 'jira',
              projectKey: 'REP',
              summary: 'Registration storm — APEX 9.2',
              description: 'Full investigation in attached file.',
              priority: 'High',
            },
          },
        },
      ],
    };
    const { summary, priority } = buildJiraTemplate(inv);
    expect(summary).toBe('Registration storm — APEX 9.2');
    expect(priority).toBe('High');
  });

  it('includes noclense-export label always', () => {
    const { labels } = buildJiraTemplate(base);
    expect(labels).toContain('noclense-export');
  });

  it('adds site label when context block has site', () => {
    const inv: Investigation = {
      ...base,
      blocks: [
        {
          id: asBlockId('ctx'),
          kind: 'context',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: { customer: 'Carbyne', site: 'MACC-01' },
        },
      ],
    };
    const { labels } = buildJiraTemplate(inv);
    expect(labels).toContain('site:MACC-01');
  });
});
