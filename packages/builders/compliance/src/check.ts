import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

// @babel/traverse is CJS with __esModule:true — Node.js ESM interop gives the namespace object,
// not the function. Unwrap .default when present.
const traverse: typeof _traverse = (_traverse as any).default ?? _traverse;

import * as t from '@babel/types';
import { classify, extractGroup, type Layer } from './classify';
import { CROSS_LAYER_ALLOWED, LAYER_PREFIXES, RUNTIME_ALLOWED } from './rules';

export interface IViolation {
  file: string;
  line: number;
  column: number;
  source: string;
  layer: Exclude<Layer, null>;
  kind:
    | 'disallowed-import' // import не из allowlist данного слоя
    | 'upward-import' // нижний слой тащит верхний
    | 'horizontal-import' // сосед по слою (другая группа)
    | 'side-effect-fetch' // fetch/axios в не-feature
    | 'unknown-alias'; // @-литерал в meta.tags не зарегистрирован в capsule.app.ts
  message: string;
  hint?: string;
}

export interface ICheckOptions {
  /** Доп. allowlist по слоям, мерджится с дефолтным. */
  extraAllowed?: Partial<Record<Exclude<Layer, null | 'system' | 'test'>, RegExp[]>>;
  /** Включить ли проверку `fetch`/`axios` в не-feature. По умолчанию true. */
  checkSideEffects?: boolean;
  /**
   * Whitelist зарегистрированных алиасов (ключей `aliases` из `capsule.app.ts`).
   * Если не задан — проверка `unknown-alias` пропускается.
   */
  aliasKeys?: ReadonlySet<string>;
}

