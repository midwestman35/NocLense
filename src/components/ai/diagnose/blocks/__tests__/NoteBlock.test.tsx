import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NoteBlock from '../NoteBlock';
import { buildNoteBlock } from '../../__tests__/canonicalBlockTestUtils';

describe('NoteBlock', () => {
  it.each([
    ['ai', 'AI'],
    ['engineer', 'ENGINEER'],
  ] as const)('renders the %s author badge', (authorRole, label) => {
    const built = buildNoteBlock({ body: { authorRole } });

    render(<NoteBlock block={built.block} />);

    expect(screen.getByText(label).closest('[data-author-role]')).toHaveAttribute(
      'data-author-role',
      authorRole,
    );
  });

  it('preserves whitespace formatting for note content', () => {
    const built = buildNoteBlock({ body: { markdown: 'line 1\n\n  line 3' } });
    const { container } = render(<NoteBlock block={built.block} />);

    const content = container.querySelector('[data-author-role] .whitespace-pre-wrap');
    expect(content).toHaveClass('whitespace-pre-wrap');
    expect(content).toHaveClass('break-words');
    expect(content?.textContent).toBe('line 1\n\n  line 3');
  });

  it('renders HTML-like content as literal text', () => {
    const built = buildNoteBlock({
      body: { markdown: '<script>alert(1)</script>\n<img src=x onerror=alert(1) />' },
    });
    const { container } = render(<NoteBlock block={built.block} />);

    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses the canonical heading id contract', () => {
    const built = buildNoteBlock();

    render(<NoteBlock block={built.block} />);

    expect(screen.getByRole('heading', { name: 'Note' })).toHaveAttribute(
      'id',
      `canonical-block-${built.block.id}`,
    );
  });
});
