import type { ForwardRefExoticComponent, HTMLAttributes, ReactNode, RefAttributes } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from '../../../../hooks/usePrefersReducedMotion';
import { asBlockId, asCitationId, asInvestigationId } from '../../../../types/canonical';
import CanonicalBlockRenderer from '../CanonicalBlockRenderer';
import { makeInvestigation } from './canonicalBlockTestUtils';
vi.mock('../../../../hooks/usePrefersReducedMotion', () => ({
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
const getSections = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll('section[data-block-kind]'));
const readMotion = (section: HTMLElement): { initial: unknown; transition: { delay?: number; duration?: number } } => ({
  initial: JSON.parse(section.getAttribute('data-motion-initial') ?? 'null'),
  transition: JSON.parse(section.getAttribute('data-motion-transition') ?? 'null'),
});

describe('CanonicalBlockRenderer', () => {
  beforeEach(() => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(false);
  });

  it('renders concrete collection and action blocks while prior-art and note stay on the placeholder path', () => {
    const investigation = makeInvestigation({ logSuggestions: [{ source: 'Datadog', reason: 'Pull the last hour of PBX events.', query: 'service:pbx' }] });
    const firstCitationId = Object.keys(investigation.citations)[0];

    investigation.blocks.push(
      {
        id: asBlockId('id-900'),
        kind: 'prior-art',
        createdAt: investigation.createdAt,
        updatedAt: investigation.updatedAt,
        citations: [],
        body: {
          source: 'jira',
          title: 'REP-18421',
          summary: 'Similar registration fault.',
          sourceCitationId: asCitationId(firstCitationId),
        },
      },
      {
        id: asBlockId('id-901'),
        kind: 'note',
        createdAt: investigation.createdAt,
        updatedAt: investigation.updatedAt,
        citations: [],
        body: {
          markdown: 'Engineer note',
          authorRole: 'engineer',
        },
      },
    );

    render(<CanonicalBlockRenderer investigation={investigation} />);

    expect(screen.getByText('Acme PSAP')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'PBX registration failure' })).toBeTruthy();
    expect(screen.getByText('Analysis: PBX registration failure')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Collection Guidance' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Action' })).toBeTruthy();
    expect(screen.getByText('Block: prior-art (renderer pending)')).toBeTruthy();
    expect(screen.getByText('Block: note (renderer pending)')).toBeTruthy();
  });

  it('wraps each block in a stable section envelope', () => {
    const investigation = makeInvestigation({ logSuggestions: [{ source: 'Datadog', reason: 'Pull the last hour of PBX events.', query: 'service:pbx' }] });

    render(<CanonicalBlockRenderer investigation={investigation} />);

    const collectionSection = screen.getByRole('heading', { name: 'Collection Guidance' }).closest('section');

    expect(collectionSection).toHaveAttribute('data-block-kind', 'collection');
    expect(collectionSection).toHaveAttribute('data-block-id');
  });

  it('renders instantly for reduced-motion users', () => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);
    const { container } = render(<CanonicalBlockRenderer investigation={makeInvestigation()} />);
    const firstSection = getSections(container)[0];

    expect(readMotion(firstSection).initial).toBe(false);
    expect(readMotion(firstSection).transition.duration).toBe(0);
  });

  it('applies 40ms stagger delays through the twelfth block and skips delay after that', () => {
    const investigation = makeInvestigation({ logSuggestions: [{ source: 'Datadog', reason: 'Pull the last hour of PBX events.', query: 'service:pbx' }] });

    for (let index = 0; index < 8; index += 1) {
      investigation.blocks.push({
        id: asBlockId(`note-${index}`),
        kind: 'note',
        createdAt: investigation.createdAt,
        updatedAt: investigation.updatedAt,
        citations: [],
        body: { markdown: `note ${index}`, authorRole: 'engineer' },
      });
    }

    const { container } = render(<CanonicalBlockRenderer investigation={investigation} />);
    const sections = getSections(container);

    expect(readMotion(sections[0]).transition.delay).toBe(0);
    expect(readMotion(sections[1]).transition.delay).toBe(0.04);
    expect(readMotion(sections[4]).transition.delay).toBe(0.16);
    expect(readMotion(sections[12]).initial).toBe(false);
    expect(readMotion(sections[12]).transition.duration).toBe(0);
  });

  it('fast-forwards the reveal when Escape is pressed inside the renderer', () => {
    const { container } = render(<CanonicalBlockRenderer investigation={makeInvestigation()} />);
    const root = container.firstElementChild as HTMLElement;

    root.focus();
    fireEvent.keyDown(root, { key: 'Escape' });

    expect(readMotion(getSections(container)[1]).initial).toBe(false);
    expect(readMotion(getSections(container)[1]).transition.duration).toBe(0);
  });

  it('restarts staggered reveal when the investigation id changes', () => {
    const { container, rerender } = render(<CanonicalBlockRenderer investigation={makeInvestigation()} />);
    const root = container.firstElementChild as HTMLElement;
    root.focus();
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(readMotion(getSections(container)[1]).transition.duration).toBe(0);
    const nextInvestigation = { ...makeInvestigation(), id: asInvestigationId('investigation-2') };
    rerender(<CanonicalBlockRenderer investigation={nextInvestigation} />);
    expect(readMotion(getSections(container)[1]).initial).toEqual({ opacity: 0, y: 4 });
    expect(readMotion(getSections(container)[1]).transition.delay).toBe(0.04);
  });
});
