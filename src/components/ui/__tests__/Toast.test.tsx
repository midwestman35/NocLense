import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ToastProvider, useToast } from '../Toast';

const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

function ToastTrigger() {
  const { toast } = useToast();

  return (
    <button onClick={() => toast('Saved successfully')}>
      Show toast
    </button>
  );
}

describe('Toast', () => {
  it('renders the entrance class and uses the emphasized easing contract', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));

    const toastRoot = screen.getByRole('alert');

    expect(toastRoot).toHaveClass('animate-toast-in');
    expect(indexCss).toMatch(/\.animate-toast-in\s*\{[^}]*animation:\s*[^;]*var\(--ease-emphasized\)[^;]*;/s);
  });
});
