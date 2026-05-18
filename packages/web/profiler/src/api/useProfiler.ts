import { createContext, useContext } from 'solid-js';
import type { IMetricsBus } from '../core/schema';

export const ProfilerContext = createContext<IMetricsBus | undefined>(undefined);

export function useProfiler(): IMetricsBus {
  const bus = useContext(ProfilerContext);
  if (!bus) {
    throw new Error(
      'useProfiler(): no <ProfilerProvider> in the component tree. ' +
        'Wrap the app with <ProfilerProvider> or use useProfilerSafe() if optional.',
    );
  }
  return bus;
}

export function useProfilerSafe(): IMetricsBus | undefined {
  return useContext(ProfilerContext);
}
