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
 * Имена wrapper-функций уровня (Page/Widget/Entity/Controller/Feature/Shape).
 * Используются:
 *   - HMRWrappingPlugin (раскручивает `const X = Wrapper(...)` для HMR)
 *   - AutoImport в `capsuleConfig` (делает их глобальными в TSX-файлах)
 */
export const WRAPPER_NAMES = [
  'Page',
  'Widget',
  'Entity',
  'Controller',
  'Feature',
  'Shape',
] as const;
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
 * Имена директорий слоёв в `apps/<app>/src/`. Имя файла слоя совпадает с
 * директорией множественным числом (widgets/, entities/, …), wrapper-функция
 * — единственным числом в PascalCase. Pages — отдельный слой с роутингом,
 * в этом списке нет.
 *
 * Mapping слой-dir → namespace для slot-генерации.
 */
export const LAYER_TO_NAMESPACE = {
  widgets: 'Widgets',
  entities: 'Entities',
  controllers: 'Controllers',
  features: 'Features',
  shapes: 'Shapes',
} as const;
export type LayerDir = keyof typeof LAYER_TO_NAMESPACE;
export const LAYER_DIRS = Object.keys(LAYER_TO_NAMESPACE) as LayerDir[];
