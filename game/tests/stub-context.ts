/**
 * A permissive 2D-context stub for headless art/renderer tests: every method is
 * a no-op, gradients/patterns return a stub with addColorStop, image data is a
 * real sized buffer, and property sets are accepted. Use when a test needs a
 * CanvasRenderingContext2D but doesn't assert on specific draw calls.
 */
export function stubContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} };
  const target: Record<string | symbol, unknown> = {
    canvas: { width: 0, height: 0 },
    createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: () => ({ width: 0 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      // Any other accessed member is treated as a callable no-op.
      return (t[prop] = () => {});
    },
    set(t, prop, value) { t[prop] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

/** A canvas whose 2D context is the permissive stub. */
export function stubCanvas(width = 0, height = 0): HTMLCanvasElement {
  const context = stubContext();
  (context as { canvas: unknown }).canvas = { width, height };
  return { width, height, getContext: () => context } as unknown as HTMLCanvasElement;
}
