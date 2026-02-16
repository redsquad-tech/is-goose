# PRD: InsightStream Demo Desktop (macOS) + RU Localization

## 1. Контекст

Нужно собрать демонстрационный дистрибутив desktop-приложения (Electron) для конференции, который:

- запускается сразу после скачивания (без ручной настройки провайдера);
- брендирован как **InsightStream goose**;
- использует преднастроенный провайдер **Compressa** (OpenAI-compatible endpoint);
- предустановлен на модель `gpt-5.2-codex`;
- использует API-ключ из CI/CD секрета `OPENAI_API_KEY`;
- имеет русскоязычный UI (RU-first).

Ограничение: делаем максимально просто и через конфиг/дистрибуционный слой, без изменений Rust-ядра.

---

## 2. Цели и не-цели

### 2.1 Цели

- P0: White-label сборка под бренд InsightStream.
- P0: Рабочий провайдер и модель из коробки.
- P0: Инъекция demo API key только на этапе CI-сборки (не хранить в git).
- P0: Русификация desktop UI для ключевых пользовательских потоков.
- P1: Идемпотентный bootstrap (без повторной перезаписи пользовательских настроек каждый запуск).

### 2.2 Не-цели

- Не меняем бизнес-логику/ядро провайдеров в `crates/goose`.
- Не делаем универсальную многоязычную платформу для всего репозитория.
- Не обеспечиваем production-grade защиту demo ключа (для демо допускается компромисс).

---

## 3. Функциональные требования

### FR-1. Брендинг приложения

- Имя приложения: `InsightStream goose`.
- Обновить app metadata, title, menu labels, about labels, desktop launcher labels, имена пакетов/артефактов.
- Подменить иконки для macOS/Windows/Linux-форматов (для унификации сборок).

### FR-2. Преднастроенный провайдер

- Провайдер отображается в UI как `Compressa`.
- Endpoint: `https://openai.bavadim.xyz/v1/chat/completions`.
- Модель по умолчанию: `gpt-5.2-codex`.
- Провайдер должен быть доступен без ручного “Add Custom Provider”.

### FR-3. API key из CI

- Значение ключа берётся из `secrets.OPENAI_API_KEY` в GitHub Actions.
- Ключ не должен попадать в git history.
- Ключ должен быть установлен в конфиг/secret storage при первом запуске.

### FR-4. Русификация UI

- Интерфейс desktop по умолчанию на русском.
- Вся критичная навигация, onboarding, settings, системные меню и ошибки запуска локализованы.
- Допускается fallback на английский для редких/внутренних строк.

---

## 4. Нефункциональные требования

- Идемпотентность bootstrap.
- Минимальные изменения в существующей архитектуре.
- Совместимость с текущим CI workflow macOS bundle.
- Прозрачная диагностика (логирование факта bootstrap и версии дистрибуционного конфига).

---

## 5. Решение (Config-first)

## 5.1 Дистрибуционный манифест

Добавить JSON-манифест, который будет упаковываться в app resources (генерируется на CI):

`ui/desktop/src/distribution/distribution-config.json` (или `ui/desktop/src/distribution/runtime-distribution.json`).

Пример структуры:

```json
{
  "distro_id": "insightstream_demo",
  "distro_version": 1,
  "branding": {
    "app_name": "InsightStream goose",
    "short_name": "InsightStream",
    "protocol": "goose"
  },
  "locale": {
    "default": "ru"
  },
  "provider": {
    "id": "custom_compressa",
    "display_name": "Compressa",
    "engine": "openai",
    "base_url": "https://openai.bavadim.xyz/v1/chat/completions",
    "model": "gpt-5.2-codex",
    "api_key_env": "COMPRESSA_API_KEY",
    "api_key": "__INJECTED_BY_CI__",
    "supports_streaming": true,
    "requires_auth": true
  }
}
```

Принцип: это единственная “точка правды” для кастомизации дистрибутива.

## 5.2 Bootstrap на первом запуске (desktop слой)

В `ui/desktop/src/main.ts` добавить вызов bootstrap после старта `goosed` и до инициализации UI:

