/**
 * Парсит CSS-подобную строку с единицей измерения. `'100px'` → `{value: 100, unit: 'px'}`,
 * `'auto'` → `{value: null, unit: 'auto'}`.
 *
 * Если строка пустая/невалидная — возвращается `fallbackUnit` и `value: null`.
 * `auto` обрабатывается как «keyword» — не число, юнит сам по себе.
 */
export interface IParsedUnit {
  value: number | null;
  unit: string;
}

const NUMBER_UNIT_RE = /^\s*(-?\d+\.?\d*)\s*(.*)$/;

export const parseUnit = (raw: unknown, fallbackUnit: string): IParsedUnit => {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, unit: fallbackUnit };
  }
  const s = String(raw).trim();
  if (s === 'auto') return { value: null, unit: 'auto' };
  const m = s.match(NUMBER_UNIT_RE);
  if (!m) return { value: null, unit: fallbackUnit };
  return { value: Number.parseFloat(m[1]), unit: m[2] || fallbackUnit };
};

export const formatUnit = (value: number | null, unit: string): string => {
  if (unit === 'auto') return 'auto';
  if (value === null || Number.isNaN(value)) return '';
  return `${value}${unit}`;
};
