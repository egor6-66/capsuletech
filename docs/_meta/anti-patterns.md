---
title: Anti-patterns Catalog — quick-fix vs proper-fix
status: living
last-updated: 2026-05-20
---

# Anti-patterns Catalog

**Каталог костылей, на которые мы наступали.** Каждый: что quick-fix говорит сделать → что proper делает на самом деле. Перед любым "временным решением" — проверь здесь.

> **POLICY п.1:** если решение требует >2 нестабильных шагов / hardcoded paths / silent-fallback'ов — подход в корне неверный.

---

## 🚫 "Добавлю третий path в `@source` на всякий случай"

**Симптом:** Tailwind не сканит классы из соседнего пакета в production install.

**Quick-fix (плохо):**
```css
@source "../../web-ui/dist";              /* workspace dev */
@source "../../../../@capsuletech/web-ui";  /* flat npm */
@source "../../../../.pnpm/**/web-ui";    /* pnpm isolated — на всякий */
@source "../../../../../node_modules/...";  /* ещё для уверенности */
```
Хрупкий matrix relative paths × install layouts. Любой новый layout → +1 path. Если один из путей съест mysterious node_modules — silent skip, классы пропадают, debug часами.

**Proper:** CSS-entry-point живёт **в app**, не в библиотеке. App знает свой layout. CSS в `.capsule/styles.css` (генерится builders scaffold).
- `web-core` НЕ shipping CSS.
- `web-style` НЕ shipping Tailwind entry — только themes (CSS variables).
- App's `.capsule/styles.css.template` имеет `@source "../node_modules/@capsuletech/web-ui"` — relative из known location.

**Когда применить proper:** всегда. Не добавляй n-й `@source` "на всякий случай".

---

## 🚫 "Silent error, exit 0"

**Симптом:** Команда падает, но процесс exit'ит 0 → CI green, реальный bug скрыт.

**Quick-fix (плохо):**
```js
const r = await execa('pnpm', ['install'], { stdio: 'ignore' });
// игнорируем r.exitCode
```
CI не видит failure. Smoke fixture не падает. Bug уходит в prod к первому пользователю.

**Proper:**
```js
const r = await execa('pnpm', ['install'], {
  stdio: isCi() ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  reject: false,
});
if (r.failed) {
  if (!isCi()) process.stderr.write(r.stderr ?? '');
  kit.log.error(`pnpm install failed (exit ${r.exitCode})`);
  process.exit(1);  // ← обязательно
}
```
Output виден (CI) либо буферизуется и flush'ится при failure (TUI). `process.exit(1)` — non-zero exit, CI ловит, не пропускает.

---

## 🚫 "Hardcoded relative path в template"

**Симптом:** Template работает только в workspace главной репы, ломается в любом другом.

**Quick-fix (плохо):**
```json
// apps/<name>/package.json.template
{
  "scripts": {
    "dev": "node ../../packages/cli/bin/capsule.mjs"
  }
}
```
Работает в `<main-monorepo>/apps/<name>/`. **НЕ** работает в `capsule-test/apps/<name>/` или `packages/cli/e2e/fixture/apps/<name>/`. Smoke fixture fail, user-репорт.

**Proper:**
```json
{
  "scripts": {
    "dev": "capsule dev"   // ← через .bin/ shim
  },
  "devDependencies": {
    "@capsuletech/cli": "latest"
  }
}
```
pnpm положит `.bin/capsule` shim → работает где угодно. Workspace-internal apps (sandbox внутри capsule) имеют **отдельный** workflow (см. memory `project_global_cli_stale`), не путать.

---

## 🚫 "Quick patch на одну версию, забуду снять"

**Симптом:** `pnpm.overrides` с pinned version растёт без cleanup.

**Quick-fix (плохо):**
```json
"pnpm": {
  "overrides": {
    "solid-js": "1.9.12",
    "vite": "8.0.13",
    "react": "19.2.5"
  }
}
```
Через 6 месяцев никто не помнит зачем эти overrides. Upstream починили — мы застряли на старой версии.

