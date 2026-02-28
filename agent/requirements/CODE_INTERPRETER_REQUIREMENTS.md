# Code Interpreter Requirements

Version: 0.1-draft  
Status: Draft  
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines draft requirements for the desktop code interpreter runtime.

The goal is to preserve Goose-like interpreter behavior while using project-specific platform strategy, especially on Windows.

## 2. Scope

In scope:
- Local code interpreter behavior used by desktop app.
- Shell/process strategy across macOS, Linux, and Windows.
- Environment prerequisites and preflight checks.
- User data and configuration location assumptions.

Out of scope:
- LLM provider behavior.
- Packaging/signing/release distribution mechanics.

## 3. Core Runtime Model

1. The interpreter MUST follow a Goose-like execution model:
   - agent-driven command planning,
   - shell/process execution,
   - tool invocation and output capture.
2. The desktop runtime MUST operate with two cooperating processes:
   - application host process,
   - backend server process.
3. Development workflow MUST start both runtime processes in parallel with a single command.
4. The interpreter MUST support happy-path and error-path execution with deterministic failure handling.
5. The interpreter SHOULD preserve requirement-level compatibility with Goose developer-style workflows where practical.

## 4. Windows Strategy

1. The Windows runtime MUST use a project-specific Windows tool implementation with project-specific prompts.
2. The Windows runtime MUST execute commands via:
   - PowerShell,
   - Git Bash.
3. The Windows runtime MUST support dependency acquisition/checks through WinGet-compatible flow.
4. The Windows runtime MUST NOT require Goose shim strategy as a hard dependency.

## 5. Platform Prerequisites

1. The runtime MUST perform preflight checks before executing interpreter workflows.
2. On Windows, preflight MUST verify availability of:
   - PowerShell,
   - Git Bash,
   - WinGet.
3. If prerequisites are missing, runtime MUST attempt installation via WinGet flow.
4. If auto-install does not restore required prerequisites, runtime MUST return actionable error messages with explicit remediation steps.

## 6. Data and Configuration

1. The interpreter MUST store runtime state under application user data directory.
2. The runtime SHOULD separate:
   - configuration,
   - logs,
   - cache.
3. Configuration path assumptions MUST be stable for the same installed app channel/version unless explicitly migrated.

## 7. Extensibility

1. The interpreter MAY support additional tools in future versions.
2. New tools SHOULD be additive and SHOULD NOT break existing config contracts.
3. Prompt strategy MAY evolve independently per platform as long as runtime contracts remain stable.
