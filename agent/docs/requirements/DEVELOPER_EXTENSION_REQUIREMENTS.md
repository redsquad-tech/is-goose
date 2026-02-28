# Developer Extension Compatibility Requirements for Goose Server

Version: 1.0  
Status: Normative  
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines the compatibility profile for the Goose `developer` extension.

It specifies the externally visible contract required to rewrite the implementation while preserving compatibility with Goose CLI/Desktop runtime behavior, with special emphasis on shell execution flow, protocol semantics, and cross-platform behavior.

## 2. Scope

In scope:
- `developer` extension compatibility in Goose server/runtime.
- MCP protocol and transport behavior for the builtin developer server.
- Tool and prompt compatibility surface.
- Detailed shell execution lifecycle (`shell` tool).
- Cross-platform behavior (Linux/macOS/Windows).
- Optional Docker execution profile.
- Error semantics, security controls, observability, and conformance checks.

Out of scope:
- Changes to Goose core policy model unrelated to `developer`.
- Breaking tool renames or incompatible schema redesign.
- UI rendering concerns not required for protocol compatibility.

## 3. Extension Profile and Activation

The canonical Goose profile for `developer` is a builtin extension activated by name.

Compatibility requirements:
1. A compatible implementation MUST support `developer` as a valid builtin extension identity.
2. A compatible implementation MUST preserve extension lifecycle compatibility through:
   - persisted config (`/config/extensions`),
   - session startup (`/agent/start`),
   - runtime activation/deactivation (`/agent/add_extension`, `/agent/remove_extension`).
3. The extension MUST be exposed through MCP-compatible runtime plumbing as a server-backed tool provider.

## 4. Protocol and Transport Contract

`developer` MUST behave as an MCP server from Goose runtime perspective.

Normative requirements:
1. Transport MUST be MCP-compatible stdio when running as builtin server process/service.
2. MCP lifecycle MUST be supported:
   - `initialize`
   - `notifications/initialized`
3. Capability declarations and method behavior MUST remain consistent and parseable.
4. If tools capability is declared, `tools/list` and `tools/call` MUST be implemented.
5. If prompts capability is declared, `prompts/list` and `prompts/get` MUST be implemented.

## 5. Public Tool and Prompt Surface

For compatibility with current Goose behavior, a conformant implementation SHOULD preserve the current developer tool family:
- `shell`
- `text_editor`
- `analyze`
- `image_processor`
- `list_windows`
- `screen_capture`

The server MUST provide stable request/response schemas for all declared tools within a session.

Tool naming interoperability:
1. Runtime tool inventory exposed to models MAY be owner-prefixed (for example `developer__shell`) by Goose extension manager.
2. The underlying extension tool names (for `tools/call`) MUST remain stable and compatible with runtime routing.

## 6. Session Metadata and Context Propagation

Goose injects request metadata into MCP extensions for session context propagation.

`developer` compatibility requirements:
1. The extension MUST accept and parse:
   - `agent-working-dir`
   - `agent-session-id`
2. Unknown metadata fields MUST be ignored safely.
3. Empty/invalid session metadata values SHOULD be handled gracefully without protocol breakage.

## 7. Shell Invocation Process (Normative, Detailed)

This section defines the required shell execution lifecycle.

### 7.1 Input and pre-validation

1. `shell` MUST require a non-empty `command` string.
2. Empty commands MUST fail with parseable invalid-params error.
3. Implementations MUST apply path restriction checks consistent with `.gooseignore` policy for file-path arguments that resolve to existing paths.
4. Security or policy rejections MUST be explicit and deterministic.

### 7.2 Execution context preparation

Before spawning shell:
1. The implementation MUST resolve working directory from request metadata when provided.
2. The implementation MUST configure execution as non-interactive shell command execution.
3. The implementation MUST set environment for automation-safe behavior, including non-interactive git/editor constraints.
4. If session id metadata exists, implementation SHOULD inject `AGENT_SESSION_ID` into shell environment.
5. If configured, implementation MAY inject shell startup env file behavior for compatible shells (e.g. `BASH_ENV` for bash).
6. If configured, implementation MAY extend `PATH` using shell-derived login environment.

### 7.3 Process spawn and stream behavior

1. Shell command MUST execute as a subprocess and capture both stdout and stderr.
2. stdout and stderr MUST be merged into a combined logical output stream for final response payload.
3. Implementation SHOULD stream incremental output lines to MCP logging notifications.
4. Logging stream failures MUST NOT crash command execution path.

### 7.4 Cancellation contract

1. Active shell requests MUST be cancellable by request id.
2. On cancellation notification:
   - associated execution token MUST be signaled,
   - process termination MUST be attempted immediately.
3. Cancellation result MUST be surfaced as explicit command-cancelled failure.

Platform-specific kill behavior:
1. Unix implementations SHOULD terminate process group (graceful signal then force kill fallback).
2. Windows implementations SHOULD terminate process tree (for example taskkill tree semantics) with fallback kill.

### 7.5 Completion and output shaping

1. Full collected output MUST be subject to deterministic size limits.
2. If output exceeds configured presentation threshold, user-visible output SHOULD be truncated to tail lines with explicit notice.
3. Assistant-facing and user-facing content MAY differ in verbosity, but both MUST remain parseable and deterministic.
4. Tool result payload MUST encode success/failure clearly and consistently.

## 8. Cross-Platform Requirements (Linux, macOS, Windows)

### 8.1 Common cross-platform requirements

