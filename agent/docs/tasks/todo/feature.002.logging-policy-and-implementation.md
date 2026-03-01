---
ID: 2
Title: Logging observability, Unified policy and implementation
Complexity: medium
---

# Logging observability, Unified policy and implementation

## 1. Executive Summary

**Abstract:**  
The project currently has ad-hoc logging (`console.*`) and no unified policy. We need a single logging approach that is simple, strict, and usable across server and desktop processes, with explicit rules in `AGENTS.md`.

**Objectives (SMART):**
- **Specific:** Introduce one logging framework and one project-wide logging policy.
- **Measurable:** Replace direct `console.*` in runtime paths with shared logger calls; add tests for config/redaction behavior.
- **Achievable:** Implement with minimal new modules and no deep architecture changes.
- **Relevant:** Improves diagnostics, production support, and code consistency.
- **Time-bound:** 1 implementation cycle (single task).

## 2. Context & Problem Statement

### Current State

- Server startup uses `console.log` / `console.error`.
- Desktop runtime had useful temporary diagnostics but no persistent policy.
- `AGENTS.md` does not define logging rules, levels, or data-safety constraints.

### The "Why"

Without standard logging, failures are harder to diagnose, and future LLM-generated code may introduce inconsistent or unsafe logs.

### In Scope

- Add unified logging policy to `AGENTS.md`.
- Add shared logging utility for runtime code.
- Integrate logging into server + desktop runtime paths.
- Add tests for logger behavior (level/config/redaction).

### Out of Scope

- Centralized log shipping (ELK/Loki/etc.).
- Metrics/tracing platform integration.
- CI/CD logging pipeline redesign.

## 3. Proposed Technical Solution

### Architecture Overview

Use `pino` as the single logger framework with a compact structure:
- `src/logging/config.ts` for env defaults and redaction helpers.
- `src/logging/index.ts` exporting logger factory for Node/browser contexts.

Default behavior:
- Dev: pretty logs.
- Prod/Test: JSON logs.
- Output: stdout/stderr.

### Interface Changes

- New env settings:
  - `LOG_LEVEL` (`debug|info|warn|error`)
  - `LOG_PRETTY` (`1|0`)
- New shared logger API:
  - `createLogger(component: string)`
  - Methods: `debug`, `info`, `warn`, `error`

### Project Code Reference

- `AGENTS.md`
- `src/server/index.ts`
- `src/server/app.ts`
- `src/desktop/main/index.ts`
- `src/desktop/preload/index.ts`
- `src/desktop/renderer/main.tsx`

## 4. Requirements

- `MUST` use `pino` as the single logging library in runtime code.
- `MUST` define logging policy in `AGENTS.md`:
  - allowed levels,
  - required structured fields,
  - sensitive-data restrictions,
  - env settings and defaults.
- `MUST` remove direct `console.*` from runtime paths where shared logger can be used.
- `MUST` add best-effort redaction for sensitive keys (`secret`, `token`, `authorization`, `x-secret-key`, `password`).
- `MUST` log key lifecycle points:
  - server startup success/failure,
  - auth rejection warnings,
  - desktop main lifecycle and backend connectivity errors.
- `SHOULD` include `component` and `event` fields in all logs.
- `SHOULD` include `durationMs` for IO-bound operations where available.
- `COULD` add renderer/preload error-surface logs for `unhandledrejection` and global errors.
- `WON'T` add external log aggregation in this task.

## 5. Acceptance Criteria

- `MUST` have a dedicated `Logging Policy` section in `AGENTS.md` including:
  - logger library name,
  - logger settings (`LOG_LEVEL`, `LOG_PRETTY`) and defaults.
- `MUST` pass `npm run test` with no regressions.
- `MUST` have tests validating:
  - logger level/default resolution,
  - pretty/json mode resolution by env,
  - sensitive data redaction.
- `MUST` produce structured logs in server startup and desktop main runtime flows.
- `SHOULD` ensure protected-route auth failures emit `warn` logs without exposing secrets.
- `SHOULD` ensure startup/runtime failures emit `error` logs with safe error metadata.
