# Server Requirements for Goose CLI/Desktop MCP Compatibility

Version: 1.1
Status: Normative
Language conventions: The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

This document defines compatibility requirements for an external MCP server to interoperate with Goose clients (CLI/Desktop) through Goose core.

This is a compatibility contract. It focuses on protocol and interoperability behavior visible to Goose runtime and clients.

## 2. Scope

In scope:
- External MCP servers used as Goose extensions.
- Compatibility with Goose MCP client/runtime behavior.
- Transport compatibility for `stdio` and `streamable_http`.
- Capability-gated requirements for tools/resources/prompts/notifications/callbacks.
- Optional MCP Apps (UI extension) compatibility profile.

Out of scope:
- Goose `platform` tool semantics.
- Provider-specific LLM formatting unrelated to MCP server behavior.

## 3. Protocol Baseline

### 3.1 Supported protocol family

A compatible server MUST implement MCP JSON-RPC lifecycle and method semantics for the protocol version negotiated during `initialize`.

Goose runtime currently negotiates MCP protocol compatible with its client implementation (currently `2025-03-26` in runtime code), and server behavior MUST match the negotiated version.

References:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/index
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle

### 3.2 Mandatory lifecycle

A compatible server MUST:
1. Accept `initialize`.
2. Return `serverInfo`, `capabilities`, and protocol version.
3. Accept `notifications/initialized`.
4. Enforce capability-driven method behavior after initialization.

## 4. Transport Requirements

### 4.1 Transport types accepted by Goose

For Goose interoperability, server transport MUST be one of:
- `stdio`
- `streamable_http`

A server MUST NOT rely on legacy standalone SSE transport behavior for Goose compatibility.

### 4.2 `stdio` requirements

A stdio server MUST:
1. Read protocol requests from stdin.
2. Write protocol responses/notifications to stdout.
3. Keep stdout protocol-clean (non-protocol logs SHOULD go to stderr).
4. Preserve parseable framing for entire session lifetime.

### 4.3 `streamable_http` requirements

A Streamable HTTP server MUST:
1. Implement transport behavior compatible with MCP Streamable HTTP.
2. Preserve lifecycle and capability semantics over HTTP transport.
3. Return parseable protocol errors on auth/validation failures.
4. Keep event/stream framing parseable by strict clients.

Reference:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

## 5. Capability-Gated Method Requirements

Rule: if a capability is declared by the server, required methods for that capability become `MUST`.

### 5.1 Tools capability

If server advertises tools capability, it MUST:
- implement `tools/list`,
- implement `tools/call`,
- keep tool names stable for a session,
- provide parseable, schema-valid tool input definitions.

Server SHOULD provide deterministic error payloads for tool failures.

### 5.2 Resources capability

If server advertises resources capability, it MUST:
- implement `resources/list`,
- implement `resources/read`,
- ensure listed resources are actually readable,
- return consistent resource content typing.

### 5.3 Prompts capability

If server advertises prompts capability, it MUST:
- implement `prompts/list`,
- implement `prompts/get`.

This is required for Goose CLI prompt workflows.

### 5.4 Notifications capability (progress/logging)

If server emits MCP notifications, notification payloads MUST be valid and parseable.

For better Goose UX, server SHOULD emit standards-compliant:
- progress notifications,
- logging notifications.

Unknown notification types MAY be emitted by server, but they SHOULD remain schema-consistent and non-breaking for clients that ignore them.

### 5.5 Server callbacks (sampling / elicitation)

If server requests client-side sampling or elicitation behavior, it MUST do so using MCP callback request semantics compatible with negotiated protocol and capability declarations.

If server does not need these callbacks, it MAY omit this behavior.

## 6. Pagination and Cursor Requirements

For list-style methods (`tools/list`, `resources/list`, `prompts/list`):
1. If pagination is implemented, server MUST return a stable `next_cursor` contract.
2. Reusing a returned cursor MUST produce deterministic continuation behavior.
3. End-of-list MUST be represented consistently (for example, missing/null cursor).

Server SHOULD avoid cursor invalidation within a single short-lived session unless explicitly documented.

## 7. Payload, Schema, and Type Stability

A compatible server MUST:
1. Emit valid JSON only.
2. Preserve field types within an event/method family.
3. Avoid switching a field between scalar and object/array forms for the same semantic slot.
4. Keep tool schema structures valid and parseable.

Server SHOULD avoid ambiguous numeric encoding for semantically integral fields.

## 8. Error Semantics

Server MUST:
1. Return protocol-level errors in parseable MCP/JSON-RPC shape.
2. Distinguish transport-level failure from method-level failure when possible.
3. Include stable machine-readable error codes where available.

Server SHOULD include actionable human-readable messages for invalid parameters/capability mismatches.

## 9. Goose-Specific Interoperability Notes

### 9.1 Extension config mapping expectations

