/**
 * ⚠ SINGLE SOURCE OF TRUTH для HCA-слоёв.
 *
 * Когда появляется новый слой / wrapper — обновляешь ТОЛЬКО этот файл,
 * остальное (HMRWrappingPlugin, ExportGeneratorPlugin, auto-import в
 * capsuleConfig) подхватит автоматически.
 *
 * Не дублируй эти списки в plugins/* — импортируй отсюда.
 */

/**
 * Wrapper-функции, возвращающие Solid-компонент (render-фазовые).
 * Используются:
 *   - HMRWrappingPlugin (раскручивает `const X = Wrapper(...)` для горячей замены)
 *   - AutoImport в `capsuleConfig` (делает их глобальными в TSX-файлах)
 *
 * НЕ включает `Entity` — Entity возвращает plain config object, не компонент.
 * HMR-обёртка для него семантически неверна: Entity(...)(props) → TypeError.
 */
export const RENDER_WRAPPER_NAMES = [
  'Page',
  'Widget',
  'View',
  'Controller',
  'Feature',
  'Shape',
] as const;
export type RenderWrapperName = (typeof RENDER_WRAPPER_NAMES)[number];

/**
 * Wrapper-функции, возвращающие plain config object (data-layer).
 * Используются только AutoImport — HMRWrappingPlugin их НЕ трогает.
 *
 * `Entity` — domain data layer wrapper (zod schema + defaults, без UI).
 * Возвращает `Object.freeze({ schema, defaults })` — вызов результата как
 * функции (Entity(...)(props)) вызовет TypeError → HMR-wrap запрещён.
 */
export const CONFIG_WRAPPER_NAMES = ['Entity'] as const;
export type ConfigWrapperName = (typeof CONFIG_WRAPPER_NAMES)[number];

/**
 * Объединённый список всех wrapper-имён для AutoImport.
 * HMRWrappingPlugin должен использовать только RENDER_WRAPPER_NAMES.
 */
export const WRAPPER_NAMES = [...RENDER_WRAPPER_NAMES, ...CONFIG_WRAPPER_NAMES] as const;
export type WrapperName = (typeof WRAPPER_NAMES)[number];

/**
 * Config-time фабрики, инжектящиеся в TSX-файлы через AutoImport. В отличие от
 * `WRAPPER_NAMES` это не component-wrapper'ы (нет HMR-обёртки, нет compliance),
 * а функции для декларативных конфигов: `defineEndpoint((z) => ...)`,
 * в будущем — `defineShape`, `defineRoute`, и т.п.
 */
export const DEFINE_FACTORIES = {
  '@capsuletech/web-query': ['defineEndpoint'],
} as const;

/**
 * Mapping слой-dir → namespace для slot-генерации.
 *
 * Имя директории совпадает с множественным числом; wrapper-функция —
 * единственное число в PascalCase. Pages — отдельный слой с роутингом,
 * в этом списке нет.
 *
 * `entities` → `Entities`: domain data layer (zod schema + defaults, без UI).
 * ExportGeneratorPlugin сканирует папку `entities/` и эмитит eager imports
 * (не lazy), т.к. Entity — lightweight plain value, не Solid component.
 * Eager-слои объявлены в `EAGER_IMPORT_LAYERS`.
 */
export const LAYER_TO_NAMESPACE = {
  widgets: 'Widgets',
  views: 'Views',
  controllers: 'Controllers',
  features: 'Features',
  shapes: 'Shapes',
  entities: 'Entities',
} as const;

/**
 * Слои, для которых registry использует eager import (не lazy).
 * Entity — domain data spec (plain object), lazy() для него семантически неверен.
 */
export const EAGER_IMPORT_LAYERS = new Set<string>(['entities']);
export type LayerDir = keyof typeof LAYER_TO_NAMESPACE;
export const LAYER_DIRS = Object.keys(LAYER_TO_NAMESPACE) as LayerDir[];