/** Проверить файл — вернуть список нарушений (может быть пустым). */
export const check = (absPath: string, code: string, opts: ICheckOptions = {}): IViolation[] => {
  const layer = classify(absPath);
  if (!layer || layer === 'system' || layer === 'test') return [];

  const violations: IViolation[] = [];

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true,
    });
  } catch {
    return []; // не можем парсить — не наша проблема
  }

  const extraAllowed = opts.extraAllowed?.[layer] ?? [];
  const allowed = [...(RUNTIME_ALLOWED[layer] ?? []), ...extraAllowed];
  const fileGroup = extractGroup(absPath, layer);

  const checkImport = (source: string, isTypeOnly: boolean, line: number, column: number) => {
    if (isTypeOnly) return; // type-only не создаёт runtime-связи
    if (source.startsWith('.')) return; // относительный импорт — внутри пакета/группы, ок

    // Cross-layer через @entities/, @controllers/, @features/, @widgets/, @pages/
    for (const [prefix, targetLayer] of Object.entries(LAYER_PREFIXES)) {
      if (!source.startsWith(prefix)) continue;
      const allowedTargets = CROSS_LAYER_ALLOWED[layer];
      if (allowedTargets.has(targetLayer)) {
        // Разрешено для widget/page-ролей. Доп. проверка горизонтали:
        if (targetLayer === layer) {
          // та же layer, но через alias — горизонталь внутри. Имя группы:
          const targetGroup = source.slice(prefix.length).split('/')[0];
          if (fileGroup && targetGroup && targetGroup !== fileGroup) {
            violations.push({
              file: absPath,
              line,
              column,
              source,
              layer,
              kind: 'horizontal-import',
              message: `Horizontal import: ${layer} "${fileGroup}" импортирует соседа "${targetGroup}".`,
              hint: 'Композиция между сущностями одного слоя — только в Widget через слоты/children.',
            });
          }
        }
        return;
      }
      // Не разрешено: upward или horizontal
      const isUpward = LAYER_ORDER[targetLayer] > LAYER_ORDER[layer];
      violations.push({
        file: absPath,
        line,
        column,
        source,
        layer,
        kind: isUpward ? 'upward-import' : 'horizontal-import',
        message: isUpward
          ? `Upward import: ${layer} не может импортировать ${targetLayer} ("${source}").`
          : `Horizontal import: ${layer} не может импортировать соседа из ${targetLayer} ("${source}").`,
        hint: isUpward
          ? 'Зависимость должна идти сверху вниз. Перенеси композицию в Widget.'
          : 'Композиция между сущностями одного слоя — только в Widget через слоты/children.',
      });
      return;
    }

    // Внешние / @capsuletech/* — проверяем allowlist
    if (allowed.some((rx) => rx.test(source))) return;

    violations.push({
      file: absPath,
      line,
      column,
      source,
      layer,
      kind: 'disallowed-import',
      message: `Import "${source}" не разрешён в слое ${layer}.`,
      hint: `Допустимые в ${layer}: ${allowed.map((r) => r.source).join(', ')}.`,
    });
  };

  const checkMetaTags = (tagsArray: t.ArrayExpression) => {
    if (!opts.aliasKeys) return;
    for (const el of tagsArray.elements) {
      if (!el || !t.isStringLiteral(el)) continue;
      const value = el.value;
      if (!value.startsWith('@')) continue;
      if (opts.aliasKeys.has(value)) continue;
      const loc = el.loc?.start;
      violations.push({
        file: absPath,
        line: loc?.line ?? 0,
        column: loc?.column ?? 0,
        source: value,
        layer,
        kind: 'unknown-alias',
        message: `Unknown alias "${value}" в meta.tags — не зарегистрирован в capsule.app.ts > aliases.`,
        hint: `Зарегистрируй "${value}" в aliases или убери @-префикс если это обычный тег.`,
      });
    }
  };

  traverse(ast, {
    JSXAttribute(path) {
      const node = path.node;
      if (!t.isJSXIdentifier(node.name) || node.name.name !== 'meta') return;
      const value = node.value;
      if (!value || !t.isJSXExpressionContainer(value)) return;
      const expr = value.expression;
      if (!t.isObjectExpression(expr)) return;
      for (const prop of expr.properties) {
        if (!t.isObjectProperty(prop)) continue;
        const key = prop.key;
        const keyName = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : null;
        if (keyName !== 'tags') continue;
        if (!t.isArrayExpression(prop.value)) continue;
        checkMetaTags(prop.value);
      }
    },
    ImportDeclaration(path) {
      const node = path.node;
      const isTypeOnly = node.importKind === 'type';
      const source = node.source.value;
      const loc = node.loc?.start;
      checkImport(source, isTypeOnly, loc?.line ?? 0, loc?.column ?? 0);
    },
    CallExpression(path) {
      const node = path.node;
      // dynamic import('...')
      if (
        t.isImport(node.callee) &&
        node.arguments.length > 0 &&
        t.isStringLiteral(node.arguments[0])
      ) {
        const source = node.arguments[0].value;
        const loc = node.loc?.start;
        checkImport(source, false, loc?.line ?? 0, loc?.column ?? 0);
        return;
      }

      // Side-effect: fetch/axios в не-feature
      if (opts.checkSideEffects === false) return;
      if (layer === 'feature') return;

      const callee = node.callee;
      let calleeName: string | null = null;

      if (t.isIdentifier(callee)) {
        calleeName = callee.name;
      } else if (t.isMemberExpression(callee) && t.isIdentifier(callee.object)) {
        calleeName = callee.object.name;
      }

      if (calleeName === 'fetch' || calleeName === 'axios' || calleeName === 'XMLHttpRequest') {
        const loc = node.loc?.start;
        violations.push({
          file: absPath,
          line: loc?.line ?? 0,
          column: loc?.column ?? 0,
          source: calleeName,
          layer,
          kind: 'side-effect-fetch',
          message: `Сетевой вызов "${calleeName}(...)" запрещён в слое ${layer}.`,
          hint: 'API-вызовы — только во Feature. Передай результат вверх через next() или вниз через store.',
        });
      }
    },
  });

  return violations;
};

const LAYER_ORDER: Record<Exclude<Layer, null | 'system' | 'test'>, number> = {
  view: 0,
  controller: 1,
  feature: 2,
  widget: 3,
  page: 4,
};
