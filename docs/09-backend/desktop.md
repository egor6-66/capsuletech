---
tags: [user-guide, backend, desktop]
audience: external consumer
status: documented
---

# Desktop: запуск приложения в Tauri-окне

> [!info]
> Добавьте Tauri shell к своему Capsule приложению. Результат — native desktop app с web-frontend (макOS/Windows/Linux). Работает через `@capsuletech/desktop` пакет.

## Концепция

Capsule framework изначально создан для web, но веб-интерфейс можно завернуть в desktop shell используя Tauri 2. Это работает благодаря `@capsuletech/desktop` — библиотеке, которая управляет жизненным циклом Tauri приложения. Параметризация — через простую конфигурацию в `capsule.config.ts`. Никаких CLI-флагов или скриптов; фреймворк справляется сам.

На текущий момент (Phase 1) поддерживается single-platform бинарь — он собирается на машине разработчика и работает только на той же OS. Multi-platform distribution появится в Phase 2.

## Установка и настройка

### 1. Установка пакета

```bash
pnpm add @capsuletech/desktop
```

### 2. Настройка capsule.config.ts

Если у вас ещё нет `apps/<app>/capsule.config.ts`, создайте:

```typescript
import { defineCapsuleConfig } from '@capsuletech/vite-builder';

export default defineCapsuleConfig({
  // Стандартная Capsule конфигурация
  devServerPort: 3000,

  // Добавить секцию desktop
  desktop: {
    productName: 'My App',           // имя в заголовке окна
    identifier: 'com.example.myapp', // bundle identifier (должен быть уникален)
    icon: 'src/assets/icon.ico',     // опционально: путь к иконке
    window: {
      // опционально: параметры окна
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'My App', // default = productName
    },
  },
});
```

**Поля `desktop`:**

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `productName` | string | ✅ | Имя приложения (отображается в заголовке окна и package.json) |
| `identifier` | string | ✅ | Bundle identifier (e.g. `com.example.app`). Должен быть уникален. |
| `icon` | string | | Путь к `.ico` или `.icns` файлу относительно `apps/<app>/`. Если не задан — используется стандартная иконка Capsule. |
| `window.width` | number | | Ширина окна в px (default: 1280) |
| `window.height` | number | | Высота окна в px (default: 800) |
| `window.minWidth` | number | | Минимальная ширина (default: 800) |
| `window.minHeight` | number | | Минимальная высота (default: 600) |
| `window.title` | string | | Заголовок окна (default: `productName`) |

## Разработка (dev режим)

Для разработки нужны **два терминала** — один для Vite dev-сервера, один для Tauri shell.

### Терминал 1: Vite dev-сервер

```bash
cd apps/<app>
pnpm dev
```

Заметьте порт на котором запустился сервер (по умолчанию из `devServerPort` в config, обычно 3000-5173).

### Терминал 2: Tauri shell

```bash
capsule desktop dev <app>
```

Например, если ваше приложение называется `sandbox`:

```bash
capsule desktop dev sandbox
```

Tauri окно откроется и подключится к Vite dev-серверу. После этого:
- Правки в коде → автоматический Hot Module Reload (HMR) в окне
- Tauri DevTools доступны через F12

### Первый запуск

Первый запуск может занять 5–15 минут. Вы увидите в логе `Compiling tauri...` — это Rust cargo компилирует Tauri 2.x и зависимости. **Это нормально**, просто ждите.

## Build (production)

### Сборка фронта

Сначала соберите приложение как обычно:

```bash
cd apps/<app>
pnpm build
```

Это создаст `apps/<app>/dist/` с собранными assets.

### Сборка Tauri bundle

```bash
capsule desktop build <app>
```

Результаты лежат в `packages/desktop/native/target/release/bundle/`:

- **Windows:** `.exe` инсталлеры в `msi/` и `nsis/`
- **macOS:** `.dmg` + `.app` в `macos/`
- **Linux:** `.deb` и `.AppImage` в соответствующих папках

