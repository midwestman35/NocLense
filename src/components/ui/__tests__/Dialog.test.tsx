import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '../Dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(<Dialog open={false} onClose={vi.fn()} title="Test">Body</Dialog>);
    expect(screen.queryByText('Test')).toBeNull();
  });

  it('renders title and body when open', () => {
    render(<Dialog open={true} onClose={vi.fn()} title="My Dialog">Content here</Dialog>);
    expect(screen.getByText('My Dialog')).toBeTruthy();
    expect(screen.getByText('Content here')).toBeTruthy();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<Dialog open={true} onClose={onClose} title="T">B</Dialog>);
    fireEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when content is clicked', () => {
    const onClose = vi.fn();
    render(<Dialog open={true} onClose={onClose} title="T">B</Dialog>);
    fireEvent.click(screen.getByText('B'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders footer when provided', () => {
    render(
      <Dialog open={true} onClose={vi.fn()} title="T" footer={<button>Save</button>}>
        B
      </Dialog>
    );
    expect(screen.getByText('Save')).toBeTruthy();
  });
});
