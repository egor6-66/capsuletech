/**
 * Pure-helpers UiProxy — здесь живут потому что их часто используют отдельно
 * (тесты + потенциальные потребители за пределами proxy.tsx) и они не зависят
 * от Solid/DOM/web-ui. Держим в отдельном файле, чтобы импорт не тащил
 * lazy-импорты `@capsuletech/web-ui`/`@tanstack/solid-router` (см. imports.tsx)
 * в node-only тесты.
 */

/** Деривация name: первый «конкретный» тег (без @-префикса) из meta.tags. */
export const deriveName = (meta: any): string | undefined =>
  meta?.tags?.find?.((t: string) => typeof t === 'string' && !t.startsWith('@'));

/**
 * Closed-set маппинг tag → HTML input-type. Расширяется только осознанно
 * (это часть публичного контракта tag-driven форм). Тест `derivation.test.ts`
 * пинает изменения.
 */
export const TAG_TO_INPUT_TYPE: Record<string, string> = {
  password: 'password',
  email: 'email',
  phone: 'tel',
  number: 'number',
  text: 'text',
};

/**
 * Деривация HTML input-type из тегов. Если в meta.tags есть один из «типовых»
 * тегов — возвращаем соответствующий `type` для DOM-атрибута. Иначе `undefined`
 * (пусть DOM использует default `text` либо то, что задал автор Entity явно
 * через `type="..."`).
 */
export const deriveInputType = (meta: any): string | undefined => {
  const tags: string[] = meta?.tags ?? [];
  for (const tag of tags) {
    const mapped = TAG_TO_INPUT_TYPE[tag];
    if (mapped) return mapped;
  }
  return undefined;
};
