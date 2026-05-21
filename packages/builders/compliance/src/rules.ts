import type { Layer } from './classify';

/**
 * Allowlist разрешённых импортов **по слоям**. Регулярки против import-source.
 * Применяется к runtime-импортам; type-only (`import type`) пропускаются всегда.
 *
 * Расширяется через `compliancePlugin({ extraAllowed: { feature: [/^@app\/api/] } })`.
 *
 * NB: имена пакетов — `@capsuletech/web-*` (см. `nx.json > release.groups.web_base`).
 * Старые имена (`@capsuletech/style`/`state`/`router`/`ui`) больше не существуют —
 * не возвращай regex'ы под них без миграции апликейшенов.
 */

const COMMON: RegExp[] = [
  /^solid-js(\/.*)?$/, // solid-js, solid-js/web, solid-js/store
  /^@capsuletech\/web-style(\/.*)?$/,
];

export const RUNTIME_ALLOWED: Record<Exclude<Layer, null | 'system' | 'test'>, RegExp[]> = {
  view: [
    ...COMMON,
    // только Solid и стиль — View максимально изолирована (stateless UI leaf)
  ],

  controller: [
    ...COMMON,
    /^xstate(\/.*)?$/,
    /^@xstate\/solid$/,
    /^es-toolkit(\/.*)?$/,
    /^@capsuletech\/web-state(\/.*)?$/,
    /^@capsuletech\/web-router(\/.*)?$/,
    // Тяжёлая логика, кастомные FSM-машины, утилиты — да.
    // API-клиенты — нет (это Feature).
  ],

  feature: [
    ...COMMON,
    /^xstate(\/.*)?$/,
    /^@xstate\/solid$/,
    /^es-toolkit(\/.*)?$/,
    /^@capsuletech\/web-state(\/.*)?$/,
    /^@capsuletech\/web-router(\/.*)?$/,
    /^@capsuletech\/web-query(\/.*)?$/,
    // Feature-only:
    /^@app\/(api|services)(\/.*)?$/, // конвенция: API/services живут под @app/*
  ],

  widget: [
    ...COMMON,
    /^@capsuletech\/web-ui(\/.*)?$/,
    // Widget — чистая композиция через глобальные namespaces (Entities/Controllers/Features),
    // которые приходят через unplugin-auto-import из .capsule/registry. Их в коде не видно.
  ],

  page: [
    ...COMMON,
    /^@capsuletech\/web-ui(\/.*)?$/,
    /^@tanstack\/solid-router$/,
    // Page — корневой layout; widgets подсасываются через namespace, не импортом.
  ],
};

/**
 * Защита от cross-layer импортов через alias-prefix:
 * `@views/*` из не-widget — горизонталь / upward.
 * `@features/*` из non-widget — upward.
 * И т.д.
 *
 * NB: `@entities/` удалён (директория переименована в `views/`, PR #109).
 */
export const LAYER_PREFIXES: Record<string, Exclude<Layer, null | 'system' | 'test'>> = {
  '@views/': 'view',
  '@controllers/': 'controller',
  '@features/': 'feature',
  '@widgets/': 'widget',
  '@pages/': 'page',
};

/**
 * Какому слою разрешено импортировать какой alias-prefix.
 * `widget` может тащить `@views/`, `@controllers/`, `@features/` — это его роль.
 * Все остальные — не могут импортировать соседей по слою.
 */
export const CROSS_LAYER_ALLOWED: Record<
  Exclude<Layer, null | 'system' | 'test'>,
  Set<Exclude<Layer, null | 'system' | 'test'>>
> = {
  view: new Set(),
  controller: new Set(),
  feature: new Set(),
  widget: new Set(['view', 'controller', 'feature']),
  page: new Set(['widget']),
};
