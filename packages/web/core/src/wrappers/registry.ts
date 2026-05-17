/**
 * Slot-резолвер: единая точка доступа к глобальным реестрам слотов
 * (Widgets/Entities/Controllers/Features/Shapes). Раньше каждый wrapper
 * (entity/widget/page) переопределял свой `getXxx` локально — 5 копий одной
 * и той же функции. См. A-3 в architecture findings.
 *
 * **Почему через globalThis.** До npm-публикации реестры приходили через
 * `unplugin-auto-import` (bare-identifier `Widgets` транспилировался в импорт).
 * После публикации `dist/*.mjs` не транспилируется AutoImport'ом, поэтому
 * apps кладут реестры на `globalThis` в `bootstrap.tsx` (через
 * `Object.assign(globalThis, registry)`). Контракт сохранён, читаем оттуда.
 *
 * Будущая итерация (см. A-2/A-3 в cleanup-plan) — мигрировать на явную
 * регистрацию через `BaseProviders` props/context, без globalThis. Тогда этот
 * модуль станет thin-wrapper'ом над React-style context-провайдером.
 */

type RegistryMap = {
  Widgets: Widgets;
  Entities: Entities;
  Controllers: Controllers;
  Features: Features;
  Shapes: Shapes;
};

export const getGlobalRegistry = <K extends keyof RegistryMap>(key: K): RegistryMap[K] =>
  ((globalThis as Record<string, unknown>)[key] as RegistryMap[K]) ?? ({} as RegistryMap[K]);