1. Прочитать distribution-config из resources.
2. Если bootstrap этой версии уже применён, завершить.
3. Создать `~/.config/goose/custom_providers/custom_compressa.json`.
4. Через API `upsertConfig` выставить:
   - `GOOSE_PROVIDER=custom_compressa`
   - `GOOSE_MODEL=gpt-5.2-codex`
5. Через `upsertConfig` с `is_secret=true` записать:
   - `COMPRESSA_API_KEY=<api_key из distribution config>`
6. Сохранить флаг в `settings.json`:
   - `distributionBootstrap.insightstream_demo.version=1`
   - `distributionBootstrap.insightstream_demo.applied=true`

Важно:

- Не перезаписывать пользовательский выбор провайдера, если уже явно настроен другой провайдер.
- Не перезаписывать секрет, если уже есть пользовательский key и `force=false`.

## 5.3 Кастомный provider (без core изменений)

Используем существующий declarative provider формат.

Файл провайдера:

`~/.config/goose/custom_providers/custom_compressa.json`

```json
{
  "name": "custom_compressa",
  "engine": "openai",
  "display_name": "Compressa",
  "description": "Compressa OpenAI-compatible endpoint",
  "api_key_env": "COMPRESSA_API_KEY",
  "base_url": "https://openai.bavadim.xyz/v1/chat/completions",
  "models": [
    { "name": "gpt-5.2-codex", "context_limit": 128000 }
  ],
  "supports_streaming": true,
  "requires_auth": true
}
```

---

## 6. Русификация Desktop

Сейчас в проекте нет готового i18n framework. Для быстрого демо:

### 6.1 Минимальная i18n-архитектура

- Добавить:
  - `ui/desktop/src/i18n/ru.json`
  - `ui/desktop/src/i18n/en.json`
  - `ui/desktop/src/i18n/index.ts` с функцией `t(key, fallback?)`.
- Источник locale:
  - `distribution-config.locale.default` (для демо `ru`);
  - fallback: `en`.

### 6.2 Где локализуем в P0

- `main.ts`: menu labels, About, File/Edit/Window/Help, уведомления/ошибки запуска.
- onboarding/setup экраны.
- settings навигация и основные кнопки.
- базовые системные сообщения и заголовок окна.

### 6.3 Где допустим fallback на EN в первой итерации

- Редкие диагностические тексты.
- Технические ошибки глубоко в React-компонентах.

---

## 7. Брендинг: технический чеклист

Обновить минимум:

- `ui/desktop/package.json` (`productName`, description, bundle script names/paths).
- `ui/desktop/forge.config.ts` (maker names/bin/id/protocol display).
- `ui/desktop/index.html` (`<title>`).
- `ui/desktop/forge.deb.desktop`, `ui/desktop/forge.rpm.desktop`.
- `ui/desktop/src/main.ts` (About/menus/notification titles/window title).
- `ui/desktop/src/components/GooseSidebar/AppSidebar.tsx` (title prefix).
- `ui/desktop/src/utils/githubUpdater.ts` (asset naming, если используется текущий updater pipeline).

Иконки (замена контента существующих файлов):

- `ui/desktop/src/images/icon.icns`
- `ui/desktop/src/images/icon.ico`
- `ui/desktop/src/images/icon.png`
- `ui/desktop/src/images/icon.svg`
- `ui/desktop/src/images/icon-512.png`
- рекомендуется также:
  - `iconTemplate.png`
  - `iconTemplate@2x.png`
  - `iconTemplateUpdate.png`
  - `iconTemplateUpdate@2x.png`

---

## 8. CI/CD изменения (macOS bundle)

Цель: на этапе `bundle-desktop.yml` подставить ключ в distribution-config перед `npm run bundle:default`.

### 8.1 Инъекция секрета

В reusable workflow добавить secret:

- `OPENAI_API_KEY` (уже существует по условию).

Перед сборкой шаг:

1. Считать шаблон `distribution-config.template.json`.
2. Подставить значение `${{ secrets.OPENAI_API_KEY }}` в поле `provider.api_key`.
3. Сохранить как `ui/desktop/src/distribution/distribution-config.json`.

