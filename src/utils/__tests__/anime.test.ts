import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsePrefersReducedMotion = vi.fn(() => false);
const mockAnimeModuleLoad = vi.fn();
const mockAnimate = vi.fn();
const mockStagger = vi.fn((step: number, options?: { start?: number }) => ({ step, options }));
const mockTimeline = {
  add: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  restart: vi.fn(),
  seek: vi.fn(),
};
const mockCreateTimeline = vi.fn(() => mockTimeline);

mockTimeline.add.mockImplementation(() => mockTimeline);

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => mockUsePrefersReducedMotion(),
}));

vi.mock('animejs', () => {
  mockAnimeModuleLoad();
  return {
    animate: mockAnimate,
    stagger: mockStagger,
    createTimeline: mockCreateTimeline,
  };
});

function makeAnimation() {
  return { pause: vi.fn() };
}

async function importAnimeHooks() {
  vi.resetModules();
  return import('../anime');
}

describe('anime utility hooks', () => {
  beforeEach(() => {
    mockUsePrefersReducedMotion.mockReset();
    mockUsePrefersReducedMotion.mockReturnValue(false);

    mockAnimeModuleLoad.mockReset();

    mockAnimate.mockReset();
    mockAnimate.mockImplementation(() => makeAnimation());

    mockStagger.mockClear();

    mockTimeline.add.mockClear();
    mockTimeline.add.mockImplementation(() => mockTimeline);
    mockTimeline.play.mockClear();
    mockTimeline.pause.mockClear();
    mockTimeline.restart.mockClear();
    mockTimeline.seek.mockClear();

    mockCreateTimeline.mockClear();
    mockCreateTimeline.mockImplementation(() => mockTimeline);
  });

  it('snaps stagger targets to their final state under reduced motion', async () => {
    mockUsePrefersReducedMotion.mockReturnValue(true);
    const { useAnimeStagger } = await importAnimeHooks();

    const container = document.createElement('div');
    const first = document.createElement('span');
    const second = document.createElement('span');
    first.className = 'item';
    second.className = 'item';
    container.append(first, second);

    renderHook(() =>
      useAnimeStagger(
        { current: container },
        '.item',
        [2],
        { translateY: [12, 0], opacity: [0, 1], scale: [0.8, 1] },
      ),
    );

    expect(first.style.opacity).toBe('1');
    expect(second.style.opacity).toBe('1');
    expect(first.style.transform).toBe('translateY(0px) scale(1)');
    expect(second.style.transform).toBe('translateY(0px) scale(1)');
    expect(mockAnimeModuleLoad).not.toHaveBeenCalled();
    expect(mockAnimate).not.toHaveBeenCalled();
    expect(mockStagger).not.toHaveBeenCalled();
  });

  it('animates stagger targets when reduced motion is off', async () => {
    const { useAnimeStagger } = await importAnimeHooks();

    const container = document.createElement('div');
    const first = document.createElement('span');
    const second = document.createElement('span');
    first.className = 'item';
    second.className = 'item';
    container.append(first, second);

    renderHook(() =>
      useAnimeStagger(
        { current: container },
        '.item',
        [2],
        {
          translateY: [12, 0],
          opacity: [0.2, 1],
          scale: [0.8, 1],
          delay: 20,
          stagger: 60,
          duration: 450,
          easing: 'linear',
        },
      ),
    );

    await waitFor(() => expect(mockAnimate).toHaveBeenCalledTimes(1));

    const [targets, props] = mockAnimate.mock.calls[0] as [NodeListOf<Element>, Record<string, unknown>];
    expect(Array.from(targets)).toEqual(Array.from(container.querySelectorAll('.item')));
    expect(first.style.opacity).toBe('0.2');
    expect(second.style.opacity).toBe('0.2');
    expect(mockStagger).toHaveBeenCalledWith(60, { start: 20 });
    expect(props).toMatchObject({
      translateY: [12, 0],
      opacity: [0.2, 1],
      scale: [0.8, 1],
      duration: 450,
      ease: 'linear',
      delay: { step: 60, options: { start: 20 } },
    });
  });

  it('returns the target value immediately under reduced motion', async () => {
    mockUsePrefersReducedMotion.mockReturnValue(true);
    const { useAnimeValue } = await importAnimeHooks();

    const { result } = renderHook(() => useAnimeValue(5, 100, { duration: 400 }));

    expect(result.current).toBe(100);
    expect(mockAnimeModuleLoad).not.toHaveBeenCalled();
    expect(mockAnimate).not.toHaveBeenCalled();
  });

  it('animates values when reduced motion is off', async () => {
    mockAnimate.mockImplementation((target, config) => {
      const animatedTarget = target as { val: number };
      const animationConfig = config as { onUpdate?: () => void };
      animatedTarget.val = 42.4;
      animationConfig.onUpdate?.();
      return makeAnimation();
    });

    const { useAnimeValue } = await importAnimeHooks();
    const { result } = renderHook(() =>
      useAnimeValue(5, 100, { duration: 400, easing: 'linear', delay: 25 }),
    );

    await waitFor(() => expect(mockAnimate).toHaveBeenCalledTimes(1));

    const [target, props] = mockAnimate.mock.calls[0] as [{ val: number }, Record<string, unknown>];
    expect(target.val).toBe(42.4);
    expect(props).toMatchObject({
      val: 100,
      duration: 400,
      ease: 'linear',
      delay: 25,
    });
    expect(result.current).toBe(42);
  });

  it('returns a no-op timeline controller under reduced motion', async () => {
    mockUsePrefersReducedMotion.mockReturnValue(true);
    const { useAnimeTimeline } = await importAnimeHooks();

    const steps = [{ targets: '.item', properties: { opacity: [0, 1] }, offset: 0 }];
    const { result } = renderHook(() => useAnimeTimeline(steps, [steps.length]));

    expect(mockAnimeModuleLoad).not.toHaveBeenCalled();
    expect(mockCreateTimeline).not.toHaveBeenCalled();
    expect(result.current.timeline).toBeNull();
    expect(() => {
      result.current.play();
      result.current.pause();
      result.current.restart();
      result.current.seek(120);
    }).not.toThrow();
  });

  it('builds and controls a timeline when reduced motion is off', async () => {
    const { useAnimeTimeline } = await importAnimeHooks();

    const steps = [
      { targets: '.item', properties: { opacity: [0, 1] }, offset: 0 },
      { targets: '.item', properties: { translateY: [8, 0] }, offset: '+=100' },
    ];
    const { result } = renderHook(() => useAnimeTimeline(steps, [steps.length]));

    await waitFor(() => expect(mockCreateTimeline).toHaveBeenCalledTimes(1));

    expect(mockCreateTimeline).toHaveBeenCalledWith({
      autoplay: false,
      defaults: { ease: 'easeOutCubic' },
    });
    expect(mockTimeline.add).toHaveBeenNthCalledWith(1, '.item', { opacity: [0, 1] }, 0);
    expect(mockTimeline.add).toHaveBeenNthCalledWith(2, '.item', { translateY: [8, 0] }, '+=100');

    result.current.play();
    result.current.pause();
    result.current.restart();
    result.current.seek(240);

    expect(mockTimeline.play).toHaveBeenCalledTimes(1);
    expect(mockTimeline.pause).toHaveBeenCalledTimes(1);
    expect(mockTimeline.restart).toHaveBeenCalledTimes(1);
    expect(mockTimeline.seek).toHaveBeenCalledWith(240);
  });
});
