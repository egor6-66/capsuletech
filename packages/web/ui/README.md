# @capsuletech/web-ui

UI-kit Capsule: примитивы (Button, Input, Field, Card, Layout, List, Navigation, Separator, Slot, Toggle, Typography, Label, Wrappers). Solid + CVA + кастомный `createStyle`. Импортируются в Entity через `@capsuletech/web-core/ui-kit/imports.tsx` (lazy-обёртки).

Subpath-exports на каждый компонент: `import { Button } from '@capsuletech/web-ui/button'` — для tree-shaking и точечной загрузки. Корневой barrel `@capsuletech/web-ui` экспортирует всё.

Документация — в Obsidian-vault'е:

- `docs/09-packages/ui.md` — обзор пакета, контракт «UI is a Shadow», взаимодействие с UiProxy.

Сборка: `pnpm nx build @capsuletech/web-ui` (Vite через `@capsuletech/lib-builder`, multi-entry per-component + кастомный `remapPrimitivesDtsPlugin` для слияния `src/primitives/` и `src/components/` в один плоский `dist/components/`).
Storybook: `pnpm --filter @capsuletech/web-ui storybook` (dev, порт 6006).
