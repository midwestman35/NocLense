import type { GraphOptions } from '@antv/g6';
import { Renderer as CanvasRenderer } from '@antv/g-canvas';
import { Renderer as WebGLRenderer } from '@antv/g-webgl';

import { WEBGL_RENDERER_THRESHOLD } from './types';

export type GraphRendererKind = 'canvas' | 'webgl';
export const ZOOM_STEP = 1.25;

export interface GraphRendererSelection {
  kind: GraphRendererKind;
  renderer?: GraphOptions['renderer'];
}

const CANVAS_RENDERER: NonNullable<GraphOptions['renderer']> = () => new CanvasRenderer();
const WEBGL_RENDERER: NonNullable<GraphOptions['renderer']> = () => new WebGLRenderer({
  targets: ['webgl2'],
});

export function detectWebGL2Availability(
  createCanvas: () => Pick<HTMLCanvasElement, 'getContext'> = () => document.createElement('canvas'),
): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = createCanvas();
    const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    return Boolean(context);
  } catch {
    return false;
  }
}

export function resolveGraphRendererSelection(
  renderedNodeCount: number,
  isWebGL2Available: boolean,
): GraphRendererSelection {
  if (isWebGL2Available && renderedNodeCount > WEBGL_RENDERER_THRESHOLD) {
    return {
      kind: 'webgl',
      renderer: WEBGL_RENDERER,
    };
  }

  return {
    kind: 'canvas',
    renderer: CANVAS_RENDERER,
  };
}
