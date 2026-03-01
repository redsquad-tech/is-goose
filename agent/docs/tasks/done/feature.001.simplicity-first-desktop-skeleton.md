---
ID: 001
Title: Simplify First, Unify Backend and Build Minimal React Shell with Settings
Complexity: high
---

# Simplify First, Unify Backend and Build Minimal React Shell with Settings

## 1. Executive Summary

**Abstract:** Rebuild desktop foundation into a compact React shell while removing duplicated backend paths, so migration continues on one clear architecture.

**Objectives (SMART):**
- **Specific:** Move renderer root to `src/desktop`, start React shell, unify backend source to `src/server`, and implement first settings slice.
- **Measurable:** App starts, settings route works, mock backend path is removed, tests pass.
- **Achievable:** Reuses existing Electron Forge/Vite setup with targeted refactor.
- **Relevant:** Removes architectural ambiguity before UI migration slices.
- **Time-bound:** 1 focused implementation iteration.

## 2. Context & Problem Statement

### Current State
- Desktop shell uses legacy vanilla renderer flow.
- Backend path is duplicated conceptually (`src/server` and `src/desktop/backend/mock-backend.mjs`).
- Packaged resources currently rely on mock backend script.

### The "Why"
Goal is Goose-like behavior with less code and less ambiguity. Keeping duplicated backend/runtime paths increases complexity and future migration risk.

### In Scope
- Move renderer root to `src/desktop` and bootstrap React app.
- Remove legacy renderer shell files no longer needed.
- Unify backend source-of-truth to `src/server`.
- Remove mock backend runtime and mock resource preparation path.
- Implement first settings vertical slice:
  - route `/settings`,
  - section tabs UI,
  - fields:
    - `showMenuBarIcon`,
    - `showDockIcon`,
    - `spellcheckEnabled`,
    - `enableWakelock`,
    - `keyboardShortcuts`.
- Implement settings read/save/reset via IPC.
- Build test infrastructure for UI unit/integration and desktop smoke e2e.
- Add unit/integration UI tests and one smoke e2e for settings flow.

### Out of Scope
- Full feature migration.
- Full parity of all goose desktop settings sections.
- Updater/tray/deeplink/sandbox advanced integrations.

## 3. Proposed Technical Solution

### Architecture Overview
- Renderer root becomes `src/desktop` (Vite renderer root updated accordingly).
- React shell entrypoint lives in `src/desktop` and drives route navigation.
- Feature-first structure is kept compact under `src/desktop/features/*`.
- No `shared` directory in this task.
- Main process starts/targets only unified backend path.

### Interface Changes
- Renderer entry switches from vanilla script to React bootstrap.
- Settings IPC surface is formalized for read/save/reset operations.
- Desktop runtime no longer depends on mock backend resource script.

### Project Code Reference
- `src/desktop/main/index.ts`
- `src/desktop/preload/index.ts`
- `src/desktop/*`
- `src/server/*`
- `tests/*`
- `forge.config.ts`
- `package.json`
- `vitest.config.ts`
- `playwright.config.ts`

## 4. Requirements

- MUST move Vite renderer root to `src/desktop`.
- MUST bootstrap React shell with routes at least for `/` and `/settings`.
- MUST unify backend source-of-truth to `src/server`.
- MUST remove runtime reliance on `src/desktop/backend/mock-backend.mjs`.
- MUST remove obsolete shell files and dead resource prep logic.
- MUST implement settings page with section tabs and shell+shortcuts fields.
- MUST implement settings read/save/reset via IPC.
- MUST add UI unit test stack:
  - `@testing-library/react`,
  - `@testing-library/jest-dom`,
  - `@testing-library/user-event`,
  - `jsdom`.
- MUST configure Vitest UI test environment with `jsdom`.
- MUST add desktop smoke e2e stack with `@playwright/test` and minimal Playwright config.
- MUST include UI tests and smoke e2e in `npm run test`.
- MUST add deterministic test helpers for app startup/teardown and fixed test env/timeouts.
- MUST include UI unit/integration tests for settings route.
- MUST include one smoke e2e scenario validating app start and settings persistence flow.
- MUST keep e2e deterministic (no dependency on external network, updater, tray, or OS notification state).
- SHOULD keep folder structure compact and explicit.
- SHOULD avoid introducing `shared` in this task.
- WON'T add advanced system features.

## 5. Acceptance Criteria

- React shell starts from `src/desktop` root.
- `/settings` route works with section tabs and required fields.
- Settings save/reset roundtrip works through IPC.
- Desktop runtime does not use mock backend path/resources.
- Obsolete renderer shell files are deleted.
- UI unit/integration tests run in `jsdom` and pass in `npm run test`.
- Playwright desktop smoke runs in `npm run test` and passes without manual steps.
- `npm run test` passes end-to-end.

## Implementation Notes

- Modified files:
  - `src/desktop/main/index.ts`
  - `src/desktop/preload/index.ts`
  - `src/desktop/renderer/main.tsx`
  - `src/desktop/renderer/ui/desktopApp.tsx`
  - `src/desktop/shared/settings.ts`
  - `src/desktop/shared/api.ts`
  - `src/desktop/renderer/index.html`
  - `src/desktop/renderer/global.d.ts`
  - `tests/desktop.settings.ui.test.tsx`
  - `tests/e2e/desktop.smoke.spec.ts`
  - `tests/testkit.ts`
  - `tests/ui.setup.ts`
  - `package.json`
  - `forge.config.ts`
  - `vitest.config.ts`
  - `playwright.config.ts`
  - `vite.electron.main.config.ts`
  - `vite.electron.preload.config.ts`
  - `vite.electron.renderer.config.ts`
  - `vite.server.config.ts`
  - `tsconfig.json`
  - `knip.json`
- Latest commit hash at implementation time: `8bd52c60c`
