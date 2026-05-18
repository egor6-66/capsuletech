import { isBrowser } from '../core/env';
import type { ICollector, IMetricsBus } from '../core/schema';

export function errorsCollector(): ICollector {
  return {
    name: 'errors',
    init(bus: IMetricsBus) {
      if (!isBrowser) return () => undefined;

      let jsCount = 0;
      let promiseCount = 0;

      const onError = () => {
        jsCount++;
        bus.write('error.js', jsCount);
      };
      const onRejection = () => {
        promiseCount++;
        bus.write('error.promise', promiseCount);
      };

      window.addEventListener('error', onError);
      window.addEventListener('unhandledrejection', onRejection);

      return () => {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
      };
    },
  };
}