**Proper:** каждый `pnpm.overrides` имеет запись в `docs/_meta/dep-overrides.md`:
```markdown
## solid-js: 1.9.12

- **Что:** pin exact версии.
- **Почему:** dual-package hazard через @kobalte/utils peer-range.
- **Когда снять:** когда @kobalte/utils выпустит peer ^1.9 (issue X).
- **Last-checked:** 2026-05-20.
```

`owner-deps` ревизирует registry ежеквартально. Если запись stale → снимаем.

---

## 🚫 "Lib-builder копирует только мою папку"

**Симптом:** Asymmetric path-config: `dist/template/` для одного плагина, `dist/plugins/X/template/` для другого. `__dirname` runtime ломается.

**Quick-fix (плохо):** добавить ещё один static copy с другим dest — теперь два места для templates.

**Proper:** Единый layout. Vite rolls плагины в `dist/index.mjs` → `__dirname = dist/`. Все templates → `dist/template/<name>.template`. Никаких `plugins/<X>/template/`. Симметрия = predictable runtime resolution.

---

## 🚫 "@source `@package-name` без проверки"

**Симптом:** Тестируешь — не работает. Но в docs / blog post видел что так можно.

**Quick-fix (плохо):**
```css
@source "@capsuletech/web-ui";
```
Полагаешься что Tailwind v4 поддерживает package resolution. **Silently ignored** (он не поддерживает) — classes не сканятся, никакого warning.

**Proper:** Verify capabilities **до** того как полагаешься. `pnpm view tailwindcss` + `cat node_modules/tailwindcss/CHANGELOG.md` + actual test. Если silently ignored — relative path с правильной depth.

---

## 🚫 "Storage пустой? Просто очищу и опубликую снова"

**Симптом:** Verdaccio storage `.verdaccio-db.json` существует, но `@capsuletech/*` версии **пустые**. publish "успешный", но client install видит `Not Found`.

**Quick-fix (плохо):** `rm -rf storage && pnpm publish` — иногда работает, иногда нет.

**Proper:** Понять root cause:
- Was Verdaccio child process **fully started** до publish? (probe :4873 first).
- Uplinks для `@capsuletech/*` **disabled**? (иначе proxy npmjs, видит legacy 0.1.x).
- `npm unpublish` перед `npm publish` (для replace immutable version).
- Verdaccio config storage path = real storage path? Не путать с capsule-test/tmp.

См. `docs/_meta/verdaccio-mental-model.md` (TODO P1).

---

## 🚫 "Я просто перезапущу dev — обычно помогает"

**Симптом:** Vite/HMR держит stale module. F5 не помогает. Сделал rebuild — всё равно old behavior.

**Quick-fix (плохо):** перезапустить, надеяться, иногда работать.

**Proper:** Detect caching layer и почистить **правильный**:
- **Browser cache** — Ctrl+Shift+R (hard reload).
- **Vite `.vite/deps/` pre-bundle** — `rm -rf apps/<name>/node_modules/.vite`.
- **Vite in-memory module cache** — restart `pnpm dev`.
- **pnpm metadata cache** — `pnpm install --force`.
- **pnpm store** — `pnpm store prune` (последняя инстанция).
- **Verdaccio metadata RAM** — restart Verdaccio.

5 разных кэшей. Знай какой проверять для какого симптома.

---

## 🚫 "Workspace-internal pattern в CLI app template"

**Симптом:** Изменение в `apps/sandbox/` (внутри capsule monorepo) → пишешь template такой же → ломаешь external user.

**Quick-fix (плохо):** копируешь script из workspace-internal app в CLI template "for consistency".

**Proper:** Понять **две роли**:
- **Workspace-internal** (`<capsule>/apps/<name>/`): `node ../../packages/cli/bin/...` — это **dev-quirk** + memory `project_global_cli_stale`. Только для framework-developer'а.
- **CLI-scaffolded** (capsule-test, e2e fixture, external user): `capsule dev` через `.bin/` shim. Это **prod-correct**.

