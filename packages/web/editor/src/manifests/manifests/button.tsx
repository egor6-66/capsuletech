import { z } from '@capsuletech/shared-zod';
import { MousePointerClick } from 'lucide-solid';
import type { IComponentManifest } from '../types';

export const ButtonManifest: IComponentManifest = {
  type: 'ui.Button',
  label: 'Button',
  category: 'control',
  icon: () => <MousePointerClick size={16} />,
  description: 'Кнопка с вариантами оформления',
  isLeaf: true,
  defaultProps: {
    variant: 'default',
    children: 'Button',
  },
  propsSchema: z.object({
    variant: z
      .enum(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'])
      .default('default'),
    children: z.string().default('Button'),
    class: z.string().optional(),
  }),
};
