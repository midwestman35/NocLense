import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SplashScreen } from '../SplashScreen';

describe('SplashScreen', () => {
  it('renders the standalone splash without auth inputs, SSO, or feed content', () => {
    render(<SplashScreen onContinue={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'NocLense' })).toBeInTheDocument();
    expect(screen.getByText('Standalone')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading noclense/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/continue with sso/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live ops feed/i)).not.toBeInTheDocument();
  });

  it('calls onContinue once when Continue is clicked', () => {
    const onContinue = vi.fn();

    render(<SplashScreen onContinue={onContinue} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
