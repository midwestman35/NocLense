import { type ReactNode, type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MotionConfig } from 'motion/react';
import App from '../App';

type ProviderProps = { children: ReactNode };
type MotionConfigProps = ComponentProps<(typeof import('motion/react'))['MotionConfig']>;

vi.mock('../contexts/LogContext', () => ({
  LogProvider: ({ children }: ProviderProps) => <>{children}</>,
}));

vi.mock('../contexts/AIContext', () => ({
  AIProvider: ({ children }: ProviderProps) => <>{children}</>,
}));

vi.mock('../contexts/EvidenceContext', () => ({
  EvidenceProvider: ({ children }: ProviderProps) => <>{children}</>,
}));

vi.mock('../store/caseContext', () => ({
  CaseProvider: ({ children }: ProviderProps) => <>{children}</>,
}));

vi.mock('../components/ui', () => ({
  ToastProvider: ({ children }: ProviderProps) => <>{children}</>,
}));

vi.mock('../components/workspace/NewWorkspaceLayout', () => ({
  NewWorkspaceLayout: () => <div data-testid="workspace-layout" />,
}));

vi.mock('../utils/theme', () => ({
  initTheme: vi.fn(),
}));

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();

  return {
    ...actual,
    MotionConfig: vi.fn(({ reducedMotion, children }: MotionConfigProps) => (
      <div data-testid="motion-config" data-reduced-motion={reducedMotion}>
        {children}
      </div>
    )),
  };
});

describe('App MotionConfig wiring', () => {
  it('wraps the app tree in MotionConfig with reducedMotion=user', () => {
    render(<App />);

    const motionConfigs = screen.getAllByTestId('motion-config');
    const motionConfigMock = vi.mocked(MotionConfig);

    expect(motionConfigs).toHaveLength(1);
    expect(motionConfigs[0]).toHaveAttribute('data-reduced-motion', 'user');
    expect(motionConfigMock).toHaveBeenCalled();
    expect(motionConfigMock.mock.calls.every(([props]) => props.reducedMotion === 'user')).toBe(true);
  });
});
