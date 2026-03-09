import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardContent } from '../Card';

describe('Card', () => {
  it('renders with default variant (border only)', () => {
    render(<Card data-testid="card">Content</Card>);
    const el = screen.getByTestId('card');
    expect(el.className).toContain('border');
    expect(el.className).not.toContain('shadow');
  });

  it('renders with elevated variant (border + shadow)', () => {
    render(<Card variant="elevated" data-testid="card">Content</Card>);
    const el = screen.getByTestId('card');
    expect(el.className).toContain('shadow');
  });

  it('renders CardHeader and CardContent', () => {
    render(
      <Card>
        <CardHeader>Title</CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    );
    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('merges custom className', () => {
    render(<Card className="mt-8" data-testid="card">X</Card>);
    expect(screen.getByTestId('card').className).toContain('mt-8');
  });
});
