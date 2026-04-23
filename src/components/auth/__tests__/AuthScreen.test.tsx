import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthScreen } from '../AuthScreen';

describe('AuthScreen', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the feed and auth card', () => {
    render(<AuthScreen onSuccess={vi.fn()} />);

    expect(screen.getByText(/live ops feed/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('operator@carbyne.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/use your org password/i)).toBeInTheDocument();
  });

  it('resolves auth success after 500ms when sso is clicked', async () => {
    vi.useFakeTimers();
    const onSuccess = vi.fn();

    render(<AuthScreen onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: /continue with sso/i }));

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
