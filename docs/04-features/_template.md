---
tags: [hca, feature, registry]
status: index
---

# 🟨 Features — реестр

> [!info]
> По одной странице на каждую Feature. Имя файла: `<group>-<name>.md`.

## Реестр

> [!todo]
> В коде sandbox пока не реализованы Feature.

## Шаблон карточки

```markdown
---
tags: [hca, feature, <group>]
status: documented
group: <group>
file: apps/<app>/src/features/<group>/<name>.tsx
---

# Feature.<Group>.<Name>

## Назначение
Одно предложение. Какую domain-задачу закрывает Feature.

## Используемые services
| Service | Для чего |
|---|---|
| `router` | навигация |
| `api.<...>` | сетевые вызовы |

## FSM
| Стейт | Хэндлеры | Переходы |
|---|---|---|
| `idle` | `onClick`, `login`, `register` | → `loading` |
| `loading` | `onInit` (start request) | → `idle` или `error` |
| `error` | `onClick` (retry) | → `loading` |

## Принимаемые методы (от Controller через next())
| Метод | Payload | Что делает |
|---|---|---|
| `login` | `{ email, password }` | POST /auth/login |
| `register` | `{ email, password }` | POST /auth/register |

## Side effects
- API: `POST /auth/login`
- Router: `router.goTo('/dashboard')` после успеха
- Store: `setLoading`, `setErrors`

## Compliance
- [ ] Нет импортов других Feature
- [ ] API-вызовы только тут, не в Controller
- [ ] Не знает конкретику Entity/UI

## Связанное
- [[03-controllers/_template|Controllers, которые её вызывают]]
- [[controller-proxy]]
- [[router|@capsuletech/router]]
```
