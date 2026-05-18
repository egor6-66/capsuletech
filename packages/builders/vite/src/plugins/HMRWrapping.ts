import _generate from '@babel/generator';
import { parse } from '@babel/parser';
import type { NodePath } from '@babel/traverse';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { Plugin } from 'vite';
import { WRAPPER_NAMES } from './constants';

// `@babel/traverse` и `@babel/generator` — CJS, при ESM-import default
// иногда оборачивается ещё одним слоем (`{ default: fn }`). Разворачиваем.
const traverse = (
  typeof _traverse === 'function' ? _traverse : (_traverse as any).default
) as typeof _traverse;
const generate = (
  typeof _generate === 'function' ? _generate : (_generate as any).default
) as typeof _generate;

// NB: список wrapper'ов в ./constants — единый источник правды.
// Когда добавляешь новый wrapper (например `Layout`) — добавь его ТАМ.
const defaultFunctions = [...WRAPPER_NAMES];

export const HMRWrappingPlugin = (targetFunctions: string[] = []): Plugin => {
  const allTargets = [...defaultFunctions, ...targetFunctions];
  return {
    name: 'capsule-hmr-fix',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.[jt]sx?$/.test(id)) return null;
      try {
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript'],
        });

        let isModified = false;
        let lastTransformedName: string | null = null;
        const hasDefaultExport = ast.program.body.some((node: t.Node) =>
          t.isExportDefaultDeclaration(node),
        );

        traverse(ast, {
          VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
            const { id: varId, init } = path.node;

            // Проверяем, что это идентификатор и это вызов функции
            if (t.isIdentifier(varId) && t.isCallExpression(init)) {
              const callee = init.callee;
              let functionName: string | null = null;

              if (t.isIdentifier(callee)) {
                functionName = callee.name;
              }

              if (functionName && allTargets.includes(functionName)) {
                const originalName = varId.name;
                const capitalizedName =
                  originalName.charAt(0).toUpperCase() + originalName.slice(1);

                // Генерируем аргументы для передачи в оригинальную функцию
                const args = init.arguments;

                // Создаём новую инициализацию: (props: any) => Page(...args)(props)
                const newInit = t.arrowFunctionExpression(
                  [t.identifier('props')],
                  t.callExpression(t.callExpression(t.identifier(functionName), args), [
                    t.identifier('props'),
                  ]),
                );

                // Переименовываем переменную если нужно
                if (originalName !== capitalizedName) {
                  varId.name = capitalizedName;
                }

                path.node.init = newInit;
                isModified = true;
                lastTransformedName = capitalizedName;
              }
            }
          },
        });

        // Добавляем default export если нужно
        if (isModified && lastTransformedName && !hasDefaultExport) {
          const exportDeclaration = t.exportDefaultDeclaration(t.identifier(lastTransformedName));
          ast.program.body.push(exportDeclaration);
        }

        if (!isModified) {
          return null;
        }

        const { code: transformedCode } = generate(ast, {
          retainLines: true,
          compact: false,
        });
        return {
          code: transformedCode,
          map: null,
        };
      } catch (error) {
        console.error(`[HMRWrappingPlugin] Error transforming ${id}:`, error);
        return null;
      }
    },
  };
};
