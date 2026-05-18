import type { ZodTypeAny } from '@capsuletech/shared-zod';
import type { JSX } from 'solid-js';

/**
 * Категория для группировки в палитре. Список закрыт намеренно — добавлять
 * новые категории сознательно, чтобы палитра не разрослась.
 */
export type ComponentCategory =
  | 'control' //     Button, Input, Checkbox, …
  | 'typography' // Title, Text, Label
  | 'container' //  Card, Field, Wrapper (структурные обёртки)
  | 'composite' //  Card.Header, Field.Label (parts составных компонентов)
  | 'feedback' //   Separator, Alert, Toast
  | 'wrapper'; //   Animate, Show, Suspense — non-visual обёртки

/**
 * Спецификация одного компонента для редактора. Описывает всё, что нужно
 * палитре (категория, иконка), drag-n-drop валидации (`accepts`, `isLeaf`),
 * инспектору пропсов (`propsSchema`, `styleSlots`) и создателю нод
 * (`defaultProps`).
 *
 * Тип `type` совпадает с тем, что используется в `@capsuletech/renderer` для
 * `node.type` — это dot-path в реестре (e.g. `'ui.Button'`, `'ui.Card.Header'`).
 */
export interface IComponentManifest {
  /** Dot-path в registry — тот же ключ, что в JSON-схеме renderer'а. */
  type: string;
  /** Человекочитаемое имя для палитры/инспектора. */
  label: string;
  category: ComponentCategory;
  /** Render иконки — JSX (emoji, SVG, либо ваша icon-component). */
  icon: () => JSX.Element;
  /** Короткое описание для tooltip'а в палитре. */
  description?: string;

  /**
   * Дефолтные пропсы при создании ноды. Должны валидироваться `propsSchema`.
   * Если в схеме есть `.default()`, можно дублировать здесь — это удобно для
   * IDE-навигации.
   */
  defaultProps: Record<string, unknown>;
  /** Zod-схема для инспектора (renderable форма). */
  propsSchema: ZodTypeAny;
  /**
   * Имена стилевых слотов, которые редактируемы. Дефолт — `['root']` (один
   * корневой). Для составных вроде Card можно `['root', 'header', 'footer']`.
   */
  styleSlots?: string[];

  /**
   * Можно ли вкладывать `childType` внутрь этого компонента. Если не задано
   * и `isLeaf !== true` — принимает любого ребёнка. Если `isLeaf === true`,
   * `accepts` игнорируется и всегда false.
   */
  accepts?: (childType: string) => boolean;
  /** Leaf — детей быть не может. Drop в такой ноды запрещён. */
  isLeaf?: boolean;

  /**
   * Может ли компонент быть корнем в редакторе. По умолчанию любые containers
   * могут — UI-leaf не могут (нет смысла начинать страницу с одной кнопки).
   * Это soft-rule, не enforced renderer'ом.
   */
  canBeRoot?: boolean;
}

/** Минимальная сводка манифеста для палитры. */
export interface IManifestSummary {
  type: string;
  label: string;
  category: ComponentCategory;
  icon: () => JSX.Element;
  description?: string;
}