См. POLICY п.2 (две роли). См. `docs/_meta/architect-routing.md`.

---

## 🚫 "Сразу пересоберу всё и проверю"

**Симптом:** Не запускаешь smoke перед framework change. После change ломается prod. Не знаешь регрессия это или existing bug.

**Quick-fix (плохо):** "проверю позже". CI не настроен. Никто smoke не запускает регулярно.

**Proper:** **Test-first culture** (POLICY п.6).
```bash
pnpm test:e2e:cli   # baseline (должно быть green до changes)
# make changes
pnpm test:e2e:cli   # diff поведения
```

Делегируй `owner-tests` если сам не хочешь. Без baseline diff не видно — каждый bug new vs existing неразличим.

---

## 🚫 "Главный agent сам поправил packages/* — было быстро"

**Симптом:** "Маленький fix" в одном файле web-ui. Не вижу смысла вызывать owner-web-ui ради одной строки.

**Quick-fix (плохо):** сам правишь. Owner-* не в курсе. OWNERSHIP.md не обновлён. В следующий раз owner-* удивлён.

**Proper:** Даже маленький fix → `Agent(subagent_type='owner-web-ui', prompt='fix line X in Y, reason: Z')`. Owner-* делает + обновляет своё. **Boundary** важнее **speed** — иначе boundaries не работают.

Исключение: главный coordinates **shared infra** (`scripts/`, `nx.json`, root `package.json`, `CLAUDE.md`) — там нет owner-*, твоя зона.

---

## 🚫 "Memory обновлю когда-нибудь"

**Симптом:** Сделал session work, learnings потерялись. Следующий instance повторяет ошибки.

**Quick-fix (плохо):** "запомню". Не запомнишь — у тебя нет persistent state кроме memory + docs.

**Proper:** В конце сессии (или при значительной находке):
- **Memory** — temporal facts (что в работе, blocker, plan).
- **Docs** (`docs/_meta/`, `OWNERSHIP.md`) — stable architectural.

Правило: если факт изменится через неделю — memory. Если стабилен — docs. См. CLAUDE.md POLICY п.7.

---

---

## 🚫 `AutoImport dirs:` сканит generated-registry → cycle через framework

**Симптом:** `Uncaught ReferenceError: Cannot access 'defineEndpoint' before initialization` (TDZ) при загрузке app.

**Quick-fix (плохо):**
Dynamic import обход в одном месте (`app-config.gen.ts → import('./registry/endpoints').then(...)`). Маскирует одну path в cycle'е, но **createApi.ts** (один из re-exports `@capsuletech/web-query`) всё равно статически тянет endpoints через injected import. Cycle не разорван — TDZ остался.

**Корень:** `unplugin-auto-import` с `dirs: [.capsule/registry]` сканирует **named exports** в registry-файлах и экспонирует их глобально (вкл. `endpoints`). Дальше плагин **без scope-analysis** инжектит `import { endpoints }` в любой файл где видит identifier `endpoints` — включая параметр функции в **`packages/web/query/src/createApi.ts`**. Cycle: `auth.ts → web-query → createApi.ts → /registry/endpoints.ts → auth.ts`.

**Proper:** Убрать `dirs:` из AutoImport. Runtime-registry'ы (`Widgets`/`Views`/...) уже ставятся через `Object.assign(globalThis, _registry)` в bootstrap.tsx, TS-типы — из `slots.d.ts` (ExportGeneratorPlugin). AutoImport `dirs:` дублирует это + создаёт катастрофу.

Прецедент: PR #165 (2026-05-27).

---

## 🚫 Nested independent Dropdown'ы → outer закрывается при open inner

**Симптом:** Open trigger inner-dropdown'а закрывает outer menu (`onOutsideClick` в Kobalte). User не видит inner-меню вообще.

**Quick-fix (плохо):**
Дублировать всю логику inner-composite'а inline в outer view — copy `<For>`, items render, setX state mutations. Дублирование, нарушение DRY, dependency на runtime state снаружи View.

