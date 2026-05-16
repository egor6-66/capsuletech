import { cva } from '@capsule/web-style';

export const variants = {
  orientation: {
    vertical: ['flex-col [&>*]:w-full [&>.sr-only]:w-auto'],
    horizontal: [
      'flex-row items-center',
      '[&>[data-slot=field-label]]:flex-auto',
      'has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px has-[>[data-slot=field-content]]:items-start',
    ],
    responsive: [
      '@md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto flex-col [&>*]:w-full [&>.sr-only]:w-auto',
      '@md/field-group:[&>[data-slot=field-label]]:flex-auto',
      '@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
    ],
  },
};

export const fieldCva = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants,
    defaultVariants: {
      orientation: 'vertical',
    },
  },
);
