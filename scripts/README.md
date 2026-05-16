# scripts/

Mini-tooling корня монорепо. Каждый файл начинается с header-блока
(`PURPOSE / USAGE / FLAGS / ...`) — открой его, чтобы понять контекст.

> Агентам: **не плоди новые скрипты здесь без согласования.** Прежде чем
> добавить новый — проверь, не закрывает ли задачу уже существующий
> (особенно `release.mjs` / `release-local.mjs` — это самый частый кейс).

| Файл                  | Назначение                                                         | Триггер                         |
| --------------------- | ------------------------------------------------------------------ | ------------------------------- |
| `release-local.mjs`   | Публикация группы пакетов в локальный Verdaccio. ZERO следов в git и worktree (версии не бампаются, package.json не модифицируются). | `pnpm release:local:*`          |
| `release.mjs`         | PROD-релиз: bump версий → CHANGELOG → git commit + tag → publish во внешний registry. Требует `--registry=<url>` явно. | `pnpm release:prod:*`           |
| `dev-backend.mjs`     | Запуск Rust-бэка `capsule-server` (`cargo run -p capsule-server`) из корня workspace, cross-platform. | `pnpm dev:backend`              |
| `feature-report.mjs`  | Расход токенов/USD по фиче из Claude Code session-логов (по маркерам `<<feature: slug>> ... <</feature>>`). | `pnpm report` / `report:list` / `report:all` |

## Соглашения

- **Header-блок обязателен** в каждом скрипте: `PURPOSE / USAGE / FLAGS / WHAT IT DOES / NOT FOR`.
- **Не вызывай `process.exit` внутри `try { ... } finally { ... }`** — Node не выполнит finally. Сохрани статус в переменную и вызови `process.exit` после `finally`.
- **Cross-platform**: `spawnSync('pnpm', ..., { shell: process.platform === 'win32' })`. Без `shell:true` на Windows pnpm/npm не находятся в PATH.
- **Признак "это уже не нужно"**: скрипт стал отсылкой к другому скрипту, или вся его логика покрыта `nx release` / `pnpm` нативно — удалить.

## Release flow коротко

```
DEV (локалка)                    PROD (npmjs / nexus)
─────────────                    ──────────────────
release-local.mjs                release.mjs
  ↓                                ↓
read nx.json groups              pnpm -r build (фаза 1 + 2)
  ↓                                ↓
clean verdaccio storage          nx release <spec> --skip-publish
  ↓                                  → bump + CHANGELOG + commit + tag
pnpm -r build (фаза 1 + 2)         ↓
  ↓                              setup .npmrc auth (NPM_AUTH_TOKEN)
pnpm publish (текущая версия)      ↓
  → НЕ трогает worktree          nx release publish --registry=<url>
                                   ↓
                                 git push (руками или CI)
```
