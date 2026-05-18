import { z } from '@capsuletech/shared-zod';
import { Sparkles } from 'lucide-solid';
import type { IComponentManifest } from '../types';

export const AnimateManifest: IComponentManifest = {
  type: 'ui.Animate',
  label: 'Animate',
  category: 'wrapper',
  icon: () => <Sparkles size={16} />,
  description: 'Анимирующая обёртка (motion-one)',
  defaultProps: {
    variant: 'fade',
    duration: 0.2,
  },
  propsSchema: z.object({
    variant: z
      .enum([
        'fade',
        'slide-up',
        'slide-down',
        'slide-left',
        'slide-right',
        'scale',
        'collapse',
        'none',
      ])
      .default('fade'),
    duration: z.number().default(0.2),
    delay: z.number().optional(),
    class: z.string().optional(),
  }),
};
