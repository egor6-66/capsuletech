import { z } from '@capsuletech/shared-zod';
import { TextCursorInput } from 'lucide-solid';
import type { IComponentManifest } from '../types';

export const InputManifest: IComponentManifest = {
  type: 'ui.Input',
  label: 'Input',
  category: 'control',
  icon: () => <TextCursorInput size={16} />,
  description: 'Однострочный текстовый ввод',
  isLeaf: true,
  defaultProps: {
    placeholder: '',
  },
  propsSchema: z.object({
    placeholder: z.string().default(''),
    type: z.enum(['text', 'password', 'email', 'tel', 'number']).default('text'),
    class: z.string().optional(),
  }),
};
