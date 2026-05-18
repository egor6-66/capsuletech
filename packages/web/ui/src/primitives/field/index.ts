import { Field as FieldComponent } from './field';
import {
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from './parts';

type FieldWithStaticProps = typeof FieldComponent & {
  Content: typeof FieldContent;
  Description: typeof FieldDescription;
  Error: typeof FieldError;
  Group: typeof FieldGroup;
  Label: typeof FieldLabel;
  Legend: typeof FieldLegend;
  Separator: typeof FieldSeparator;
  Set: typeof FieldSet;
  Title: typeof FieldTitle;
};

const Field = FieldComponent as FieldWithStaticProps;
Field.Content = FieldContent;
Field.Description = FieldDescription;
Field.Error = FieldError;
Field.Group = FieldGroup;
Field.Label = FieldLabel;
Field.Legend = FieldLegend;
Field.Separator = FieldSeparator;
Field.Set = FieldSet;
Field.Title = FieldTitle;

export type * as IField from './interfaces';
export { Field };
