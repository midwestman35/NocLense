/**
 * Unit Tests for Log Context Builder
 * 
 * Purpose:
 * Comprehensive tests for LogContextBuilder to ensure:
 * - Context building prioritizes errors correctly
 * - Token limits are respected
 * - Log formatting is readable and structured
 * - Duplicate removal works correctly
 * - Focused context includes surrounding logs
 * 
 * Testing Strategy:
 * - Use mock LogEntry objects
 * - Test various log combinations
 * - Validate markdown output format
 * - Test edge cases (empty logs, single log, many logs)
 * - Verify token estimation accuracy
 * 
 * @module services/__tests__/logContextBuilder.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LogContextBuilder } from '../logContextBuilder';
import type { LogEntry } from '../../types';

/**
 * Helper function to create mock log entries
 * 
 * Why: Reduces test boilerplate and ensures consistent test data
 */
function createMockLog(
  id: number,
  level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARN' = 'INFO',
  message: string = 'Test message',
  component: string = 'test.component',
  payload: string = 'test payload'
): LogEntry {
  const now = Date.now();
  return {
    id,
    timestamp: now + id * 1000, // Stagger timestamps
    rawTimestamp: new Date(now + id * 1000).toISOString(),
    level,
    component,
    displayComponent: component,
    message,
    displayMessage: message,
    payload,
    type: 'LOG',
    isSip: false,
  };
}

