import { createStyle } from '@capsuletech/web-style';
import { splitProps } from 'solid-js';

import type { IFieldProps } from './interfaces';
import { fieldCva } from './variants';

export function Field(props: IFieldProps) {
  const [local, variants, others] = splitProps(props, ['class', 'style'], ['orientation']);

  const { className, style } = createStyle(fieldCva, {
    ...variants,
    class: local.class,
    style: local.style,
  });
  return (
    // biome-ignore lint/a11y/useSemanticElements: Field is a generic grouping primitive — wrapping in <fieldset> would force a default browser legend layout we don't want; consumers compose FieldSet/FieldLegend explicitly when semantics matter.
    <div role="group" data-slot="field" class={className()} style={style()} {...others} />
  );
}
