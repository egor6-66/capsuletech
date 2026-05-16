# scripts/

Mini-tooling корня монорепо. Каждый файл начинается с header-блока
(`PURPOSE / USAGE / FLAGS / ...`) — открой его, чтобы понять контекст.

> Агентам: **не плоди новые скрипты здесь без согласования.** Прежде чем
> добавить новый — проверь, не закрывает ли задачу уже существующий
> (особенно `release.mjs` / `release-local.mjs` — это самый частый кейс).

| Файл                  | Назначение                                                         | Триггер                         |
| --------------------- | ------------------------------------------------------------------ | ------------------------------- |
| `release-local.mjs`   | Публикация группы пакетов в локальный Verdaccio. ZERO следов в git и worktree (версии не бампаются, package.json не модифицируются). | `pnpm release:local:*`          |
| `release.mjs`         | **CI only** — PROD-релиз: build → bump → CHANGELOG → commit + tag → publish → git push. Вызывается из `.github/workflows/release.yml` или `.gitlab-ci.yml`. Локально с лэптопа **не запускаем** (нет прод-команд в package.json). | GitHub Actions workflow_dispatch / GitLab CI manual |
| `dev-backend.mjs`     | Запуск Rust-бэка `capsule-server` (`cargo run -p capsule-server`) из корня workspace, cross-platform. | `pnpm dev:backend`              |
| `feature-report.mjs`  | Расход токенов/USD по фиче из Claude Code session-логов (по маркерам `<<feature: slug>> ... <</feature>>`). | `pnpm report` / `report:list` / `report:all` |

## Registry keys (release.mjs)

| `--registry=` | URL                                                  | Auth env                                                |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| `npm`         | `NPM_REGISTRY_NPM` или `https://registry.npmjs.org`  | `NPM_TOKEN`                                             |
| `github`      | `https://npm.pkg.github.com`                         | `GITHUB_TOKEN` (в Actions встроенный)                   |
| `nexus`       | `NEXUS_REGISTRY` env (обязательно)                   | `NEXUS_TOKEN` или `NEXUS_USERNAME` + `NEXUS_PASSWORD`   |
| `gitlab`      | `GITLAB_REGISTRY` env (обязательно)                  | `GITLAB_TOKEN` (`CI_JOB_TOKEN` или PAT)                 |
| `<url>`       | используется как есть                                | нет (внешний `.npmrc`)                                  |

## Соглашения

- **Header-блок обязателен** в каждом скрипте: `PURPOSE / USAGE / FLAGS / WHAT IT DOES / NOT FOR`.
- **Не вызывай `process.exit` внутри `try { ... } finally { ... }`** — Node не выполнит finally. Сохрани статус в переменную и вызови `process.exit` после `finally`.
- **Cross-platform**: `spawnSync('pnpm', ..., { shell: process.platform === 'win32' })`. Без `shell:true` на Windows pnpm/npm не находятся в PATH.
- **Признак "это уже не нужно"**: скрипт стал отсылкой к другому скрипту, или вся его логика покрыта `nx release` / `pnpm` нативно — удалить.

## Release flow коротко

```
DEV (локалка)                    PROD (CI only — Actions / GitLab CI)
─────────────                    ─────────────────────────────────────
release-local.mjs                workflow_dispatch / manual pipeline
  ↓                                ↓
read nx.json groups              node scripts/release.mjs --group=… --registry=…
  ↓                                ↓
clean verdaccio storage          pnpm -r build (фаза 1 + 2)
  ↓                                ↓
pnpm -r build                    nx release <spec> --skip-publish
  ↓                                → bump + CHANGELOG + commit + tag
pnpm publish (текущая версия)      ↓
  → НЕ трогает worktree          setup .npmrc auth (по registry key)
                                   ↓
                                 nx release publish --registry=<url>
                                   ↓
                                 git push --follow-tags
```
