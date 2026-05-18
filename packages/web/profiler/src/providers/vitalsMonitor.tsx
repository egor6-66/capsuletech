import { createContext, createMemo, type JSX, useContext } from 'solid-js';
import { useProfiler } from '../api/useProfiler';
import type { IMetricId, IMetricsBus } from '../core/schema';
import { ProfilerProvider } from './profiler';

/**
 * @deprecated Use `useProfiler()` from `@capsuletech/web-profiler/api`. Kept as
 * a thin shim over the new `ProfilerProvider` so existing consumers (and
 * `BaseProviders.vitals`) keep working without changes. Will be removed in 0.2.x.
 */
export interface IMonitoringContextType {
  updateComponentMetric: (name: string, value: number | string) => void;
  /** @internal */
  bus: IMetricsBus;
}

export const VitalsMonitoringContext = createContext<IMonitoringContextType | undefined>(undefined);

export interface VitalsMonitoringProviderProps {
  children: JSX.Element;
  showDashboard?: boolean;
}

interface ILegacyBridgeProps {
  children: JSX.Element;
}

function LegacyVitalsBridge(props: ILegacyBridgeProps) {
  const bus = useProfiler();

  const updateComponentMetric = (name: string, value: number | string) => {
    bus.write(`custom.${name}` as IMetricId, value, { label: name });
  };

  const contextValue = createMemo<IMonitoringContextType>(() => ({
    updateComponentMetric,
    bus,
  }));

  return (
    <VitalsMonitoringContext.Provider value={contextValue()}>
      {props.children}
    </VitalsMonitoringContext.Provider>
  );
}

export function VitalsMonitoringProvider(props: VitalsMonitoringProviderProps) {
  const showDashboard = props.showDashboard !== false;
  return (
    <ProfilerProvider collectors="legacy" showDashboard={showDashboard}>
      <LegacyVitalsBridge>{props.children}</LegacyVitalsBridge>
    </ProfilerProvider>
  );
}

export function useVitalsContext(): IMonitoringContextType | undefined {
  return useContext(VitalsMonitoringContext);
}