Goose maps external servers as:
- stdio: command (`cmd` + `args`, environment merge)
- streamable HTTP: endpoint `uri` (not `url` in Goose config)

Server documentation SHOULD provide launch examples and env requirements that map to this model.

### 9.2 Session-context metadata tolerance

Goose injects request metadata (for example session/workdir context) via MCP extensions metadata in client requests.

Server MUST ignore unknown metadata fields safely and MUST NOT fail solely due to extra extension metadata.

### 9.3 Inline Python compatibility profile

If a Goose-compatible implementation supports Goose extension type `inline_python` (tool server defined as inline code + dependencies), it MUST conform to:
- `agent/requirements/INLINE_PYTHON_REQUIREMENTS.md`

This requirement is additive to this document and governs schema, lifecycle, security, and runtime compatibility for inline Python extensions.

### 9.4 Developer extension compatibility profile

If a Goose-compatible implementation supports Goose builtin extension `developer`, it MUST conform to:
- `agent/requirements/DEVELOPER_EXTENSION_REQUIREMENTS.md`

This requirement is additive to this document and governs tools/prompts compatibility, shell invocation flow, cross-platform behavior, and optional Docker profile expectations for the developer extension.

## 10. Optional MCP Apps / UI Extension Profile (`MAY`)

This section is optional. A server MAY implement MCP Apps/UI extension behavior.

Reference profile:
- https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx

### 10.1 UI capability advertisement

A server MAY support UI extension capability (`io.modelcontextprotocol/ui`).

If implemented, server SHOULD honor client-declared UI MIME support and SHOULD NOT assume UI capability is always present (Goose Desktop and Goose CLI differ).

### 10.2 UI resources

A UI-capable server MAY expose `ui://` resources.

For HTML app payloads, server SHOULD use MIME profiles compatible with MCP Apps (for example `text/html;profile=mcp-app`).

Server MAY deliver content as text or blob as allowed by MCP resource model.

### 10.3 Tool-to-UI linkage

A server MAY link tools/results to UI resources using extension metadata defined by MCP Apps profile (for example resource URI linkage metadata).

If linkage is used, server SHOULD keep linkage deterministic and consistent with returned resource inventory.

### 10.4 UI fallback requirement

If UI capability is absent on client side, server MUST still behave correctly for non-UI flows (tools/resources/prompts) and MUST NOT hard-fail only because UI rendering is unavailable.

## 11. Conformance Profiles

### 11.1 Minimum profile (tool-first)
- lifecycle compliance,
- one supported transport (`stdio` or `streamable_http`),
- `tools/list` + `tools/call`.

### 11.2 Extended profile
Minimum profile plus:
- `resources/list` + `resources/read`.

### 11.3 Full profile
Extended profile plus:
- `prompts/list` + `prompts/get`.

### 11.4 UI-enhanced profile (optional)
Full profile plus:
- optional UI extension capability and resources per Section 10.

## 12. Validation Checklist for Server Authors

Before claiming Goose compatibility, verify:
1. Server starts cleanly in target transport.
2. Lifecycle (`initialize` + `initialized`) succeeds.
3. Capability declarations match implemented methods.
4. List methods are parseable and pagination semantics are consistent.
5. Tool schemas are strict-client safe.
6. Notifications/callbacks are standards-compliant (if used).
7. STDIO mode emits protocol-only stdout.
8. Streamable HTTP framing is parseable by strict clients.
9. If UI profile is implemented, non-UI fallback works.
10. If `inline_python` is implemented, conformance checks in `INLINE_PYTHON_REQUIREMENTS.md` pass.
11. If `developer` is implemented, conformance checks in `DEVELOPER_EXTENSION_REQUIREMENTS.md` pass.

## 13. References

MCP specification:
- https://modelcontextprotocol.io/specification/2025-06-18/basic/index
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- https://modelcontextprotocol.io/specification/2025-06-18/server/prompts

MCP Apps extension profile:
- https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx

Goose runtime anchors:
- `crates/goose/src/agents/mcp_client.rs`
- `crates/goose/src/agents/extension_manager.rs`
- `crates/goose/src/agents/validate_extensions.rs`
- `crates/goose-cli/src/session/mod.rs`
- `ui/desktop/src/components/ToolCallWithResponse.tsx`
- `ui/desktop/src/components/MCPUIResourceRenderer.tsx`
- `crates/goose-server/src/routes/mcp_ui_proxy.rs`
- `agent/requirements/INLINE_PYTHON_REQUIREMENTS.md`
- `agent/requirements/DEVELOPER_EXTENSION_REQUIREMENTS.md`

Goose server OpenAPI reference:
- Canonical source (reference repo): `ui/desktop/openapi.json`
- Local requirements copy (this repo): `agent/requirements/GOOSE_SERVER_OPENAPI.json`
- Sync policy: update the local requirements copy manually whenever the canonical source changes.
