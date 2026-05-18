import type { JSX } from 'solid-js';
import type { ZodType } from 'zod';
import { z as zodRoot } from 'zod';

/**
 * Capsule-расширенный zod-namespace. Прокидывается в фабрики обёрток (Shape и др.)
 * первым/служебным аргументом — пользователь НЕ импортирует напрямую,
 * а получает через фабричный аргумент.
 *
 * В v1 добавлен один хелпер — `z.component()` для JSX-renderable полей.
 * По мере роста сюда попадут другие capsule-доменные валидаторы:
 *   - `z.tag()` для CapsuleTag из app-config'а;
 *   - `z.href()` для URL-паттернов;
 *   - `z.alias()` для алиасов;
 *   - и т.д.
 *
 * Реализация — shallow-copy через spread, а не `Object.create(zod)`:
 * Vite после `optimizeDeps` оборачивает zod в frozen ESM Module-namespace,
 * и присваивание `proxy.component` через прототипную цепочку ловит
 * `Cannot assign to property 'component' of [object Module]`. Spread даёт
 * обычный объект без frozen-прототипа, оригинальный модуль не мутируется.
 */
export interface CapsuleZ extends Omit<typeof zodRoot, never> {
  /** zod-схема для Solid-renderable значения (JSX.Element, function-component, string и т.п.). */
  component: () => ZodType<JSX.Element>;
}

const create = (): CapsuleZ => {
  const proxy = { ...zodRoot } as CapsuleZ;
  proxy.component = () => zodRoot.custom<JSX.Element>(() => true);
  return proxy;
};

export const z: CapsuleZ = create();
