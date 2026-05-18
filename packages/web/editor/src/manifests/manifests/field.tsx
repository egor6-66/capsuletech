import { z } from '@capsuletech/shared-zod';
import { AlertCircle, FormInput, Inbox, Info, Tag } from 'lucide-solid';
import type { IComponentManifest } from '../types';

const FIELD_DIRECT_CHILDREN = new Set([
  'ui.Field.Label',
  'ui.Field.Content',
  'ui.Field.Description',
  'ui.Field.Error',
]);

const isFieldPart = (type: string) => type.startsWith('ui.Field.');

export const FieldManifest: IComponentManifest = {
  type: 'ui.Field',
  label: 'Field',
  category: 'container',
  icon: () => <FormInput size={16} />,
  description: 'Form-field: метка + ввод + описание/ошибка',
  accepts: (childType) => FIELD_DIRECT_CHILDREN.has(childType),
  defaultProps: {},
  propsSchema: z.object({
    class: z.string().optional(),
  }),
};

export const FieldLabelManifest: IComponentManifest = {
  type: 'ui.Field.Label',
  label: 'Field Label',
  category: 'composite',
  icon: () => <Tag size={16} />,
  isLeaf: true,
  defaultProps: { children: 'Label' },
  propsSchema: z.object({
    children: z.string().default('Label'),
    class: z.string().optional(),
  }),
};

export const FieldContentManifest: IComponentManifest = {
  type: 'ui.Field.Content',
  label: 'Field Content',
  category: 'composite',
  icon: () => <Inbox size={16} />,
  accepts: (childType) => !isFieldPart(childType),
  defaultProps: {},
  propsSchema: z.object({
    class: z.string().optional(),
  }),
};

export const FieldDescriptionManifest: IComponentManifest = {
  type: 'ui.Field.Description',
  label: 'Field Description',
  category: 'composite',
  icon: () => <Info size={16} />,
  isLeaf: true,
  defaultProps: { children: 'Description' },
  propsSchema: z.object({
    children: z.string().default('Description'),
    class: z.string().optional(),
  }),
};

export const FieldErrorManifest: IComponentManifest = {
  type: 'ui.Field.Error',
  label: 'Field Error',
  category: 'composite',
  icon: () => <AlertCircle size={16} />,
  isLeaf: true,
  defaultProps: { children: 'Error' },
  propsSchema: z.object({
    children: z.string().default('Error'),
    class: z.string().optional(),
  }),
};
