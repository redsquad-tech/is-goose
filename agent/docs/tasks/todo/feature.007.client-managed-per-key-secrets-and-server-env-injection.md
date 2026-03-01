---
ID: 7
Title: Desktop security, Move to client-managed per-key secrets and env-only server boot
Complexity: high
---

# Desktop security, Move to client-managed per-key secrets and env-only server boot

## 1. Executive Summary

**Abstract:**  
Нужно внедрить хранение секретов в desktop-клиенте по модели per-key, убрать серверное управление секретами и перевести сервер на env-only конфигурацию. Desktop main должен стартовать backend-процесс с env, собранным из client-side secret store, и перезапускать сервер при изменении секретов.

**Objectives (SMART):**
- **Specific:** Реализовать client-managed secret store, env injection в backend spawn, и унифицированный lifecycle старта server из main.
- **Measurable:** Появляются IPC методы для metadata-only управления секретами; сервер получает секреты только через env; тесты покрывают mapping и restart flow.
- **Achievable:** Реализуется в текущем Electron + TypeScript стеке.
- **Relevant:** Упрощает контракт и изолирует секреты от server API слоя.
- **Time-bound:** Один полный инженерный цикл.

## 2. Context & Problem Statement

### Current State

- Секреты пока не выделены в отдельный client-side слой.
- Dev lifecycle запускает server отдельно от desktop main.
- Server runtime не получает централизованный env snapshot из desktop secret store.

### The "Why"

Требуется строгий контракт: секреты живут в клиенте, сервер работает только с env. Это упрощает безопасность и делает поведение dev/prod единообразным.

### In Scope

- Secret store в desktop main (per-key).
- Fallback policy при проблемах secure backend.
- Deterministic key->env mapping.
- Backend restart на secret change.
- Унификация dev/prod запуска server из main.
- Тесты и docs updates.

### Out of Scope

- Полноценный чатовый интерфейс управления секретами.
- Авто-ротация ключей.
- Удаленный secret management сервис.

## 3. Proposed Technical Solution

### Architecture Overview

1. Desktop main хранит секреты per-key в primary secure backend.
2. Если secure backend недоступен, автоматически включается fallback env-export file.
3. При старте backend main собирает env из:
   - базовых runtime env,
   - mapped per-key secret env.
4. При изменении секрета main перезапускает backend с новым env snapshot.
5. Renderer получает только metadata/status API, без plaintext secret values.

### Interface Changes

- New IPC contract:
  - `secrets:status`
  - `secrets:list`
  - `secrets:upsert`
  - `secrets:remove`
  - event `secrets:changed`
- `desktop:get-state` расширяется полями:
  - `secretBackend`
  - `serverRestarting`

### Project Code Reference

- `src/desktop/main/index.ts`
- `src/desktop/main/secrets/*`
- `src/desktop/shared/api.ts`
- `src/desktop/preload/index.ts`
- `tests/secrets.*.test.ts`
- `tests/e2e/desktop.smoke.spec.ts`

## 4. Requirements

- `MUST` хранить секреты в desktop client-side secret store по модели per-key.
- `MUST` не передавать plaintext secret values в renderer.
- `MUST` запускать backend server только из desktop main в dev и packaged режимах.
- `MUST` передавать секреты в server только через env на этапе spawn.
- `MUST` использовать deterministic mapping для env имен:
  - `provider.*`
  - `sftp.*`
  - `mcp.system.*`
  - `mcp.ext.<id>.*`
- `MUST` перезапускать backend после `secrets:upsert` и `secrets:remove`.
- `MUST` поддерживать fallback `secrets.env` при недоступности secure backend.
- `SHOULD` вести metadata-only аудит операций с секретами.
- `SHOULD` возвращать детерминированный статус backend restart в desktop state.
- `WON'T` добавлять авто-ротацию секретов в рамках задачи.

## 5. Acceptance Criteria

- `MUST` IPC secrets API работает без раскрытия значений секретов в renderer.
- `MUST` backend получает ожидаемые env переменные из per-key storage.
- `MUST` изменение секрета вызывает restart backend и восстановление health.
- `MUST` dev режим не требует отдельного запуска `src/server/index.ts`.
- `MUST` тесты `npm run test` проходят с новыми unit/e2e сценариями.