Бинарные файлы готовы к дистрибуции.

## Troubleshooting

### ❌ "Секция `desktop` отсутствует в `capsule.config.ts`"

**Решение:** добавьте объект `desktop: { productName: '...', identifier: '...' }` в конфиг (см. раздел "Установка и настройка" выше).

### ❌ "Окно не открывается, no errors в логе"

Проверьте:

1. **Vite dev-сервер запущен?** Откройте в браузере URL который напечатал Vite (обычно `http://localhost:3000`). Если сервер не отвечает → перезапустите его.

2. **Правильный порт в команде?** `capsule desktop dev <app>` автоматически читает `devServerPort` из config'а. Если вы запустили Vite на другом порту → либо измените config, либо передайте URL напрямую (если поддерживается).

3. **Tauri CLI установлен?** Проверьте:
   ```bash
   pnpm exec tauri --version
   ```
   Если ошибка → `pnpm install`.

### ❌ "Tauri build не создал бинарь (bundle/ пустая)"

На Windows это может быть bug с `bundle.targets` merge'ом. Попробуйте:

```bash
# Очистите target
cargo clean --manifest-path packages/desktop/native/Cargo.toml

# Пересоберите
capsule desktop build <app>
```

### ❌ "Override-файл `.tauri.<app>.json` остался в `packages/desktop/native/`"

Процесс `capsule desktop dev|build` завершился неправильно (kill -9 или crash). Файл может быть безопасно удалён вручную — это временный файл для конфигурации. При следующем запуске он будет создан заново.

```bash
# Windows
del packages/desktop/native/.tauri.<app>.json

# macOS/Linux
rm packages/desktop/native/.tauri.<app>.json
```

### ❌ "Tauri prerequisites не установлены"

Tauri требует системные зависимости в зависимости от OS:

**macOS:** Xcode Command Line Tools
```bash
xcode-select --install
```

**Windows:** WebView2 (обычно уже установлен). Если нет:
```
https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

**Linux:** Несколько пакетов:
```bash
# Ubuntu / Debian
sudo apt-get install libgtk-3-dev libwebkit2gtk-4.1-dev libssl-dev

# Fedora
sudo dnf install gtk3-devel webkit2gtk3-devel openssl-devel

# Arch
sudo pacman -S gtk3 webkit2gtk openssl
```

Подробнее: [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### ❌ "`dist/bin/capsule-desktop.exe` отсутствует после install"

**Причина:** Phase 1 собирает бинарь на машине разработчика. Если вы установляете пакет на другой OS (или другой архитектуре) — бинарь несовместим.

**Решение (Phase 1, workaround):**
```bash
# Собрать локально
pnpm --filter @capsuletech/desktop build:native
```

**Долгосрочное:** Phase 2 решит это multi-platform distribution'ом (будут pre-built бинари для каждой OS, автоматический download при install).

## Ограничения (Phase 1)

- ✅ Single-platform — бинарь собирается на вашей OS и работает только на ней
- ✅ Без customization installer'ов — используются defaults из Tauri
- ✅ Без code signing — фаза 3 и позже
- ✅ Без custom Tauri commands/plugins — shell зафиксирован (requests → Phase 2+)

## Roadmap

- **Phase 2:** Multi-platform distribution (матрица бинарей для macOS/Windows/Linux)
- **Phase 3:** Custom installer'ы (`.msi`, `.dmg`, `.AppImage`), code signing для дистрибуции
- **Phase 4 (optional):** Escape hatch для custom Rust кода (`capsule desktop eject`)

## Связанное

- [[017-desktop-package|ADR 017]] — дизайнерские решения и альтернативы
- [[desktop|desktop AI-anchor]] — для контрибьюторов (внутреннее устройство пакета)
- [Tauri 2 документация](https://v2.tauri.app/) — низкоуровневая справка
