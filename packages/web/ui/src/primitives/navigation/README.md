# Navigation Component

Компонент навигации для создания горизонтальных и вертикальных меню с поддержкой активного состояния.

## Features

- 📱 **Responsive** - поддерживает горизонтальную и вертикальную ориентацию
- ♿ **Accessible** - использует семантический HTML и ARIA атрибуты
- 🎨 **Customizable** - варианты размера и стиля через CVA
- ⚡ **SolidJS** - полная реактивность и оптимизация

## Usage

### Горизонтальная навигация

```tsx
import { Navigation, NavigationList, NavigationItem } from '@capsule/ui/navigation';
import { Link } from '@tanstack/solid-router';

const navItems = [
  { id: 1, label: 'Home', href: '/', active: true },
  { id: 2, label: 'About', href: '/about' },
  { id: 3, label: 'Contact', href: '/contact' },
];

export function HorizontalNav() {
  return (
    <Navigation orientation="horizontal">
      <NavigationList items={navItems} orientation="horizontal">
        {(item) => (
          <NavigationItem
            as={Link}
            href={item.href}
            active={item.active}
          >
            {item.label}
          </NavigationItem>
        )}
      </NavigationList>
    </Navigation>
  );
}
```

### Вертикальная навигация

```tsx
import { Navigation, NavigationList, NavigationItem } from '@capsule/ui/navigation';

const sections = [
  { id: 1, name: 'Section 1', href: '#section1', active: true },
  { id: 2, name: 'Section 2', href: '#section2' },
  { id: 3, name: 'Section 3', href: '#section3' },
];

export function VerticalNav() {
  return (
    <Navigation orientation="vertical">
      <NavigationList items={sections} orientation="vertical">
        {(section) => (
          <NavigationItem href={section.href} active={section.active}>
            {section.name}
          </NavigationItem>
        )}
      </NavigationList>
    </Navigation>
  );
}
```

## Props

### Navigation

- `orientation?: 'horizontal' | 'vertical'` - направление навигации (по умолчанию: horizontal)
- `class?: string` - дополнительные классы
- `style?: JSX.CSSProperties | string` - встроенные стили
- `children: JSX.Element` - содержимое (обычно NavigationList)

### NavigationList

- `items?: T[]` - массив элементов для рендера
- `children: (item: T, index: () => number) => JSX.Element` - функция рендера каждого элемента
- `orientation?: 'horizontal' | 'vertical'` - направление списка
- `class?: string` - дополнительные классы
- `style?: JSX.CSSProperties | string` - встроенные стили

### NavigationItem

- `href: string` - ссылка для элемента
- `active?: boolean` - отмечает элемент как активный
- `disabled?: boolean` - отключает элемент
- `variant?: 'default' | 'active'` - стиль (выбирается автоматически по active)
- `size?: 'default' | 'lg'` - размер элемента
- `class?: string` - дополнительные классы
- `children: JSX.Element` - содержимое элемента

## Styling

Компонент использует Tailwind CSS и CVA для стилизации. Основные цвета:
- `bg-background` - фон
- `border-border` - границы
- `text-foreground` - текст
- `bg-accent` - акцент для hover/active состояний
- `text-primary` - основной цвет текста

## Accessibility

- ✅ Семантический HTML (`<nav>`, `<ul>`, `<li>`, `<a>`)
- ✅ ARIA атрибуты (`aria-current`, `aria-disabled`)
- ✅ Поддержка focus состояний
- ✅ Правильная структура DOM