**Proper:** Использовать **Kobalte's `Dropdown.Sub` API** — nested submenu подписан на parent's context, не своя focus-trap. Composite должен иметь `mode='standalone' | 'sub'` prop: standalone — own `<Dropdown>` root; sub — `<Dropdown.Sub><SubTrigger>...</SubTrigger><SubContent>{items}</SubContent></Dropdown.Sub>`. Consumer выбирает.

Прецедент: PR #177 (2026-05-28) ThemePicker.

---

## 🚫 `onMount` в lazy widget → flicker при первом open

**Симптом:** При первом открытии меню/sidebar/etc — UI "скачет": тема/mode/настройка вдруг применяется. У пользователя ощущение бага.

**Quick-fix (плохо):**
Eager-mount widget'а в hidden div где-то на page-level (`<div class="hidden"><Ui.Widget /></div>`). Workaround работает, но widget рендерится дважды (один в menu, один hidden) — лишний код в app'е.

**Корень:** Widget читает persisted state в `onMount` и applies его. Lazy-load widget = `onMount` происходит при первом mount (e.g. при open dropdown). Apply виден как "flicker" если state отличается от текущего DOM.

**Proper:** **State-store при import** (module-level), не onMount в widget. Pattern: `const [signal, setSignal] = createSignal(initial())`. Initial читает localStorage и applies сразу. Widget просто subscribe (read-only) + onClick → setter. `onMount` не нужен.

Прецедент: PR #176 (2026-05-28) — split switcher state (web-style stores) vs visual (web-ui composites). `useTheme()`/`useDarkMode()`/`useLayoutMode()` apply on module-load.

---

## 🚫 `as Mock` cast вместо `vi.mocked()`

**Симптом:** TS2348 `Value of type 'Mock<Procedure | Constructable>' is not callable.`

**Quick-fix (плохо):**
```ts
(setTheme as ReturnType<typeof vi.fn>)('black');
(setTheme as ReturnType<typeof vi.fn>).mockClear();
```
Vitest 2+ `vi.fn()` returns Mock<...> union — `as` через ReturnType не callable + `.mockClear()` теряется.

**Proper:**
```ts
vi.mocked(setTheme)('black');
vi.mocked(setTheme).mockClear();
```
`vi.mocked()` это typed helper. Корректно works on `Mock<...>`.

Прецедент: 3 файла в PR #176, fixed inline.

---

## 🚫 Visual компонент в `web-style` использует Dropdown из web-ui → cycle

**Симптом:** При попытке добавить interactive widget с Dropdown UI в `@capsuletech/web-style` — package graph cycle: `web-style → web-ui → web-style`.

**Quick-fix (плохо):**
Inline-дублировать Dropdown HTML/CSS в web-style, или передавать Dropdown через render-prop / Context. Дублирование + scattered logic.

**Proper:** **Split state vs UI**. `web-style` — только signal stores + helpers (CSS, design tokens, apply functions). Visual widgets с Dropdown — `web-ui/composites/`. Web-ui естественно depends on web-style (уже), import hooks оттуда — no cycle.

Прецедент: PR #176 — `DarkModeToggle`/`ThemeSwitcher` переехали из web-style в web-ui/composites; web-style оставляет `useTheme/useDarkMode/useLayoutMode` stores.

---

## 🚫 `createLazy` на compound через `Object.assign(...)` без named sub-exports

**Симптом:** `web-core` хочет `Ui.Compound.SubPart` lazy, но subpath экспортирует только compound: `export const Compound = Object.assign(Impl, { SubPart })`. Без named `export const SubPart = ...` web-core не может lazy-load sub-component'ы через `createLazy(..., 'SubPart')`.

**Quick-fix (плохо):**
В web-core делать lazy chain через `lazy(() => import(...).then(m => ({ default: m.Compound.SubPart })))` — это работает, но **отличается от pattern Table/Card** (где есть named sub-exports). Inconsistent: разные паттерны для разных compound'ов.

