import { lazy } from 'solid-js';

// 1. Хелпер для сокращения записи
// m[name] вытаскивает конкретный компонент из модуля, так как у вас именованные экспорты
const createLazy = (importer: () => Promise<any>, name: string) =>
  lazy(() => importer().then((m) => ({ default: m[name] })));

// 2. Простые компоненты
export const Button = createLazy(() => import('@capsuletech/web-ui/button'), 'Button');
export const Input = createLazy(() => import('@capsuletech/web-ui/input'), 'Input');
export const Label = createLazy(() => import('@capsuletech/web-ui/label'), 'Label');
export const Separator = createLazy(() => import('@capsuletech/web-ui/separator'), 'Separator');
export const Toggle = createLazy(() => import('@capsuletech/web-ui/toggle'), 'Toggle');
export const Typography = createLazy(() => import('@capsuletech/web-ui/typography'), 'Typography');

// Layout namespace: Grid + Flex + Matrix
export const Layout = {
  Grid:   createLazy(() => import('@capsuletech/web-ui/grid'), 'Grid'),
  Flex:   createLazy(() => import('@capsuletech/web-ui/flex'), 'Flex'),
  Matrix: createLazy(() => import('@capsuletech/web-ui/matrix'), 'Matrix'),
};
export const List = createLazy(() => import('@capsuletech/web-ui/list'), 'List');
const GroupBase = createLazy(() => import('@capsuletech/web-ui/group'), 'Group');
export const Group = Object.assign(GroupBase, {
  Separator: createLazy(() => import('@capsuletech/web-ui/group'), 'GroupSeparator'),
});
export const Animate = createLazy(() => import('@capsuletech/web-ui/wrappers'), 'Animate');
export const Resizable = createLazy(() => import('@capsuletech/web-ui/wrappers'), 'Resizable');

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

// 7. DataTable — smart table (sorting/pagination/selection/filtering), no sub-components
export const DataTable = createLazy(() => import('@capsuletech/web-ui/dataTable'), 'DataTable');

// 6. Компонент Table со вложенными частями
const TableBase = createLazy(() => import('@capsuletech/web-ui/table'), 'Table');
export const Table = Object.assign(TableBase, {
  Header: createLazy(() => import('@capsuletech/web-ui/table'), 'TableHeader'),
  Body:   createLazy(() => import('@capsuletech/web-ui/table'), 'TableBody'),
  Row:    createLazy(() => import('@capsuletech/web-ui/table'), 'TableRow'),
  Head:   createLazy(() => import('@capsuletech/web-ui/table'), 'TableHead'),
  Cell:   createLazy(() => import('@capsuletech/web-ui/table'), 'TableCell'),
});

// 8. Dropdown — accessible menu primitive (Kobalte). Compound с 9 sub-components:
// Trigger / Content / Item / Separator / Group / Label / Sub / SubTrigger / SubContent.
const DropdownBase = createLazy(() => import('@capsuletech/web-ui/dropdown'), 'Dropdown');
export const Dropdown = Object.assign(DropdownBase, {
  Trigger:    createLazy(() => import('@capsuletech/web-ui/dropdown'), 'DropdownTrigger'),
  Content:    createLazy(() => import('@capsuletech/web-ui/dropdown'), 'DropdownContent'),
  Item:       createLazy(() => import('@capsuletech/web-ui/dropdown'), 'DropdownItem'),
  Separator:  createLazy(() => import('@capsuletech/web-ui/dropdown'), 'DropdownSeparator'),
  Group:      createLazy(() => import('@capsuletech/web-ui/dropdown'), 'DropdownGroup'),
  Label:      createLazy(() => import('@capsuletech/web-ui/dropdown'), 'DropdownLabel'),
  Sub:        createLazy(() => import('@capsuletech/web-ui/dropdown'), 'DropdownSub'),
  SubTrigger: createLazy(() => import('@capsuletech/web-ui/dropdown'), 'DropdownSubTrigger'),
  SubContent: createLazy(() => import('@capsuletech/web-ui/dropdown'), 'DropdownSubContent'),
});

// ThemeSwitcher из @capsuletech/web-style (plain Solid component, не web-ui primitive).
// Субпасс ./switcher отсутствует в package.json web-style — импортируем из основного
// barrel (framework gap, делегировано architect для добавления subpath в web-style).
export const ThemeSwitcher = createLazy(
  () => import('@capsuletech/web-style'),
  'ThemeSwitcher',
);
export const DarkModeToggle = createLazy(
  () => import('@capsuletech/web-style'),
  'DarkModeToggle',
);
export const MapView = createLazy(
  () => import('@capsuletech/web-map'),
  'MapView',
);

// Реэкспорт сторонних утилит
export { Link } from '@tanstack/solid-router';
