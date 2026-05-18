import { z } from '@capsuletech/shared-zod';
import { AlignJustify, AlignLeft, CreditCard, Heading1, PanelBottom, Type } from 'lucide-solid';
import type { IComponentManifest } from '../types';

const CARD_DIRECT_CHILDREN = new Set([
  'ui.Card.Header',
  'ui.Card.Title',
  'ui.Card.Description',
  'ui.Card.Content',
  'ui.Card.Footer',
]);

const isCardPart = (type: string) => type.startsWith('ui.Card.');

export const CardManifest: IComponentManifest = {
  type: 'ui.Card',
  label: 'Card',
  category: 'container',
  icon: () => <CreditCard size={16} />,
  description: 'Контейнер-карточка с шапкой/контентом/футером',
  accepts: (childType) => CARD_DIRECT_CHILDREN.has(childType),
  defaultProps: {
    class: 'w-full max-w-sm',
  },
  styleSlots: ['root'],
  propsSchema: z.object({
    class: z.string().optional(),
  }),
};

export const CardHeaderManifest: IComponentManifest = {
  type: 'ui.Card.Header',
  label: 'Card Header',
  category: 'composite',
  icon: () => <Heading1 size={16} />,
  accepts: (childType) => childType === 'ui.Card.Title' || childType === 'ui.Card.Description',
  defaultProps: {},
  propsSchema: z.object({
    class: z.string().optional(),
  }),
};

export const CardTitleManifest: IComponentManifest = {
  type: 'ui.Card.Title',
  label: 'Card Title',
  category: 'composite',
  icon: () => <Type size={16} />,
  isLeaf: true,
  defaultProps: { children: 'Title' },
  propsSchema: z.object({
    children: z.string().default('Title'),
    class: z.string().optional(),
  }),
};

export const CardDescriptionManifest: IComponentManifest = {
  type: 'ui.Card.Description',
  label: 'Card Description',
  category: 'composite',
  icon: () => <AlignLeft size={16} />,
  isLeaf: true,
  defaultProps: { children: 'Description' },
  propsSchema: z.object({
    children: z.string().default('Description'),
    class: z.string().optional(),
  }),
};

export const CardContentManifest: IComponentManifest = {
  type: 'ui.Card.Content',
  label: 'Card Content',
  category: 'composite',
  icon: () => <AlignJustify size={16} />,
  accepts: (childType) => !isCardPart(childType),
  defaultProps: {},
  propsSchema: z.object({
    class: z.string().optional(),
  }),
};

export const CardFooterManifest: IComponentManifest = {
  type: 'ui.Card.Footer',
  label: 'Card Footer',
  category: 'composite',
  icon: () => <PanelBottom size={16} />,
  accepts: (childType) => !isCardPart(childType),
  defaultProps: {},
  propsSchema: z.object({
    class: z.string().optional(),
  }),
};
