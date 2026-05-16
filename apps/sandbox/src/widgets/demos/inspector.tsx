import { type ICategory, Inspector } from '@capsuletech/inspector';
import { createSignal } from 'solid-js';

const CATEGORIES: ICategory[] = [
  {
    id: 'basic',
    label: 'Основное',
    description: 'Что увидит пользователь — без технических деталей.',
    fields: [
      {
        type: 'text',
        key: 'label',
        label: 'Текст кнопки',
        placeholder: 'Например, «Войти»',
      },
      {
        type: 'select',
        key: 'variant',
        label: 'Стиль',
        options: [
          { value: 'default', label: 'Обычная' },
          { value: 'destructive', label: 'Опасная (удаление)' },
          { value: 'outline', label: 'С обводкой' },
          { value: 'secondary', label: 'Второстепенная' },
          { value: 'ghost', label: 'Прозрачная' },
          { value: 'link', label: 'Как ссылка' },
        ],
      },
      {
        type: 'boolean',
        key: 'disabled',
        label: 'Заблокировать',
        hint: 'Кнопка станет некликабельной и слегка тусклой',
      },
      {
        type: 'number-unit',
        key: 'width',
        label: 'Ширина',
        units: ['px', '%', 'auto'],
        defaultUnit: 'auto',
      },
    ],
  },
  {
    id: 'advanced',
    label: 'Расширенное',
    description: 'Для разработчиков: CSS-классы, meta-теги, data-атрибуты.',
    defaultCollapsed: true,
    fields: [
      {
        type: 'text',
        key: 'class',
        label: 'CSS class',
        mono: true,
        placeholder: 'tailwind-classes...',
      },
      {
        type: 'text',
        key: 'data-id',
        label: 'data-id',
        mono: true,
      },
      {
        type: 'textarea',
        key: 'meta',
        label: 'Meta (JSON)',
        mono: true,
        rows: 4,
        placeholder: '{ "tags": ["submit"] }',
        hint: 'Теги-роли для контроллеров',
      },
    ],
  },
];

const InspectorDemo = Widget(() => {
  const [values, setValues] = createSignal<Record<string, unknown>>({
    label: 'Войти',
    variant: 'default',
    disabled: false,
    width: 'auto',
    class: '',
    'data-id': '',
    meta: '',
  });

  return (
    <div class="grid grid-cols-[360px_1fr] gap-6 p-6 w-full max-w-5xl">
      <div>
        <div class="text-xs uppercase tracking-wide opacity-60 mb-2">Inspector</div>
        <Inspector
          categories={CATEGORIES}
          values={values()}
          onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        />
      </div>
      <div>
        <div class="text-xs uppercase tracking-wide opacity-60 mb-2">Values (live)</div>
        <pre class="text-xs font-mono p-3 border border-white/15 rounded overflow-auto">
          {JSON.stringify(values(), null, 2)}
        </pre>
      </div>
    </div>
  );
});

export default InspectorDemo;
