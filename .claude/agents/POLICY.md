# Capsule Agents — Shared Policy

> Каждый агент в `.claude/agents/` начинает работу с чтения этого файла.
> Здесь живут cross-cutting правила, которые иначе пришлось бы дублировать.

## 1. Boundaries

- У каждого пакета есть **owner** (см. [docs/_meta/agents.md](../../docs/_meta/agents.md) — ownership matrix). Не лезь в чужой пакет своими руками.
- Если задача требует правок в чужой зоне:
  - **Тривиально** (typo, missing export, stale ref, обновление dep до next minor) — можешь сам через `Agent(subagent_type='owner-<package>')` запросить fix. Опиши проблему конкретно.
  - **Нетривиально** (новый API, refactor, breaking change, дизайн-решение) — НЕ ЛЕЗЬ. Напиши главному ассистенту/юзеру: «для X нужно Y в пакете Z; рекомендую делегировать owner-Z». Дальше юзер решит.
- Если ты сам — owner-агент пакета, и в задаче нужен новый API от другого пакета твоей release-группы: согласуй с owner соседнего пакета (через `Agent(subagent_type='owner-X')`).

## 2. Документация

- После любого изменения **синхронизируй документацию**:
  - User-facing: `docs/09-packages/<pkg>.md` или `docs/<topic>.md`.
  - AI anchor (для агентов и Claude): `docs/_meta/<topic>.md`.
  - Per-package README: `packages/<pkg>/README.md` — короткий указатель на оба + npm-summary.
- Если документации ещё нет — создай. Если протухла — почини.
- Стиль и шаблон смотри в [docs-writer.md](./docs-writer.md) (он канон). Если doc-задача большая — делегируй ему.

## 3. Тесты

- **Definition of done = code + tests + docs** в одном PR.
- Pure-логика покрывается unit-тестами (vitest, node env).
- DOM/Solid render — jsdom (см. как сделано в `packages/web/core/src/engine/__tests__/ui-proxy.test.tsx`).
- При исправлении бага — сначала характеризационный тест, который воспроизводит, потом fix.
- Если по сути не тестируемо (только DOM-side-effects, requires real browser) — задокументируй почему в комментарии теста-плейсхолдера.

## 4. Release readiness

- **За релиз пакета отвечает его owner.**
- Перед release owner проверяет (см. [docs/_meta/release-checklist.md](../../docs/_meta/release-checklist.md)):
  - `pnpm nx run-many -t typecheck,test,build` — green.
  - `pnpm audit:exports <pkg>` — bundler-✅.
  - CHANGELOG обновлён.
  - AI anchor + user guide синхронны с кодом.
- Major-bump deps — отдельным PR с явным тестом совместимости.

## 5. Cross-package context (для owner-агентов)

- Owner знает свою **release-группу** из `nx.json:release.groups` — соседи в группе релизятся вместе (fixed-versioning).
- Owner знает кто **consumer** его пакета (через `grep` или `pnpm why`). Изменение публичного API без согласования с consumer'ом — нет.
- При сомнениях — спроси главного ассистента/юзера, не делай sweeping refactor «на удачу».

## 6. Стилистика

- Все user-doc'и в едином стиле: frontmatter с `tags` + emoji-заголовок + section'ы (см. `docs/09-packages/*` как референс).
- Комментарии в коде: lead with `// Why:` для не-очевидных решений. Не дублируй то что код сам говорит.
- Имена файлов: kebab-case для `.md`, camelCase/PascalCase по контексту для TS.

## 7. Делегирование внутри agent-системы

- **Layer-agents** (entity/widget/page/controller/feature/shape) пишут конкретные artifact'ы в `apps/<name>/src/<layer>/`.
- **App-agent** — координатор apps/. Делегирует layer-агентам, не пишет код сам.
- **Owner-agents** (`owner-<package>`) пишут в `packages/<pkg>/`. Не лезут в чужие пакеты (см. п.1).
- **docs-writer** — только в `docs/`. Никуда больше.
- **ui-component** — только в `packages/web/ui/src/components/`. Framework-only.

## 8. Universal vs framework-only

Layer-agents и `app`-агент **универсальны** — попадают в template'ы CLI и копируются в user-workspace при `capsule create workspace`. Не hardcode'ь в них пути на наш `packages/*` (исключение: ссылки на публичные npm-имена типа `@capsuletech/web-core`).

Owner-agents и `ui-component` — **framework-only**, живут только в этом репо.

## Связанное

- [Ownership matrix](../../docs/_meta/agents.md) — package → owner-agent.
- [Release checklist](../../docs/_meta/release-checklist.md) — что делает owner перед релизом.
- [Apps anatomy](../../docs/_meta/apps.md) — для app-агента: что внутри `apps/<name>/`.
