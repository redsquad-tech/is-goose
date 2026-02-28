# Inline Python Compatibility Requirements for Goose Server

Version: 1.0  
Status: Normative  
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines the compatibility profile for Goose `inline_python` extensions.

It specifies externally visible behavior required for a Goose-compatible server/runtime that supports rewriting the implementation without breaking existing CLI/Desktop flows, recipes, and extension configuration.

## 2. Scope

In scope:
- `ExtensionConfig` contract for `type: "inline_python"`.
- Runtime execution model and lifecycle.
- MCP protocol behavior and transport expectations.
- Error handling and compatibility-facing security controls.
- Non-functional requirements (reliability, observability, performance).
- Conformance checklist and acceptance scenarios.

Out of scope:
- Renaming `inline_python` to `python_inline`.
- New extension types or schema-breaking changes.
- UI-level behavior unrelated to extension compatibility.

## 3. Canonical Configuration Contract

A compatible implementation MUST accept and preserve the following config shape for inline Python extensions:

```json
{
  "type": "inline_python",
  "name": "string",
  "description": "string",
  "code": "string",
  "timeout": 120,
  "dependencies": ["string"],
  "available_tools": ["string"]
}
```

Normative field rules:
1. `type` MUST be exactly `inline_python`.
2. `name` MUST be required and non-empty.
3. `description` MUST be required at runtime config level.
4. `code` MUST be required and non-empty.
5. `timeout` MAY be null/omitted. When omitted, default extension timeout policy MUST apply.
6. `dependencies` MAY be null/omitted. Null and omitted MUST be treated as empty dependency list.
7. `available_tools` MAY be omitted. Omitted or empty list MUST mean all discovered tools are available.

Recipe compatibility requirement:
1. Recipe decoding MAY allow omitted/null `description`; if so, it MUST normalize to empty string before runtime.

## 4. Runtime Execution Contract

Inline Python MUST execute as a local child-process MCP server over stdio transport.

Compatible launcher behavior MUST be equivalent to:
- `uvx --with mcp [--with <dependency> ...] python <temporary_script_path>`

Normative runtime requirements:
1. Implementation MUST materialize `code` into a temporary Python file before process start.
2. Implementation MUST invoke `uvx` with mandatory dependency `mcp`.
3. Each entry in `dependencies` MUST be appended as additional `--with <dependency>`.
4. The child process working directory MUST follow the same policy as stdio extensions:
   - use explicit session working directory when available,
   - otherwise use the current process working directory fallback.
5. Process stdout MUST be reserved for MCP protocol traffic.
6. Process stderr SHOULD be captured for diagnostics and error propagation.
7. Temporary artifacts MUST be cleaned up when extension state is dropped/removed/fails to initialize.

## 5. MCP Protocol and Tool Surface

Inline Python extensions are MCP clients from Goose runtime perspective and MUST follow capability-driven MCP behavior.

Required behavior:
1. Runtime MUST complete MCP lifecycle (`initialize` then `notifications/initialized`) before considering extension active.
2. Tool discovery MUST flow through standard MCP `tools/list`.
3. Tool invocation MUST flow through standard MCP `tools/call`.
4. `available_tools` filtering MUST be applied exactly as for other extension types:
   - empty list means no filtering,
   - non-empty list means allow only listed tool names.
5. Inline Python tools MUST remain interoperable with:
   - `GET /agent/tools`
   - `POST /agent/call_tool`
   - conversation loop through `POST /reply`.

## 6. API Compatibility Requirements

A compatible Goose server MUST accept `inline_python` entries unchanged on:
1. `POST /config/extensions`
2. `GET /config/extensions`
3. `POST /agent/start` (`extension_overrides`)
4. `POST /agent/add_extension`

A compatible server MUST expose failures in a deterministic, parseable API error shape, and MUST NOT silently mutate the extension type or field names.

## 7. Error Semantics

Implementations MUST map inline Python failures to stable classes that are distinguishable at API/runtime boundaries:
1. Config errors:
   - invalid field shape/type,
   - missing required fields.
2. Setup errors:
   - `uvx` not found,
   - temporary file write failure,
   - dependency resolution/installation failure.
3. Initialization errors:
   - MCP lifecycle handshake failure.