**Proper:** В web-ui рядом с compound export'ом добавить **named aliases** для sub-components:
```ts
export const Compound = Object.assign(Impl, { SubPart, ... });
export { SubPart as CompoundSubPart };  // alias для createLazy
```

Web-core unified pattern: `createLazy(() => import('@capsuletech/web-ui/X'), 'CompoundSubPart')`.

Прецедент: PR #174 ThemePicker/Dropdown — owner-web-ui добавил named re-exports `DropdownTrigger/Content/...`.

---

## 🚫 Компонентный `transition-colors duration-fast` НЕ работает на `<button>/<input>/<a>`

**Симптом:** Поменял `--motion-fast` token (или явно `transition-colors duration-fast` в CVA), а кнопки/инпуты/ссылки переключают bg/color всё с прежней скоростью. Computed style показывает `transition: all 250ms ease-out` — никак не отражает наш token.

**Корень:** `packages/web/style/src/index.css` строки ~390–395 содержат **global `!important` rule**:
```css
button, input, a { transition: var(--transition-ui) !important; }
```
`--transition-ui` = `var(--transition-all)` = `all var(--motion-normal) var(--ease-out)`. Этот rule перебивает всё компонентное.

**Proper:** Для тюнинга «плавности» интерактивных элементов крутить **`--motion-normal`**, не `--motion-fast`. Компонентные `duration-fast` действуют только на не-интерактивные элементы (Table rows, Typography spans, List items). Прецедент: сессия 2026-05-28 — bump `--motion-normal` 250→320ms сделал nav-buttons заметно плавнее.

---

## 🚫 `useLocation()` без `select` — не memo'd, ненадёжен для derived-signals

**Симптом:** `<Animate keyed={location().pathname}>` или похожий derived signal не реагирует на смену URL — keyed value не triggers re-mount/recompute.

**Корень:** В TanStack solid-router (`useLocation.js`):
```ts
function useLocation(opts) {
  if (!opts?.select) return (() => router.stores.location.get());
  ...
  return Solid.createMemo(...);
}
```
Без `select` возвращается голый `() => store.get()` — accessor, но **БЕЗ createMemo**. Solid JSX compiler в некоторых местах инлайнит такие в pure value, и subscriber видит фиксированную initial-проекцию.

**Proper:** Для derived pathname/route-state ВСЕГДА брать `useRouterState({ select: s => s.location.pathname })` — оно возвращает `createMemo(...)`, гарантированно tracking. Прецедент: page-transition попытка в сессии 2026-05-28.

---

## 🚫 `<Animate keyed={...}>` не пере-mount'ит Motion в nested reactive scopes

**Симптом:** Поменял `keyed` value (verified reactive), но Motion DOM-нод тот же, opacity не дрожит, exit/enter не отыгрывается.

**Корень не выяснен:** проверено в сессии 2026-05-28 на workspace shell. `props.keyed` реактивно меняется (через `useRouterState({select})`), но `<Show when={props.keyed} keyed>` внутри Animate не re-mount'ит callback. Подозрения: lazy-wrapping `Ui.Animate` (через `createLazy()`) + Solid Suspense, или Presence `resolveFirst` от solid-motionone не находит swap через nested reactive scope. Direct import `Animate` from `@capsuletech/web-ui` тоже не помогло.

**Quick-fix (плохо):** Кастомный fade-signal обход (`<For each={[pathname()]}>` + local FadeIn компонент с opacity-signal). Работает визуально, **но не использует проектную либу анимации** (solid-motionone через Ui.Animate). Не подходит для долгосрочного решения.

**Proper:** Когда задача вернётся — копать solid-motionone Presence + Show keyed flow с **прямым `<Motion>`** (без Animate-обёртки), посмотреть тест что keyed reactivity триггерит. Возможно framework-fix нужен в `@capsuletech/web-ui` Animate (изменить структуру так чтобы Presence resolveFirst видел swap). Прецедент: PR #ewc сессия 2026-05-28, deferred task #12.

---

## 🚫 `maplibre-gl` Map.remove() утечка — ~5MB на mount/unmount цикл

