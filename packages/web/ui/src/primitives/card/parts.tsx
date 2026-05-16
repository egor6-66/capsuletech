import { cn } from '@capsule/web-style';
import { type JSX, splitProps } from 'solid-js';

const createCardPart = (defaultClass: string) => {
  return (props: JSX.HTMLAttributes<HTMLDivElement>) => {
    const [local, others] = splitProps(props, ['class']);
    return <div class={cn(defaultClass, local.class)} {...others} />;
  };
};

export const CardHeader = createCardPart('flex flex-col space-y-1.5 p-container');
export const CardTitle = createCardPart('font-semibold leading-none tracking-tight');
export const CardDescription = createCardPart('text-sm text-muted-foreground');
export const CardContent = createCardPart('p-container');
export const CardFooter = createCardPart('flex items-center p-container');