4. Execution errors:
   - tool call errors returned by MCP server.
5. Timeout errors:
   - extension init timeout,
   - tool call timeout if enforced by runtime policy.

Error handling rules:
1. Setup/init failures SHOULD include actionable messages.
2. If stderr is available, it SHOULD be included in error diagnostics.
3. Transport/protocol errors MUST remain machine-parseable.

## 8. Security Requirements

Because inline Python may install and execute Python dependencies, compatible implementations MUST enforce security controls equivalent to other extension launch paths.

Mandatory controls:
1. Dependency security screening MUST run on declared `dependencies` before launch, with explicit deny behavior for known malicious packages/advisories.
2. Unknown or unverifiable dependencies SHOULD fail closed when policy requires strict mode.
3. Environment variable handling MUST follow existing extension security policy:
   - no unsafe env override exceptions specific to inline Python,
   - secret handling policy parity with other extension types.
4. Inline code MUST execute within the same permission/sandbox model used for server-managed child-process extensions.
5. Security failures MUST be surfaced as explicit extension-load errors, not as silent skips.

## 9. Observability Requirements

Implementations MUST emit observable signals for inline Python lifecycle phases.

Minimum telemetry requirements:
1. Structured logs/events for:
   - extension load start,
   - process spawn attempt,
   - MCP init success/failure,
   - timeout,
   - extension removal/cleanup.
2. Error logs MUST include extension key/name and failure class.
3. Metrics SHOULD include:
   - extension load duration,
   - load success/failure counters by failure class,
   - tool call count and latency.

Telemetry MUST NOT leak secret values or sensitive token material.

## 10. Performance and Reliability Requirements

Implementations SHOULD keep inline Python startup and tool execution behavior predictable.

Recommended compatibility targets:
1. Cold startup (new dependency resolution) SHOULD complete within configured timeout budget.
2. Warm startup (cached dependencies) SHOULD be materially faster than cold startup.
3. Repeated add/remove cycles MUST NOT leak child processes.
4. Repeated add/remove cycles MUST NOT leak temp files/directories.
5. Tool discovery and invocation behavior MUST remain deterministic within a single session.

## 11. Rollout and Migration

For rewrite rollout:
1. No config migration is required while `type: "inline_python"` contract remains unchanged.
2. Implementations MAY change internals, but MUST preserve external behavior defined in this document.
3. A staged rollout SHOULD be used:
   - compatibility tests pass in CI,
   - optional feature-flag/canary rollout,
   - default enable only after parity validation.

## 12. Acceptance Scenarios (Required)

A compatible implementation MUST pass at least the following scenarios:

1. Happy path:
   - inline extension loads,
   - tools are discoverable,
   - tools execute successfully.
2. Schema/validation:
   - missing `code` fails deterministically,
   - invalid field types fail deterministically.
3. Dependency handling:
   - no dependencies works,
   - multiple dependencies work,
   - bad dependency produces setup failure.
4. Timeout behavior:
   - init timeout produces timeout-class error.
5. Process failure:
   - early process exit surfaces stderr-backed actionable error.
6. Security:
   - malicious dependency is blocked before execution.
7. Compatibility:
   - existing recipes using `inline_python` remain functional without changes.
8. Cleanup:
   - temp artifacts are removed after extension remove/failure lifecycle.

## 13. Conformance Checklist

Before claiming conformance to this profile, verify:
1. `inline_python` schema is accepted exactly with canonical field names.
2. Runtime launches inline code through `uvx` + MCP stdio semantics.
3. MCP lifecycle is completed before extension activation.
4. `available_tools` filtering behavior matches other extension types.
5. Deterministic error classes/messages are returned for setup/init/timeout/execution failures.
6. Dependency security scanning is applied to inline dependencies.
7. Cleanup of process and temporary artifacts is verified.
8. API endpoints preserve round-trip compatibility for inline extension config.

## 14. Source Anchors

Reference behavior anchors in Goose codebase:
- `crates/goose/src/agents/extension.rs`
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/recipe/recipe_extension_adapter.rs`
- `crates/goose/src/recipe/mod.rs`
- `crates/goose-server/src/routes/config_management.rs`
- `crates/goose-server/src/routes/agent.rs`
- `ui/desktop/openapi.json`
