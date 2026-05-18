import type { JSX } from 'solid-js';
import type { IFieldDef, OnChangeFn, ValuesMap } from '../types';
import { BooleanField } from './BooleanField';
import { NumberField } from './NumberField';
import { NumberUnitField } from './NumberUnitField';
import { SelectField } from './SelectField';
import { TextareaField } from './TextareaField';
import { TextField } from './TextField';

/**
 * Диспатчер по `field.type`. Каждый case передаёт уже-типизированный field
 * и пробрасывает изменения через единый `onChange(key, value)`.
 */
export const renderField = (
  field: IFieldDef,
  values: ValuesMap,
  onChange: OnChangeFn,
): JSX.Element => {
  const emit = (v: unknown) => onChange(field.key, v);
  const raw = values[field.key];
  switch (field.type) {
    case 'text':
      return <TextField field={field} value={raw as string | undefined} onChange={emit} />;
    case 'textarea':
      return <TextareaField field={field} value={raw as string | undefined} onChange={emit} />;
    case 'number':
      return <NumberField field={field} value={raw as number | undefined} onChange={emit} />;
    case 'number-unit':
      return <NumberUnitField field={field} value={raw as string | undefined} onChange={emit} />;
    case 'boolean':
      return <BooleanField field={field} value={raw as boolean | undefined} onChange={emit} />;
    case 'select':
      return <SelectField field={field} value={raw as string | undefined} onChange={emit} />;
    default:
      // exhaustive — TS подсветит если добавили новый тип и забыли тут
      return null;
  }
};

export { BooleanField, NumberField, NumberUnitField, SelectField, TextareaField, TextField };