Важно:

- Не логировать ключ.
- В логах маскировать длину/префикс.

### 8.2 Артефакт

Собираемый артефакт переименовать под бренд:

- `InsightStream-goose-darwin-arm64.zip` (или agreed naming).
- Аналогично обновить пути quick-test (`.../InsightStream goose.app` если меняется binary/app name).

---

## 9. Безопасность и риски

Риск: ключ внутри demo bundle можно извлечь.

Меры снижения:

- Выдать отдельный demo key с жёсткими лимитами и rate limit.
- Ограничить по бюджету и сроку (TTL).
- После конференции сразу ротировать/отозвать ключ.
- По возможности ограничить origin/IP на стороне proxy `openai.bavadim.xyz`.

---

## 10. План реализации

### Этап A (P0): Demo-ready

1. Добавить distribution-config + bootstrap в desktop.
2. Добавить custom provider auto-provisioning.
3. Брендинг названий/иконок.
4. Базовая RU локализация (меню + onboarding + settings core).
5. CI инъекция `OPENAI_API_KEY`.
6. Smoke test на чистом профиле пользователя.

### Этап B (P1): Полная русификация

1. Покрыть оставшиеся UI-строки.
2. Добавить check на “непереведённые ключи”.
3. Добавить snapshot/e2e тест на RU locale.

---

## 11. Критерии приёмки (Acceptance Criteria)

- На чистой macOS машине:
  - приложение запускается без setup wizard провайдера;
  - выбран провайдер `Compressa`;
  - модель `gpt-5.2-codex`;
  - первый запрос работает сразу;
  - UI на русском для ключевых экранов;
  - название и иконка соответствуют `InsightStream goose`.
- В git отсутствует API key.
- В CI ключ берётся из `secrets.OPENAI_API_KEY`.
- Bootstrap не ломает существующие пользовательские настройки при повторных запусках.

---

## 12. Definition of Done

- PR с изменениями desktop/UI + workflow.
- Все проверки проекта проходят (fmt/clippy/tests + desktop lint/tests где применимо).
- Подтверждён smoke test демо-артефакта на чистом user profile.

---

## 13. Технический Implementation Plan

Ниже план реализации, ориентированный на минимальные правки и config-first подход.

### 13.1 Шаг 1: Distribution Config слой

Цель: централизовать кастомизацию дистрибутива в одном JSON.

Изменения:

1. Добавить файл-шаблон:
   - `ui/desktop/src/distribution/distribution-config.template.json`
2. Добавить runtime-файл (генерируется CI):
   - `ui/desktop/src/distribution/distribution-config.json` (в `.gitignore` или с placeholder без ключа)
3. Добавить типы и loader:
   - `ui/desktop/src/distribution/types.ts`
   - `ui/desktop/src/distribution/loadDistributionConfig.ts`

Содержимое (P0):

- branding (`app_name`, `short_name`);
- locale (`default=ru`);
- provider (`custom_compressa`, url, model, api_key_env, api_key).

### 13.2 Шаг 2: Bootstrap первого запуска

Цель: на чистом профиле автоматом создать provider + config + secret.

Изменения:

1. В `ui/desktop/src/main.ts`:
   - добавить вызов `applyDistributionBootstrap(...)` после старта `goosed` и до рендеринга окна.
2. Добавить модуль bootstrap:
   - `ui/desktop/src/distribution/bootstrap.ts`

Логика `applyDistributionBootstrap`:

1. Прочитать distribution-config.
2. Проверить флаг `distributionBootstrap.<distro_id>.version` в `settings.json`.
3. Если уже применено и версия совпадает -> `return`.
4. Создать файл provider:
   - `~/.config/goose/custom_providers/custom_compressa.json`.
5. Через API-конфиг (`/config/upsert`) установить:
   - `GOOSE_PROVIDER=custom_compressa` (`is_secret=false`);
   - `GOOSE_MODEL=gpt-5.2-codex` (`is_secret=false`);
   - `COMPRESSA_API_KEY=<api_key>` (`is_secret=true`).
