# Desktop Packaging Requirements

Version: 0.1-draft  
Status: Draft  
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines minimal packaging requirements for desktop distribution.

The primary objective is a simple local packaging workflow for 3 target OSes.

## 2. Packaging Baseline

1. Desktop packaging MUST use Electron Forge.
2. Desktop packaging integration for current stage MUST be implemented in the project root.
3. Desktop application source files MUST live under `src/desktop`.
4. Packaging workflow MUST remain local-first for current stage.
5. CI/CD requirements MUST NOT be part of this stage.

## 3. Target Platforms and Installers

1. The packaging setup MUST support local installer generation for:
   - macOS,
   - Windows,
   - Linux.
2. Installer formats MUST be:
   - macOS: `dmg`,
   - Windows: `msi`,
   - Linux: `deb` and `rpm`.
3. Additional formats MUST NOT be added for this stage unless required by a new requirement.

## 4. Build Targets (Minimal Command Surface)

The local workflow MUST expose only minimal platform targets:
1. `desktop:make:mac`
2. `desktop:make:win`
3. `desktop:make:linux`

Extra packaging targets SHOULD NOT be added at this stage unless required by a concrete requirement.

## 5. Development Runtime

1. Development mode MUST start server and Electron in parallel from one command.
2. Development mode MUST validate availability of both processes during startup.

## 6. Runtime Payload and User Data

1. Packaged app MUST include required backend runtime binary.
2. On first run, app MUST create user-scoped data directories for:
   - config,
   - logs,
   - cache.
3. Packaging/runtime setup MUST align with:
   - `requirements/CODE_INTERPRETER_REQUIREMENTS.md`

## 7. Windows Interpreter Assumptions

1. Windows desktop runtime MUST use project-specific interpreter tooling and prompts.
2. Windows execution flow MUST support:
   - PowerShell,
   - Git Bash,
   - WinGet dependency flow.
3. Goose shim strategy MUST NOT be required by packaging baseline.
4. Windows runtime MUST perform preflight checks for required interpreter prerequisites.
5. If prerequisites are missing, runtime MUST attempt automatic installation through WinGet flow.
6. If automatic installation fails, interpreter features MUST fail fast with actionable error messages.
