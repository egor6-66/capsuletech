import { cn } from '@capsuletech/web-style';
import { type JSX, splitProps } from 'solid-js';

const createCardPart = (defaultClass: string) => {
  return (props: JSX.HTMLAttributes<HTMLDivElement>) => {
    const [local, others] = splitProps(props, ['class']);
    return <div class={cn(defaultClass, local.class)} {...others} />;
  };
};

export const CardHeader = createCardPart('flex flex-col space-y-1.5 px-card py-card-tight');
export const CardTitle = createCardPart('font-semibold leading-tight tracking-tight text-lg');
export const CardDescription = createCardPart('text-sm leading-normal text-muted-foreground');
export const CardContent = createCardPart('px-card pb-card');
export const CardFooter = createCardPart('flex items-center px-card pb-card');
