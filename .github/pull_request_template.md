## Что меняется

<!-- Короткое описание: что и зачем. Не повторяй diff, объясни мотив. -->

## Тип

- [ ] feat — новая функциональность
- [ ] fix — багфикс
- [ ] refactor — рефакторинг без поведенческих изменений
- [ ] docs — только документация
- [ ] chore / build / ci — рутина, инфра, сборка

## Чек-лист

- [ ] Ветка названа по схеме `<type>/<scope>/<slug>` (например `feat/cli/git-release`)
- [ ] Коммиты в Conventional Commits (`type(scope): subject`)
- [ ] `pnpm lint` проходит локально
- [ ] Если меняется поведение пакета — добавлен changeset (`pnpm changeset`)
- [ ] Если правил wrapper в `core/wrappers` — обновил доку в `docs/07-binding/`
- [ ] Если правил vite-плагин — обновил `docs/08-system/vite-plugins.md`
- [ ] Нет секретов / `.env` / временных файлов в diff

## Связанные ADR / issue

<!-- Ссылка на ADR в docs/01-architecture/adr/ или GitHub-issue. -->
