import { describe, expect, it } from 'vitest';

import { detectWebGL2Availability, resolveGraphRendererSelection } from '../graphRuntime';

describe('graphRuntime', () => {
  it('detects WebGL2 support from a throwaway canvas', () => {
    expect(
      detectWebGL2Availability(() => ({
        getContext: () => ({} as WebGL2RenderingContext),
      })),
    ).toBe(true);

    expect(
      detectWebGL2Availability(() => ({
        getContext: () => null,
      })),
    ).toBe(false);
  });

  it('chooses the WebGL renderer only when support exists above the threshold', () => {
    expect(resolveGraphRendererSelection(250, true).kind).toBe('webgl');
    expect(resolveGraphRendererSelection(250, true).renderer).toBeDefined();
    expect(resolveGraphRendererSelection(199, true).kind).toBe('canvas');
    expect(resolveGraphRendererSelection(500, false).kind).toBe('canvas');
  });
});