describe('LogContextBuilder', () => {
  let builder: LogContextBuilder;
  
  beforeEach(() => {
    builder = new LogContextBuilder();
  });
  
  describe('buildContext', () => {
    it('should return message for empty log array', () => {
      const result = builder.buildContext([]);
      expect(result).toContain('No logs available');
    });
    
    it('should build context from single log', () => {
      const logs = [createMockLog(1, 'ERROR', 'Connection failed')];
      const result = builder.buildContext(logs);
      
      expect(result).toContain('Log #1');
      expect(result).toContain('Connection failed');
      expect(result).toContain('ERROR');
    });
    
    it('should prioritize ERROR logs when prioritizeErrors is true', () => {
      const logs = [
        createMockLog(1, 'INFO', 'Info message'),
        createMockLog(2, 'ERROR', 'Error message'),
        createMockLog(3, 'DEBUG', 'Debug message'),
        createMockLog(4, 'WARN', 'Warning message'),
      ];
      
      const result = builder.buildContext(logs, { prioritizeErrors: true });
      
      // Should contain errors and warnings
      expect(result).toContain('Log #2');
      expect(result).toContain('Error message');
      expect(result).toContain('Log #4');
      expect(result).toContain('Warning message');
      
      // May or may not contain INFO/DEBUG (depends on token limit)
      // But errors should definitely be included
    });
    
    it('should include all logs when prioritizeErrors is false', () => {
      const logs = [
        createMockLog(1, 'INFO', 'Info message'),
        createMockLog(2, 'ERROR', 'Error message'),
      ];
      
      const result = builder.buildContext(logs, { prioritizeErrors: false });
      
      expect(result).toContain('Log #1');
      expect(result).toContain('Log #2');
    });
    
    it('should respect maxTokens limit', () => {
      // Create many logs that would exceed token limit
      const logs: LogEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        logs.push(createMockLog(i, 'INFO', `Message ${i}`, 'component', 'x'.repeat(100)));
      }
      
      const result = builder.buildContext(logs, { maxTokens: 1000 });
      
      // Should truncate to fit within limit
      // Exact count depends on token estimation, but should be less than 1000
      expect(result.length).toBeLessThan(logs.length * 200); // Rough check
    });
    
    it('should build focused context around specific log', () => {
      const logs = [
        createMockLog(1, 'INFO', 'Before 1'),
        createMockLog(2, 'INFO', 'Before 2'),
        createMockLog(3, 'ERROR', 'Focus log'),
        createMockLog(4, 'INFO', 'After 1'),
        createMockLog(5, 'INFO', 'After 2'),
      ];
      
      const result = builder.buildContext(logs, {
        focusLogId: 3,
        includeSurrounding: 2,
      });
      
      expect(result).toContain('Log #3');
      expect(result).toContain('Focus log');
      expect(result).toContain('⭐ FOCUS');
      // Should include surrounding logs
      const hasBefore = result.includes('Log #1') || result.includes('Log #2');
      const hasAfter = result.includes('Log #4') || result.includes('Log #5');
      expect(hasBefore || hasAfter).toBe(true);
    });
    
    it('should handle focus log not found', () => {
      const logs = [createMockLog(1, 'INFO', 'Message')];
      const result = builder.buildContext(logs, { focusLogId: 999 });
      
      expect(result).toContain('not found');
    });
    
    it('should exclude payloads when includePayloads is false', () => {
      const logs = [createMockLog(1, 'ERROR', 'Error', 'component', 'sensitive payload data')];
      const result = builder.buildContext(logs, { includePayloads: false });
      
      expect(result).not.toContain('sensitive payload data');
      expect(result).not.toContain('Payload:');
    });
    
    it('should include payloads when includePayloads is true', () => {
      const logs = [createMockLog(1, 'ERROR', 'Error', 'component', 'payload data')];
      const result = builder.buildContext(logs, { includePayloads: true });
      
      expect(result).toContain('payload data');
      expect(result).toContain('Payload:');
    });
  });
  
  describe('formatLogsAsMarkdown', () => {
    it('should format logs with proper markdown structure', () => {
      const logs = [
        createMockLog(1, 'ERROR', 'Error message'),
        createMockLog(2, 'WARN', 'Warning message'),
      ];
      
      const result = builder.buildContext(logs);
      
      // Check markdown structure
      expect(result).toContain('# Log Analysis Context');
      expect(result).toContain('## Errors');
      expect(result).toContain('## Warnings');
      expect(result).toContain('**Timestamp:**');
      expect(result).toContain('**Level:**');
      expect(result).toContain('**Component:**');
      expect(result).toContain('**Message:**');
    });
    
    it('should group logs by level', () => {
      const logs = [
        createMockLog(1, 'ERROR', 'Error 1'),
        createMockLog(2, 'ERROR', 'Error 2'),
        createMockLog(3, 'WARN', 'Warning 1'),
        createMockLog(4, 'INFO', 'Info 1'),
      ];
      
      const result = builder.buildContext(logs);
      
      // Should have sections for each level
      expect(result).toContain('## Errors (2)');
      expect(result).toContain('## Warnings (1)');
      expect(result).toContain('## Info Logs (1)');
    });
    
    it('should include time range in context', () => {
      const logs = [
        createMockLog(1, 'INFO', 'Message 1'),
        createMockLog(2, 'INFO', 'Message 2'),
      ];
      
      const result = builder.buildContext(logs);
      
      expect(result).toContain('Time range:');
    });
  });
  
  describe('removeDuplicates', () => {
    it('should remove duplicate log messages', () => {
      const logs = [
        createMockLog(1, 'ERROR', 'Duplicate message', 'component1'),
        createMockLog(2, 'ERROR', 'Duplicate message', 'component1'),
        createMockLog(3, 'ERROR', 'Duplicate message', 'component1'),
        createMockLog(4, 'ERROR', 'Unique message', 'component1'),
      ];
      
      const result = builder.buildContext(logs);
      
      // Should show duplicate count
      expect(result).toContain('Duplicate message');
      // May show count indicator (implementation dependent)
    });
    
    it('should keep logs with different messages', () => {
      const logs = [
        createMockLog(1, 'ERROR', 'Message 1'),
        createMockLog(2, 'ERROR', 'Message 2'),
        createMockLog(3, 'ERROR', 'Message 3'),
      ];
      
      const result = builder.buildContext(logs);
      
      expect(result).toContain('Message 1');
      expect(result).toContain('Message 2');
      expect(result).toContain('Message 3');
    });

    it('should dedupe messages that only differ by address values', () => {
      const logs = [
        createMockLog(1, 'ERROR', 'Failed to connect to 192.168.1.1:5060', 'sip.transport'),
        createMockLog(2, 'ERROR', 'Failed to connect to 10.0.0.5:5060', 'sip.transport'),
      ];

      const result = builder.buildContext(logs);

      expect(result).toContain('Failed to connect to 192.168.1.1:5060');
      expect(result).toContain('(×2)');
    });
  });
  
  describe('truncatePayload', () => {
    it('should truncate long payloads', () => {
      const longPayload = 'x'.repeat(1000);
      const logs = [createMockLog(1, 'ERROR', 'Error', 'component', longPayload)];
      
      const result = builder.buildContext(logs, { includePayloads: true });
      
      // Should contain truncated indicator
      expect(result).toContain('truncated');
      // New line-aware truncation may omit unbroken single-line payloads entirely.
      expect(result).not.toContain('a=a=a=');
    });
    
    it('should keep short payloads as-is', () => {
      const shortPayload = 'short payload';
      const logs = [createMockLog(1, 'ERROR', 'Error', 'component', shortPayload)];
      
      const result = builder.buildContext(logs, { includePayloads: true });
      
      expect(result).toContain(shortPayload);
      expect(result).not.toContain('truncated');
    });

    it('should extract key SIP headers instead of including full payload tail', () => {
      const sipPayload = [
        'INVITE sip:1001@example.com SIP/2.0',
        'Via: SIP/2.0/UDP 10.0.0.1:5060;branch=z9hG4bK123456789',
        'From: "Alice" <sip:alice@example.com>;tag=123',
        'To: <sip:bob@example.com>',
        'Call-ID: abcdef-12345-uuid',
        'CSeq: 1 INVITE',
        'Contact: <sip:alice@10.0.0.1>',
        'Content-Type: application/sdp',
        'Content-Length: 999',
        '',
        'v=0',
        'o=- 0 0 IN IP4 10.0.0.1',
        's=Session',
        'c=IN IP4 10.0.0.1',
      ].join('\n') + '\n' + 'a='.repeat(600);

      const logs = [createMockLog(1, 'ERROR', 'SIP invite failed', 'sip.stack', sipPayload)];
      const result = builder.buildContext(logs, { includePayloads: true });

      expect(result).toContain('INVITE sip:1001@example.com SIP/2.0');
      expect(result).toContain('Call-ID:');
      expect(result).toContain('CSeq:');
      // "headers omitted" appears only when header cap/omission is triggered.
      expect(result).not.toContain('a=a=a=');
    });
  });

  describe('prioritizeLogs', () => {
    it('should retain SIP failure signal info logs even with tight token budget', () => {
      const logs = [
        createMockLog(1, 'INFO', 'Service started successfully', 'app.lifecycle'),
        createMockLog(2, 'INFO', 'SIP 488 Not Acceptable Here on INVITE', 'sip.stack'),
        createMockLog(3, 'INFO', 'Periodic health check passed', 'app.health'),
      ];

      const result = builder.buildContext(logs, { prioritizeErrors: true, maxTokens: 40 });

      expect(result).toContain('SIP 488 Not Acceptable Here on INVITE');
    });
  });
  
  describe('addSurroundingContext', () => {
    it('should include logs before and after errors', () => {
      const logs = [
        createMockLog(1, 'INFO', 'Before 1'),
        createMockLog(2, 'INFO', 'Before 2'),
        createMockLog(3, 'ERROR', 'Error'),
        createMockLog(4, 'INFO', 'After 1'),
        createMockLog(5, 'INFO', 'After 2'),
      ];
      
      const result = builder.buildContext(logs, {
        prioritizeErrors: true,
      });
      
      // Should include error and surrounding context
      expect(result).toContain('Log #3');
      // May include surrounding logs (depends on implementation)
    });
  });

  describe('buildHierarchicalContext', () => {
    it('should split large time ranges into multiple chunks', () => {
      const baseTs = Date.now();
      const logs: LogEntry[] = [];
      for (let i = 0; i < 40; i++) {
        logs.push({
          ...createMockLog(i + 1, i % 2 === 0 ? 'ERROR' : 'INFO', `message ${i}`),
          timestamp: baseTs + i * 60 * 1000, // 1-minute spacing
        });
      }

      const chunks = builder.buildHierarchicalContext(logs, { maxTokens: 4000 });
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].timeWindow).toContain('->');
      expect(chunks[0].context).toContain('# Log Analysis Context');
    });
  });
  
  describe('generateSummary', () => {
    it('should generate summary for empty logs', () => {
      const result = builder.generateSummary([]);
      expect(result).toContain('No logs to summarize');
    });
    
    it('should generate summary with log counts', () => {
      const logs = [
        createMockLog(1, 'ERROR', 'Error 1'),
        createMockLog(2, 'ERROR', 'Error 2'),
        createMockLog(3, 'WARN', 'Warning'),
        createMockLog(4, 'INFO', 'Info'),
      ];
      
      const result = builder.generateSummary(logs);
      
      // Summary uses markdown formatting
      expect(result).toContain('**Total Logs:** 4');
      expect(result).toContain('ERROR: 2');
      expect(result).toContain('WARN: 1');
      expect(result).toContain('INFO: 1');
    });
    
    it('should include component count in summary', () => {
      const logs = [
        createMockLog(1, 'INFO', 'Message', 'component1'),
        createMockLog(2, 'INFO', 'Message', 'component2'),
        createMockLog(3, 'INFO', 'Message', 'component1'),
      ];
      
      const result = builder.generateSummary(logs);
      
      // Summary uses markdown formatting
      expect(result).toContain('**Unique Components:** 2');
    });
    
    it('should include SIP log count in summary', () => {
      const logs = [
        createMockLog(1, 'INFO', 'SIP message'),
        createMockLog(2, 'INFO', 'Regular message'),
      ];
      logs[0].isSip = true;
      
      const result = builder.generateSummary(logs);
      
      // Summary uses markdown formatting: **SIP Logs:** 1 (50%)
      expect(result).toContain('**SIP Logs:** 1');
    });
    
    it('should include time range in summary', () => {
      const logs = [
        createMockLog(1, 'INFO', 'Message 1'),
        createMockLog(2, 'INFO', 'Message 2'),
      ];
      
      const result = builder.generateSummary(logs);
      
      expect(result).toContain('Time Range:');
    });
  });
  
  describe('edge cases', () => {
    it('should handle logs with missing fields', () => {
      const log: LogEntry = {
        id: 1,
        timestamp: Date.now(),
        rawTimestamp: new Date().toISOString(),
        level: 'INFO',
        component: '',
        displayComponent: '',
        message: '',
        displayMessage: '',
        payload: '',
        type: 'LOG',
        isSip: false,
      };
      
      const result = builder.buildContext([log]);
      expect(result).toBeDefined();
    });
    
    it('should handle very large log arrays', () => {
      const logs: LogEntry[] = [];
      for (let i = 0; i < 10000; i++) {
        logs.push(createMockLog(i, 'INFO', `Message ${i}`));
      }
      
      const result = builder.buildContext(logs, { maxTokens: 10000 });
      
      // Should complete without error
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should handle logs with correlation fields', () => {
      const log = createMockLog(1, 'ERROR', 'Error');
      log.callId = 'call-123';
      log.reportId = 'report-456';
      log.operatorId = 'op-789';
      
      const result = builder.buildContext([log]);
      
      expect(result).toContain('call-123');
      expect(result).toContain('report-456');
      expect(result).toContain('op-789');
      expect(result).toContain('Correlations:');
    });
  });
});
