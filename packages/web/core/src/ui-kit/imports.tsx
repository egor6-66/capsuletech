// `slot` — крошечный identity-хелпер ради TS-автокомплита. Импортируется sync
// (а не lazy), чтобы `Ui.Layout.slot({...})` был доступен на этапе compile-time.
import { slot as layoutSlot } from '@capsuletech/web-ui/layout/slot';
import { lazy } from 'solid-js';

// 1. Хелпер для сокращения записи
// m[name] вытаскивает конкретный компонент из модуля, так как у вас именованные экспорты
const createLazy = (importer: () => Promise<any>, name: string) =>
  lazy(() => importer().then((m) => ({ default: m[name] })));

// 2. Простые компоненты
export const Button = createLazy(() => import('@capsuletech/web-ui/button'), 'Button');
export const Input = createLazy(() => import('@capsuletech/web-ui/input'), 'Input');

const LayoutBase = createLazy(() => import('@capsuletech/web-ui/layout'), 'Layout');
export const Layout = Object.assign(LayoutBase, { slot: layoutSlot });
export const List = createLazy(() => import('@capsuletech/web-ui/list'), 'List');
export const Animate = createLazy(() => import('@capsuletech/web-ui/wrappers'), 'Animate');

// 5. Компонент Navigation с подкомпонентами
const NavigationBase = createLazy(() => import('@capsuletech/web-ui/navigation'), 'Navigation');
export const Navigation = Object.assign(NavigationBase, {
  List: createLazy(() => import('@capsuletech/web-ui/navigation'), 'NavigationList'),
  Item: createLazy(() => import('@capsuletech/web-ui/navigation'), 'NavigationItem'),
});

// 3. Компонент Card со вложенными частями
const CardBase = createLazy(() => import('@capsuletech/web-ui/card'), 'Card');
export const Card = Object.assign(CardBase, {
  Header: createLazy(() => import('@capsuletech/web-ui/card/parts'), 'CardHeader'),
  Title: createLazy(() => import('@capsuletech/web-ui/card/parts'), 'CardTitle'),
  Description: createLazy(() => import('@capsuletech/web-ui/card/parts'), 'CardDescription'),
  Content: createLazy(() => import('@capsuletech/web-ui/card/parts'), 'CardContent'),
  Footer: createLazy(() => import('@capsuletech/web-ui/card/parts'), 'CardFooter'),
});

// 4. Компонент Field со всеми частями
const FieldBase = createLazy(() => import('@capsuletech/web-ui/field'), 'Field');
export const Field = Object.assign(FieldBase, {
  Content: createLazy(() => import('@capsuletech/web-ui/field/parts'), 'FieldContent'),
  Description: createLazy(() => import('@capsuletech/web-ui/field/parts'), 'FieldDescription'),
  Error: createLazy(() => import('@capsuletech/web-ui/field/parts'), 'FieldError'),
  Group: createLazy(() => import('@capsuletech/web-ui/field/parts'), 'FieldGroup'),
  Label: createLazy(() => import('@capsuletech/web-ui/field/parts'), 'FieldLabel'),
  Legend: createLazy(() => import('@capsuletech/web-ui/field/parts'), 'FieldLegend'),
  Separator: createLazy(() => import('@capsuletech/web-ui/field/parts'), 'FieldSeparator'),
  Set: createLazy(() => import('@capsuletech/web-ui/field/parts'), 'FieldSet'),
  Title: createLazy(() => import('@capsuletech/web-ui/field/parts'), 'FieldTitle'),
});

// Реэкспорт сторонних утилит
export { Link } from '@tanstack/solid-router';
