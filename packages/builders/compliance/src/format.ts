import type { IViolation } from './check';

const ICONS: Record<IViolation['kind'], string> = {
  'disallowed-import': '🚫',
  'upward-import': '⬆️',
  'horizontal-import': '↔️',
  'side-effect-fetch': '🌐',
  'unknown-alias': '🏷️',
};

/** Форматирование одного нарушения для лога/ошибки. */
export const formatViolation = (v: IViolation): string => {
  const head = `${ICONS[v.kind]} [compliance] ${v.kind}`;
  const loc = `${v.file}:${v.line}:${v.column}`;
  const body = v.message;
  const hint = v.hint ? `\n   💡 ${v.hint}` : '';
  return `${head}\n   ${loc}\n   ${body}${hint}`;
};

/** Форматирование пачки нарушений в одно сообщение (для error/warn в Vite). */
export const formatViolations = (violations: IViolation[]): string => {
  if (violations.length === 0) return '';
  const header = `Compliance: найдено нарушений: ${violations.length}`;
  return [header, ...violations.map(formatViolation)].join('\n\n');
};
