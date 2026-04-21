import type { ForwardRefExoticComponent, HTMLAttributes, ReactNode, RefAttributes } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from '../../../../../hooks/usePrefersReducedMotion';
import { asBlockId } from '../../../../../types/canonical';
import CanonicalBlockRenderer from '../../CanonicalBlockRenderer';
import {
  buildNoteBlock,
  buildPriorArtBlock,
  makeInvestigation,
} from '../../__tests__/canonicalBlockTestUtils';

vi.mock('../../../../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: vi.fn(),
}));

vi.mock('motion/react', async () => {
  const React = await import('react');
  type MotionProps = HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement> & {
    initial?: unknown; animate?: unknown; exit?: unknown; transition?: unknown;
  };
  const cache = new Map<string, ForwardRefExoticComponent<MotionProps>>();

  function createMotionComponent(tag: string) {
    const existing = cache.get(tag);
    if (existing) return existing;
    const Component = React.forwardRef<HTMLElement, MotionProps>(function MotionComponent({ initial, animate, exit, transition, children, ...props }, ref) {
      return React.createElement(tag, {
        ...props,
        ref,
        'data-motion-initial': JSON.stringify(initial ?? null),
        'data-motion-animate': JSON.stringify(animate ?? null),
        'data-motion-exit': JSON.stringify(exit ?? null),
        'data-motion-transition': JSON.stringify(transition ?? null),
      }, children);
    });
    cache.set(tag, Component);
    return Component;
  }

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: (_target, tag: string) => createMotionComponent(tag) }),
  };
});

