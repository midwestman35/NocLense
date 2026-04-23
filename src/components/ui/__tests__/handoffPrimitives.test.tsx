import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Ambient, Cursor, Icon, LogHistogram, MacWindow, Spark, type IconName } from '../index';

describe('handoff primitives', () => {
  it('renders MacWindow without crashing', () => {
    render(
      <MacWindow title="Case window" right={<span>ready</span>}>
        <div>body</div>
      </MacWindow>,
    );

    expect(screen.getByText('Case window')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('renders Icon and returns null for an unknown name', () => {
    const { container, rerender } = render(<Icon name="search" />);

    expect(container.querySelector('svg')).toBeInTheDocument();

    rerender(<Icon name={'missing' as IconName} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders Cursor without crashing', () => {
    const { container } = render(<Cursor />);

    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('renders Spark without crashing', () => {
    const { container } = render(<Spark data={[1, 3, 2]} />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders LogHistogram without crashing', () => {
    const { container } = render(<LogHistogram bars={4} />);

    expect(container.firstElementChild?.children).toHaveLength(4);
  });

  it('renders Ambient without crashing', () => {
    render(
      <Ambient>
        <span>ambient content</span>
      </Ambient>,
    );

    expect(screen.getByText('ambient content')).toBeInTheDocument();
  });
});