**Симптом:** Каждое появление/исчезновение `<Ui.MapView />` (route-driven mount/unmount) добавляет ~5MB в JS heap. После 5 циклов +24MB. WebGL canvas из DOM уходит, но heap растёт.

**Корень:** Upstream issue в `maplibre-gl` — после `Map.remove()` остаются неосвобождёнными tile worker pool, glyph atlases, sprite caches. `solid-map-gl` (наш wrapper над maplibre) уже зовёт `c?.remove()` в своём `onCleanup`. Defensive дубль `onCleanup(() => map().remove())` в `MapView.tsx` ничего не меняет — проверено в сессии 2026-05-28.

**Mitigation (apps-level):** Если Map mount/unmount часто (route-driven) — держать MapView постоянно смонтированным выше уровня routing, тогглить видимость через CSS (`display: none` или `visibility: hidden`). См. документирующий комментарий в `packages/web/map/src/MapView.tsx`.

---

## 🚫 Apps консумят packages из `dist/`, не из `src/` — HMR не подцепит без rebuild

**Симптом:** Поправил `--motion-fast` token в `packages/web/style/src/index.css`. Reload apps/ewc — token старый. computed style показывает старое значение. HMR не сработал.

**Корень:** В `package.json` packages поля `main`/`exports` указывают на `./dist/index.mjs` и `./dist/index.css`. Apps резолвят `@capsuletech/web-style` → dist. Vite watch'ит файлы внутри своего dep-graph; CSS из dist приходит как обычный import. После правки src, dist не пересобран → app видит старое.

**Proper:** После framework-правок (CSS tokens, JS код) — `pnpm --filter @capsuletech/<pkg> build`. Или поднять `pnpm dev` watcher на пакет в отдельном терминале (`vite build --watch` — это и есть `dev` script у web-style). Прецедент: сессия 2026-05-28 — потерял 10 минут разбираясь почему `--motion-fast: 200ms` в src не отражается в browser, пока не сделал rebuild dist.

---

## 🚫 Имена ориентаций в Tailwind CVA для линий-разделителей легко инвертировать

**Симптом:** Передаёшь `<Group.Separator orientation="vertical">` в горизонтальный `Group` — separator не виден / нулевой ширины. Visual подсказывает что naming инвертирован.

**Корень (исторический баг fixed 2026-05-28):** В `groupSeparatorVariants` имена `horizontal`/`vertical` описывали ОРИЕНТАЦИЮ родительского flex, не визуальной линии. Получалось `orientation='horizontal'` → CSS `h-auto w-px self-stretch` (вертикальная 1×∞ линия). Семантически инвертировано — пользователь думает «вертикальная линия = orientation='vertical'».

**Proper convention для CVA-variant с линиями:** `orientation` параметр должен совпадать с визуальной формой линии:
- `vertical` → `'w-px h-auto self-stretch'` (1×∞, вертикальная)
- `horizontal` → `'h-px w-auto'` (∞×1, горизонтальная)

В `Group` parent's `sepOrientation()` мапит родительскую ось → нужную ориентацию линии (horizontal parent → vertical separator). После fix этот мап остался, но семантика стала прямой. См. regression story `HorizontalAttachedWithVisibleSeparators` в `group.stories.tsx`.

---

## Принципы

1. **Корневой fix дешевле двух quick-fix'ов.** Quick-fix'ы накапливаются и формируют долг технический.
2. **Тестируемое = надёжное.** Если нельзя автоматизировать verify → проверь руками **сразу** после fix'а.
3. **Boundaries — не для красоты.** owner-* пишут код, ты — архитектуру. Нарушение = двойная работа.
4. **Документируй провалы**, а не только успехи. Antipattern catalog растёт.

## Связанные документы

- `CLAUDE.md` — POLICY.
- `docs/_meta/architect-routing.md` — куда делегировать.
- `docs/_meta/dep-management-plan.md` — план dep гигиены.
- `~/.claude/projects/.../memory/MEMORY.md` — persistent learnings.
