export const isBrowser =
  typeof window !== 'undefined' && typeof performance !== 'undefined';

export function hasPO(): boolean {
  return isBrowser && typeof PerformanceObserver !== 'undefined';
}

export function supportsEntryType(type: string): boolean {
  if (!hasPO()) return false;
  const supported = PerformanceObserver.supportedEntryTypes as readonly string[] | undefined;
  return Array.isArray(supported) ? supported.includes(type) : true;
}
