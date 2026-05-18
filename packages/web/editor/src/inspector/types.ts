export type ValuesMap = Record<string, unknown>;
export type OnChangeFn = (key: string, value: unknown) => void;

interface IBaseField {
  /** Ключ в `values` map'е. Уникальный в пределах Inspector'а. */
  key: string;
  /** Подпись над полем. Пиши по-человечески — Inspector могут пользовать не-разработчики. */
  label: string;
  /** Длинное пояснение под полем (для не-очевидных пропсов). */
  hint?: string;
  disabled?: boolean;
}

export interface ITextField extends IBaseField {
  type: 'text';
  placeholder?: string;
  /** Моноширинный шрифт — для class, id, ARIA и подобного «технического». */
  mono?: boolean;
}

export interface ITextareaField extends IBaseField {
  type: 'textarea';
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}

export interface INumberField extends IBaseField {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Численное значение с единицей измерения (`'100px'`, `'50%'`, `'auto'`).
 * Если выбран unit `'auto'` — input блокируется (нет смысла редактировать
 * числовую часть).
 */
export interface INumberUnitField extends IBaseField {
  type: 'number-unit';
  units: string[];
  /** По умолчанию первый из `units`. */
  defaultUnit?: string;
  step?: number;
}

export interface IBooleanField extends IBaseField {
  type: 'boolean';
}

export interface ISelectField extends IBaseField {
  type: 'select';
  options: { value: string; label?: string }[];
}

/** Дискриминированный union — `field.type` сужает остальные поля. */
export type IFieldDef =
  | ITextField
  | ITextareaField
  | INumberField
  | INumberUnitField
  | IBooleanField
  | ISelectField;

export interface ICategory {
  id: string;
  /** Заголовок секции — «Основное», «Расширенное» и т.д. */
  label: string;
  /** Описание секции под заголовком (опционально). */
  description?: string;
  fields: IFieldDef[];
  /** Сворачивать секцию по умолчанию. Удобно для «advanced» блока. */
  defaultCollapsed?: boolean;
}

export interface IInspectorProps {
  categories: ICategory[];
  /** Текущее значение каждого `field.key`. */
  values: ValuesMap;
  /** Колбэк на одно изменение поля — потребитель сам мерджит в values. */
  onChange: OnChangeFn;
  /** Доп. класс на корневой div. */
  class?: string;
}