const readMotion = (element: Element | null) => ({
  initial: JSON.parse(element?.getAttribute('data-motion-initial') ?? 'null'),
  animate: JSON.parse(element?.getAttribute('data-motion-animate') ?? 'null'),
  transition: JSON.parse(element?.getAttribute('data-motion-transition') ?? 'null'),
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('PriorArt and Note integration', () => {
  beforeEach(() => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(false);
  });

  it.each([
    ['present', 'Rendered summary', true],
    ['empty', '', false],
    ['undefined', undefined, false],
  ] as const)('handles prior-art summary when %s', (_label, summary, shouldRender) => {
    const investigation = makeInvestigation();
    const priorArt = buildPriorArtBlock({ body: { title: 'Prior art summary case', summary } });
    Object.assign(investigation.citations, priorArt.citations);
    investigation.blocks.push(priorArt.block);

    render(<CanonicalBlockRenderer investigation={investigation} />);

    if (shouldRender) {
      expect(screen.getByText('Rendered summary')).toBeTruthy();
    } else {
      expect(screen.queryByText('Rendered summary')).toBeNull();
    }
  });

  it.each([
    ['log', { kind: 'log', fileName: 'pbx.log', lineNumber: 42, byteOffset: 1024 }, 'log citation display'],
    ['datadog', { kind: 'datadog', startMs: 1, endMs: 2, query: 'service:pbx' }, 'service:pbx'],
    ['jira', { kind: 'jira', key: 'REP-99' }, 'REP-99'],
    ['zendesk', { kind: 'zendesk', ticketId: '45892' }, 'ZD-45892'],
    ['slack', { kind: 'slack', workspace: 'carbyne', channelId: 'C1', messageTs: '1.0' }, 'slack-thread'],
    ['confluence', { kind: 'confluence', spaceKey: 'SUP', pageId: '101' }, 'Confluence 101'],
    ['pcap', { kind: 'pcap', fileName: 'trace.pcap', packetIndex: 7 }, 'trace.pcap#7'],
    ['pdf', { kind: 'pdf', fileName: 'report.pdf', page: 3 }, 'report.pdf p3'],
    ['local-folder', { kind: 'local-folder', path: 'DailyNOC/2026-04-20', fileName: 'rep-18421.txt' }, 'rep-18421.txt'],
  ] as const)('renders prior-art citation displayText for %s citations', (_kind, source, displayText) => {
    const investigation = makeInvestigation();
    const priorArt = buildPriorArtBlock({
      body: { title: `Prior art ${displayText}` },
      citation: { source, displayText },
    });
    Object.assign(investigation.citations, priorArt.citations);
    investigation.blocks.push(priorArt.block);

    render(<CanonicalBlockRenderer investigation={investigation} />);

    expect(screen.getByRole('button', { name: new RegExp(escapeRegex(displayText)) })).toBeTruthy();
  });

  it('fires prior-art citation clicks exactly once per click', () => {
    const onCitationClick = vi.fn();
    const investigation = makeInvestigation();
    const priorArt = buildPriorArtBlock();
    Object.assign(investigation.citations, priorArt.citations);
    investigation.blocks.push(priorArt.block);

    render(<CanonicalBlockRenderer investigation={investigation} onCitationClick={onCitationClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'REP-18421' }));

    expect(onCitationClick).toHaveBeenCalledTimes(1);
    expect(onCitationClick).toHaveBeenCalledWith(priorArt.block.body.sourceCitationId);
  });

  it('renders HTML-like note content literally', () => {
    const investigation = makeInvestigation();
    const note = buildNoteBlock({
      body: { markdown: '<script>alert(1)</script>\n<img src=x onerror=alert(1) />' },
    });
    investigation.blocks.push(note.block);
    const { container } = render(<CanonicalBlockRenderer investigation={investigation} />);

    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders long and whitespace-only notes without dropping the card shell', () => {
    const investigation = makeInvestigation();
    const longNote = buildNoteBlock({ body: { markdown: 'x'.repeat(10_240), authorRole: 'ai' } });
    const blankNote = buildNoteBlock({ body: { markdown: '   \n\t', authorRole: 'engineer' } });
    investigation.blocks.push(longNote.block, blankNote.block);

    const { container } = render(<CanonicalBlockRenderer investigation={investigation} />);

    expect(screen.getAllByRole('heading', { name: 'Note' })).toHaveLength(2);
    expect(screen.getByText('x'.repeat(10_240))).toBeTruthy();
    expect(
      container.querySelector('[data-author-role="engineer"] .whitespace-pre-wrap')?.textContent,
    ).toBe('   \n\t');
  });

  it('preserves block order for multiple prior-art rows followed by note rows', () => {
    const investigation = makeInvestigation({ logSuggestions: [] });
    const priorArtA = buildPriorArtBlock({ body: { title: 'Prior art A', source: 'jira' } });
    const priorArtB = buildPriorArtBlock({ body: { title: 'Prior art B', source: 'zendesk' } });
    const priorArtC = buildPriorArtBlock({ body: { title: 'Prior art C', source: 'slack' } });
    const noteA = buildNoteBlock({ id: asBlockId('note-a'), body: { markdown: 'Note A', authorRole: 'ai' } });
    const noteB = buildNoteBlock({ id: asBlockId('note-b'), body: { markdown: 'Note B', authorRole: 'engineer' } });
    Object.assign(
      investigation.citations,
      priorArtA.citations,
      priorArtB.citations,
      priorArtC.citations,
      noteA.citations,
      noteB.citations,
    );
    investigation.blocks.push(
      priorArtA.block,
      priorArtB.block,
      priorArtC.block,
      noteA.block,
      noteB.block,
    );

    const { container } = render(<CanonicalBlockRenderer investigation={investigation} />);
    const kinds = Array.from(container.querySelectorAll('section[data-block-kind]')).map((section) =>
      section.getAttribute('data-block-kind'),
    );

    expect(kinds.slice(-5)).toEqual(['prior-art', 'prior-art', 'prior-art', 'note', 'note']);
    expect(screen.getByRole('heading', { name: 'Prior art A' })).toBeTruthy();
    expect(screen.getByText('Note B')).toBeTruthy();
  });

  it('keeps prior-art and note blocks instant under reduced motion and adds no nested motion props', () => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);
    const investigation = makeInvestigation();
    const priorArt = buildPriorArtBlock();
    const note = buildNoteBlock();
    Object.assign(investigation.citations, priorArt.citations, note.citations);
    investigation.blocks.push(priorArt.block, note.block);

    const { container } = render(<CanonicalBlockRenderer investigation={investigation} />);
    const priorArtSection = container.querySelector(`section[data-block-id="${priorArt.block.id}"]`);
    const noteSection = container.querySelector(`section[data-block-id="${note.block.id}"]`);

    expect(readMotion(priorArtSection).initial).toBe(false);
    expect(readMotion(priorArtSection).animate).toEqual({ opacity: 1, y: 0 });
    expect(readMotion(priorArtSection).transition.duration).toBe(0);
    expect(readMotion(noteSection).initial).toBe(false);
    expect(readMotion(noteSection).transition.duration).toBe(0);
    expect(priorArtSection?.querySelector('[data-motion-initial]')).toBeNull();
    expect(noteSection?.querySelector('[data-motion-initial]')).toBeNull();
  });
});
