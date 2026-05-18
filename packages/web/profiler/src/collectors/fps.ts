import { isBrowser } from '../core/env';
import type { ICollector, IMetricsBus } from '../core/schema';

export interface IFpsOpts {
  intervalMs?: number;
}

export function fpsCollector(opts: IFpsOpts = {}): ICollector {
  const intervalMs = opts.intervalMs ?? 1000;

  return {
    name: 'fps',
    init(bus: IMetricsBus) {
      if (!isBrowser || typeof requestAnimationFrame === 'undefined') return () => undefined;

      let frames = 0;
      let rafId = 0;
      let disposed = false;

      const tick = () => {
        if (disposed) return;
        frames++;
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      const intervalId = setInterval(() => {
        const fps = Math.round((frames / intervalMs) * 1000);
        bus.write('fps', fps);
        frames = 0;
      }, intervalMs);

      return () => {
        disposed = true;
        if (rafId) cancelAnimationFrame(rafId);
        clearInterval(intervalId);
      };
    },
  };
}