6. Записать флаг applied/version в settings.

Идемпотентность:

- не перетирать `GOOSE_PROVIDER`, если пользователь уже явно настроил другой провайдер;
- не перетирать секрет, если он уже установлен и не включён force mode.

### 13.3 Шаг 3: Брендинг (app name + labels + артефакты)

Цель: визуально и системно превратить Goose в InsightStream goose.

Обязательные правки:

1. `ui/desktop/package.json`
   - `productName`, `description`;
   - bundle script paths/names (`Goose` -> `InsightStream goose` согласованно с forge output).
2. `ui/desktop/index.html`
   - `<title>InsightStream goose</title>`.
3. `ui/desktop/forge.config.ts`
   - maker `name`, `bin`, `id`;
   - protocol display name;
   - проверить совместимость путей output.
4. `ui/desktop/forge.deb.desktop`
5. `ui/desktop/forge.rpm.desktop`
6. `ui/desktop/src/main.ts`
   - About/menu/window/error titles.
7. `ui/desktop/src/components/GooseSidebar/AppSidebar.tsx`
   - префикс заголовка окна/секции.
8. `ui/desktop/src/utils/githubUpdater.ts`
   - asset naming, если остаётся GitHub updater.

### 13.4 Шаг 4: Иконки

Цель: заменить все platform icons без изменения кода.

Заменить файлы:

- `ui/desktop/src/images/icon.icns`
- `ui/desktop/src/images/icon.ico`
- `ui/desktop/src/images/icon.png`
- `ui/desktop/src/images/icon.svg`
- `ui/desktop/src/images/icon-512.png`
- (рекомендуется) `iconTemplate*.png`, `iconTemplateUpdate*.png`.

### 13.5 Шаг 5: RU локализация (минимально инвазивно)

Цель: RU-first без тяжёлой миграции на крупный i18n фреймворк.

Изменения:

1. Добавить:
   - `ui/desktop/src/i18n/ru.json`
   - `ui/desktop/src/i18n/en.json`
   - `ui/desktop/src/i18n/index.ts` (`t(key)` + fallback).
2. В `main.ts` заменить хардкод-строки меню/уведомлений через словарь.
3. В ключевых React-компонентах:
   - onboarding/provider setup;
   - settings main labels;
   - critical action buttons/toasts.
4. Источник locale:
   - `distribution-config.locale.default`, fallback `en`.

### 13.6 Шаг 6: CI/CD (macOS workflow)

Цель: инъекция ключа из секрета в runtime config до сборки.

Файл:

- `.github/workflows/bundle-desktop.yml`

Изменения:

1. В `workflow_call.secrets` добавить:
   - `OPENAI_API_KEY` (required: false/true по политике).
2. Перед `npm run bundle:default` добавить шаг:
   - читать `distribution-config.template.json`;
   - подставить `${{ secrets.OPENAI_API_KEY }}` в `provider.api_key`;
   - записать `distribution-config.json`.
3. Добавить защиту:
   - fail-fast, если secret пустой (для demo pipeline).
4. Не печатать значение в логи.

### 13.7 Шаг 7: Тестирование и валидация

Локально:

1. `source bin/activate-hermit`
2. `cargo build --release -p goose-server`
3. `cd ui/desktop && npm ci`
4. `npm run lint:check`
5. `npm run test:run`
6. `npm run bundle:default` (или `npm run make`)

Сценарий приемки на чистом профиле:

1. Удалить/изолировать `~/.config/goose`.
2. Запустить `.app`.
3. Проверить:
   - RU интерфейс;
   - провайдер `Compressa`;
   - модель `gpt-5.2-codex`;
   - первый запрос успешен без ручного ввода ключа.

### 13.8 Шаг 8: Роллбэк план

Если bootstrap ломает запуск:

1. Фича-флаг в distribution-config:
   - `"bootstrap_enabled": false`
2. При `false` приложение работает как обычный Goose.
3. Быстрый rollback в CI: собрать без distribution-config runtime.
