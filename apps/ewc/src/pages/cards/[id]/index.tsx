import { Renderer, type ISchema, type Registry } from '@capsuletech/web-renderer';
import { Button, Card, Field, Input } from '@capsuletech/web-ui';
import { FORM_PRESET, generate } from '@capsuletech/web-ui-creator/generators';
import { useParams } from '@tanstack/solid-router';
import { createMemo } from 'solid-js';

/**
 * Card-by-id route (`/cards/$id`) — пер-id рендер сгенерированной формы.
 *
 * Pipeline:
 *   useParams().id → hashSeed(id) → generate(FORM_PRESET, { seed })
 *     → IEditorTree → { components: tree } → <Renderer schema registry />
 *
 * id трактуется как источник seed'а: `parseInt` если число, иначе stable
 * string-hash. Это даёт два важных свойства:
 *   - детерминизм: тот же URL → та же форма (можно копипастить, обновлять);
 *   - регенерация: layout-кнопка "Generate new" навигирует на новый id
 *     (`Date.now()`), `useParams` реактивно меняется, memo пересчитывается,
 *     Renderer перерисовывает дерево.
 *
 * Registry — inline (`ui.Card` / `ui.Field` / `ui.Input` / `ui.Button`).
 * Card и Field уже compound через `Object.assign` (см. их index.ts) —
 * resolvePath дёргает `.Title`/`.Header`/`.Label` через тот же dot-path.
 *
 * Mode `'static'` — interactions из схемы игнорируем (генератор их не
 * выдаёт, а контекста Controller-wrapper'ов в этом sandbox'е нет).
 */

const hashSeed = (s: string): number => {
  const asNumber = Number(s);
  if (Number.isFinite(asNumber)) return asNumber;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
};

const REGISTRY: Registry = {
  ui: {
    Card: Card as never,
    Field: Field as never,
    Input,
    Button,
  },
};

const CardById = Page(() => {
  const params = useParams({ from: '/cards/$id' });

  const schema = createMemo<ISchema>(() => ({
    components: generate(FORM_PRESET, { seed: hashSeed(params().id) }),
  }));

  return (
    <div class="max-w-md">
      <div class="text-xs opacity-60 font-mono mb-2">
        id: {params().id} (seed: {hashSeed(params().id)})
      </div>
      <Renderer schema={schema()} registry={REGISTRY} mode="static" />
    </div>
  );
});

export default CardById;