1. Behavior MUST remain protocol-compatible across all supported OS targets.
2. Error categories and payload shape MUST be consistent across OS variants.
3. Cancellation semantics MUST be implemented on all OS targets.
4. Path handling MUST avoid unsafe traversal and respect ignore policy.

### 8.2 Linux / macOS requirements

1. Shell selection SHOULD use user/system shell environment with safe fallback.
2. Command invocation SHOULD use shell `-c` style execution for one-shot commands.
3. Unix process group support SHOULD be used for robust cancellation.
4. Unix line-ending normalization SHOULD be preserved for text editor operations.

### 8.3 Windows requirements

1. Shell detection SHOULD prioritize:
   - `pwsh`
   - `powershell`
   - fallback `cmd`
2. PowerShell invocation SHOULD use non-interactive/no-profile flags.
3. Windows subprocesses SHOULD run without opening visible console windows where supported.
4. Windows absolute path semantics (drive and UNC) MUST be handled correctly.
5. Windows-specific env expansion patterns (for example `%USERPROFILE%`) SHOULD be supported where relevant.
6. CRLF normalization SHOULD be preserved for text editing behavior.

### 8.4 macOS-specific path nuance

If implementation includes screenshot/image path normalization logic, it SHOULD handle known macOS filename edge cases (including Unicode spacing variants) in a backward-compatible manner.

## 9. Docker Execution Profile (`MAY`)

Docker support for `developer` is optional.

If implemented:
1. Runtime MAY start `developer` through container execution (for example `docker exec` model).
2. Protocol/tool behavior visible to Goose client/runtime MUST remain equivalent to non-Docker behavior.
3. Error semantics MUST remain compatible and actionable.
4. Absence of Docker support MUST NOT fail baseline conformance.

## 10. Error Semantics

A compatible implementation MUST preserve machine-parseable, deterministic errors for:
1. Invalid parameters (empty/malformed tool input).
2. Policy restriction failures (`.gooseignore`, disallowed access).
3. Spawn/setup failures (shell executable not found, process setup errors).
4. Runtime execution failures (non-zero command behavior surfaced to caller).
5. Cancellation outcomes.
6. Output limit violations.

Error messages SHOULD be actionable and stable enough for diagnostics and tests.

## 11. Security and Safety Requirements

1. `developer` MUST enforce ignore-policy restrictions for protected paths.
2. Execution environment MUST discourage/disable interactive editor and interactive git prompt flows in non-interactive context.
3. Shell execution MUST NOT rely on TTY interactivity.
4. Unsafe path traversal or symlink-escape style operations in editor flows MUST be blocked or rejected deterministically.
5. Sensitive values (secrets/tokens) MUST NOT be emitted in telemetry beyond existing policy allowances.

## 12. Observability Requirements

Minimum expectations:
1. Structured logs/events for:
   - shell start,
   - shell completion,
   - shell cancellation,
   - spawn/setup errors.
2. Real-time shell output logging notifications SHOULD include structured fields:
   - output type marker,
   - stream source (stdout/stderr),
   - output text chunk.
3. Implementations SHOULD provide measurable counters/latency for shell calls and cancellation outcomes.

## 13. Performance and Reliability Requirements

1. Shell invocation overhead SHOULD remain low and deterministic for short commands.
2. Long-running commands MUST be cancellable and not leak subprocesses.
3. Repeated shell executions within sessions MUST NOT accumulate orphaned process tracking state.
4. Tool behavior under high-output scenarios MUST remain bounded by explicit limits.

## 14. Acceptance Scenarios (Required)

A conformant rewrite MUST pass at least:

1. Lifecycle/protocol:
   - successful initialize/initialized sequence,
   - tools and prompts list/get/call compatibility.
2. Shell happy path:
   - command execution with combined output,
   - metadata-based working dir propagation.
3. Shell validation failures:
   - empty command rejection,
   - restricted path access rejection.
4. Shell cancellation:
   - request cancellation terminates command promptly,
   - no lingering tracked process entry after completion.
5. Output bounds:
   - output cap enforcement,
   - deterministic truncation behavior for large output.
6. Cross-platform compatibility:
   - shell selection and invocation behavior validated per OS profile.
7. Docker optional profile:
   - if implemented, behavior parity with non-docker mode.

## 15. Conformance Checklist

Before claiming conformance to this profile, verify:
1. `developer` builtin extension is discoverable and activatable.
2. MCP lifecycle and capability-gated methods are implemented correctly.
3. Tool and prompt schemas are session-stable and parseable.
4. Session metadata (`agent-working-dir`, `agent-session-id`) is handled correctly.
5. Shell execution flow matches Section 7 end-to-end requirements.
6. Cancellation semantics are implemented and tested.
7. Cross-platform requirements for Linux/macOS/Windows are satisfied.
8. Optional Docker mode (if present) preserves protocol and behavior parity.
9. Error semantics are deterministic and machine-parseable.
10. Security restrictions (`.gooseignore`, non-interactive safety guards) are enforced.

## 16. Source Anchors

Reference behavior anchors:
- `crates/goose-mcp/src/developer/rmcp_developer.rs`
- `crates/goose-mcp/src/developer/shell.rs`
- `crates/goose-mcp/src/developer/paths.rs`
- `crates/goose-mcp/src/mcp_server_runner.rs`
- `crates/goose-server/src/state.rs`
- `crates/goose-server/src/main.rs`
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/agents/mcp_client.rs`
- `crates/goose/src/session_context.rs`
