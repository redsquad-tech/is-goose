import fs from "node:fs";
import path from "node:path";
import { createActor, fromTransition } from "xstate";

import type {
  components,
  operations,
} from "../shared/http/openapi.generated.js";

type RuntimeErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_ACTIVE"
  | "INVALID_EXTENSION_CONFIG"
  | "UNSUPPORTED_EXTENSION_TYPE"
  | "PROVIDER_NOT_CONFIGURED"
  | "TOOL_NOT_FOUND"
  | "RUNTIME_INTERNAL";

type RuntimeError = {
  code: RuntimeErrorCode;
  message: string;
};

type RuntimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RuntimeError };

type SessionStatus = "idle" | "running" | "stopped" | "failed";

type ProviderState = {
  provider: string;
  model: string;
  contextLimit: number;
};

type MoimContext = {
  enabled: boolean;
  note: string;
};

type RuntimeSession = {
  id: string;
  status: SessionStatus;
  workingDir: string;
  createdAt: string;
  updatedAt: string;
  skillsInstructions: string;
  moim: MoimContext;
  provider: ProviderState;
  activeExtensions: string[];
  conversation: components["schemas"]["Message"][];
};

type RuntimeToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

type ProviderTurn = {
  assistantText: string;
  toolCalls: RuntimeToolCall[];
};

type ExtensionConfig = components["schemas"]["ExtensionConfig"];
type MessageEvent = components["schemas"]["MessageEvent"];

type ExtensionStoredEntry = {
  type: "ExtensionEntry";
  name: string;
  enabled: boolean;
  config: ExtensionConfig;
};

type SkillSource = {
  rootDir: string;
  scope: "working_dir" | "settings_dir";
};

type SkillsLoadResult = {
  mergedInstructions: string;
  warnings: string[];
};

type SessionManagerOptions = {
  settingsDir: string;
};

type SessionActorState = {
  status: SessionStatus;
};

type SessionActorEvent =
  | { type: "START" }
  | { type: "RESUME" }
  | { type: "RESTART" }
  | { type: "STOP" }
  | { type: "FAIL" };

type ProviderActorState = {
  status: "idle" | "done";
  turn: ProviderTurn;
};

type ProviderActorEvent = {
  type: "RUN";
  input: string;
  sessionId: string;
  skillsInstructions: string;
};

type ExtensionActorState = {
  tools: string[];
};

type ExtensionActorEvent = {
  type: "SYNC_TOOLS";
  tools: string[];
};

type ExtensionActorHandle = {
  name: string;
  listTools: () => string[];
  callTool: (call: RuntimeToolCall) => RuntimeResult<{ output: string }>;
};

type ToolRouterOptions = {
  getActiveExtensions: () => ExtensionActorHandle[];
};

type SubcycleActorState = {
  status: "idle" | "running" | "done";
};

type SubcycleActorEvent = { type: "RUN" };

type AgentCycleState =
  | "idle"
  | "loading_context"
  | "requesting_provider"
  | "processing_tools"
  | "streaming_followup"
  | "finished"
  | "failed";

type AgentCycleSnapshot = {
  state: AgentCycleState;
};

type AgentCycleEvent =
  | { type: "LOAD" }
  | { type: "PROVIDER" }
  | { type: "TOOLS" }
  | { type: "FOLLOWUP" }
  | { type: "FINISH" }
  | { type: "FAIL" };

const now = (): string => new Date().toISOString();

const listSkillFiles = (rootDir: string): string[] => {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name, "SKILL.md"))
    .filter((skillFile) => fs.existsSync(skillFile));
};

const readSkillSafe = (skillFile: string): string | null => {
  try {
    return fs.readFileSync(skillFile, "utf8").trim();
  } catch {
    return null;
  }
};

const loadSkillsInstructions = (
  workingDir: string,
  settingsDir: string,
): SkillsLoadResult => {
  const warnings: string[] = [];
  const sources: SkillSource[] = [
    { rootDir: path.join(settingsDir, "skills"), scope: "settings_dir" },
    {
      rootDir: path.join(workingDir, ".codex", "skills"),
      scope: "working_dir",
    },
  ];
  const byName = new Map<
    string,
    { scope: SkillSource["scope"]; body: string }
  >();

  for (const source of sources) {
    const skillFiles = listSkillFiles(source.rootDir);
    for (const skillFile of skillFiles) {
      const skillName = path.basename(path.dirname(skillFile));
      const body = readSkillSafe(skillFile);
      if (!body) {
        warnings.push(`skill_load_failed:${source.scope}:${skillName}`);
        continue;
      }
      byName.set(skillName, { scope: source.scope, body });
    }
  }

  const merged = [...byName.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) =>
      `# skill:${name} (${value.scope})\n${value.body}`.trim(),
    )
    .join("\n\n");

  return {
    mergedInstructions: merged,
    warnings,
  };
};

const createMoimStub = (sessionId: string): MoimContext => ({
  enabled: true,
  note: `moim-stub:${sessionId}`,
});

const injectMoimInstructions = (
  session: RuntimeSession,
  baseInstructions: string,
): string => {
  if (!session.moim.enabled) {
    return baseInstructions;
  }
  const moimBlock = `MOIM_CONTEXT=${session.moim.note}`;
  return [baseInstructions, moimBlock]
    .filter((part) => part.length > 0)
    .join("\n\n");
};

const defaultProviderState = (): ProviderState => ({
  provider: "stub-provider",
  model: "stub-model",
  contextLimit: 8192,
});

const nowIso = (): string => new Date().toISOString();

export class SessionManager {
  private readonly settingsDir: string;

  private readonly sessions = new Map<string, RuntimeSession>();

  constructor(options: SessionManagerOptions) {
    this.settingsDir = options.settingsDir;
  }

  get(sessionId: string): RuntimeSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  create(sessionId: string, workingDir: string): RuntimeSession {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }
    const createdAt = nowIso();
    const skills = loadSkillsInstructions(workingDir, this.settingsDir);
    const session: RuntimeSession = {
      id: sessionId,
      status: "idle",
      workingDir,
      createdAt,
      updatedAt: createdAt,
      skillsInstructions: skills.mergedInstructions,
      moim: createMoimStub(sessionId),
      provider: defaultProviderState(),
      activeExtensions: [],
      conversation: [],
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  update(session: RuntimeSession): RuntimeSession {
    const updated: RuntimeSession = {
      ...session,
      updatedAt: nowIso(),
    };
    this.sessions.set(updated.id, updated);
    return updated;
  }

  appendMessage(
    sessionId: string,
    message: components["schemas"]["Message"],
  ): RuntimeSession | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }
    return this.update({
      ...session,
      conversation: [...session.conversation, message],
    });
  }

  setProvider(
    sessionId: string,
    provider: ProviderState,
  ): RuntimeSession | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }
    return this.update({
      ...session,
      provider,
    });
  }

  setActiveExtensions(
    sessionId: string,
    names: string[],
  ): RuntimeSession | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }
    return this.update({
      ...session,
      activeExtensions: names,
    });
  }

  buildProviderInstructions(sessionId: string): string {
    const session = this.get(sessionId);
    if (!session) {
      return "";
    }
    return injectMoimInstructions(session, session.skillsInstructions);
  }
}

const sessionTransition = (
  _state: SessionActorState,
  event: SessionActorEvent,
): SessionActorState => {
  switch (event.type) {
    case "START":
    case "RESUME":
    case "RESTART":
      return { status: "running" };
    case "STOP":
      return { status: "stopped" };
    case "FAIL":
      return { status: "failed" };
  }
};

export const createSessionActor = (
  initial: SessionStatus = "idle",
): ReturnType<typeof createActor> => {
  const logic = fromTransition(sessionTransition, { status: initial });
  const actor = createActor(logic);
  actor.start();
  return actor;
};

const buildToolCalls = (input: string): ProviderTurn["toolCalls"] => {
  const trimmed = input.trim();
  if (trimmed.startsWith("/tool summon.")) {
    const toolName =
      trimmed.slice("/tool ".length).split(/\s+/)[0] ?? "summon.unknown";
    return [
      {
        id: `tool-${Date.now()}`,
        name: toolName,
        args: { prompt: trimmed },
      },
    ];
  }
  if (trimmed.includes("summon")) {
    return [
      {
        id: `tool-${Date.now()}`,
        name: "summon.default",
        args: { prompt: trimmed },
      },
    ];
  }
  return [];
};

const providerTransition = (
  state: ProviderActorState,
  event: ProviderActorEvent,
): ProviderActorState => {
  if (event.type !== "RUN") {
    return state;
  }
  const toolCalls = buildToolCalls(event.input);
  const suffix =
    event.skillsInstructions.length > 0
      ? " [skills-loaded]"
      : " [skills-empty]";
  return {
    status: "done",
    turn: {
      assistantText: `stub:${event.input}${suffix}`,
      toolCalls,
    },
  };
};

const runProviderTurn = (input: {
  prompt: string;
  sessionId: string;
  skillsInstructions: string;
}): ProviderTurn => {
  let turn: ProviderTurn = {
    assistantText: "",
    toolCalls: [],
  };
  const logic = fromTransition(providerTransition, {
    status: "idle",
    turn,
  } satisfies ProviderActorState);
  const actor = createActor(logic);
  actor.start();
  actor.send({
    type: "RUN",
    input: input.prompt,
    sessionId: input.sessionId,
    skillsInstructions: input.skillsInstructions,
  });
  turn = providerTransition(
    { status: "idle", turn },
    {
      type: "RUN",
      input: input.prompt,
      sessionId: input.sessionId,
      skillsInstructions: input.skillsInstructions,
    },
  ).turn;
  actor.stop();
  return turn;
};

const normalizeToolPrefix = (name: string): string =>
  name.replaceAll(/[^a-zA-Z0-9_-]/g, "_");

const createExtensionActor = (
  entry: ExtensionStoredEntry,
): ExtensionActorHandle => {
  const extensionName = entry.name;
  const prefix = normalizeToolPrefix(extensionName);
  const baseTools = [`${prefix}.echo`, `summon.${prefix}`];
  let tools = baseTools;
  const logic = fromTransition(
    (state: ExtensionActorState, event: ExtensionActorEvent) => {
      if (event.type !== "SYNC_TOOLS") {
        return state;
      }
      tools = event.tools;
      return { tools };
    },
    { tools },
  );
  const actor = createActor(logic);
  actor.start();

  return {
    name: extensionName,
    listTools: () => tools,
    callTool: (call) => {
      if (!tools.includes(call.name)) {
        return {
          ok: false,
          error: {
            code: "TOOL_NOT_FOUND",
            message: `Tool not found: ${call.name}`,
          },
        };
      }
      return {
        ok: true,
        data: {
          output: `${call.name}:${JSON.stringify(call.args)}`,
        },
      };
    },
  };
};

export class ToolRouter {
  private readonly getActiveExtensions: ToolRouterOptions["getActiveExtensions"];

  constructor(options: ToolRouterOptions) {
    this.getActiveExtensions = options.getActiveExtensions;
  }

  dispatch(call: RuntimeToolCall): RuntimeResult<{ output: string }> {
    const extensions = this.getActiveExtensions();
    for (const extension of extensions) {
      if (extension.listTools().includes(call.name)) {
        return extension.callTool(call);
      }
    }
    return {
      ok: false,
      error: {
        code: "TOOL_NOT_FOUND",
        message: `Tool not found: ${call.name}`,
      },
    };
  }
}

const subcycleTransition = (
  state: SubcycleActorState,
  event: SubcycleActorEvent,
): SubcycleActorState => {
  if (event.type !== "RUN") {
    return state;
  }
  return { status: "running" };
};

const notificationEvent = (
  requestId: string,
  _message: string,
): MessageEvent => ({
  type: "Notification",
  request_id: requestId,
  message: {},
});

const spawnDetachedSubcycle = (
  parentSessionId: string,
  toolName: string,
  emit: (event: MessageEvent) => void,
): string => {
  const requestId = `subcycle-${parentSessionId}-${Date.now()}`;
  const logic = fromTransition(subcycleTransition, {
    status: "idle",
  } satisfies SubcycleActorState);
  const actor = createActor(logic);
  actor.start();
  emit(notificationEvent(requestId, `${toolName}:started`));
  actor.send({ type: "RUN" });
  queueMicrotask(() => {
    emit(notificationEvent(requestId, `${toolName}:finished`));
    actor.stop();
  });
  return requestId;
};

const tokenState = (): components["schemas"]["TokenState"] => ({
  accumulatedInputTokens: 0,
  accumulatedOutputTokens: 0,
  accumulatedTotalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

const assistantMessage = (text: string): components["schemas"]["Message"] => ({
  role: "assistant",
  created: Date.now(),
  metadata: { userVisible: true, agentVisible: true },
  content: [{ type: "text", text }],
});

const userMessageText = (message: components["schemas"]["Message"]): string => {
  const first = message.content.find((item) => item.type === "text");
  if (!first || first.type !== "text") {
    return "";
  }
  return first.text;
};

const cycleTransition = (
  _state: AgentCycleSnapshot,
  event: AgentCycleEvent,
): AgentCycleSnapshot => {
  switch (event.type) {
    case "LOAD":
      return { state: "loading_context" };
    case "PROVIDER":
      return { state: "requesting_provider" };
    case "TOOLS":
      return { state: "processing_tools" };
    case "FOLLOWUP":
      return { state: "streaming_followup" };
    case "FINISH":
      return { state: "finished" };
    case "FAIL":
      return { state: "failed" };
  }
};

const toolResponseMessage = (
  toolCall: RuntimeToolCall,
  _output: string,
): components["schemas"]["Message"] => ({
  role: "assistant",
  created: Date.now(),
  metadata: { userVisible: true, agentVisible: true },
  content: [
    {
      type: "toolResponse",
      id: toolCall.id,
      metadata: {},
      toolResult: {},
    },
  ],
});

const appendEvent = (events: MessageEvent[], event: MessageEvent): void => {
  events.push(event);
};

export const runAgentCycle = (input: {
  session: RuntimeSession;
  userMessage: components["schemas"]["Message"];
  router: ToolRouter;
}): {
  events: MessageEvent[];
  newMessages: components["schemas"]["Message"][];
} => {
  const logic = fromTransition(cycleTransition, {
    state: "idle",
  } satisfies AgentCycleSnapshot);
  const actor = createActor(logic);
  actor.start();
  const events: MessageEvent[] = [];
  const newMessages: components["schemas"]["Message"][] = [];
  const emitNotification = (event: MessageEvent): void => {
    appendEvent(events, event);
  };

  actor.send({ type: "LOAD" });
  actor.send({ type: "PROVIDER" });
  const prompt = userMessageText(input.userMessage);
  const providerTurn = runProviderTurn({
    prompt,
    sessionId: input.session.id,
    skillsInstructions: input.session.skillsInstructions,
  });
  const assistant = assistantMessage(providerTurn.assistantText);
  appendEvent(events, {
    type: "Message",
    message: assistant,
    token_state: tokenState(),
  });
  newMessages.push(assistant);
  appendEvent(events, {
    type: "ModelChange",
    model: input.session.provider.model,
    mode: input.session.provider.provider,
  });

  if (providerTurn.toolCalls.length > 0) {
    actor.send({ type: "TOOLS" });
    for (const toolCall of providerTurn.toolCalls) {
      if (toolCall.name.startsWith("summon.")) {
        const requestId = spawnDetachedSubcycle(
          input.session.id,
          toolCall.name,
          emitNotification,
        );
        newMessages.push(
          toolResponseMessage(
            toolCall,
            JSON.stringify({
              status: "accepted",
              requestId,
            }),
          ),
        );
        continue;
      }
      const dispatched = input.router.dispatch(toolCall);
      const output = dispatched.ok
        ? dispatched.data.output
        : `${dispatched.error.code}:${dispatched.error.message}`;
      newMessages.push(toolResponseMessage(toolCall, output));
    }
    for (const message of newMessages.slice(1)) {
      appendEvent(events, {
        type: "Message",
        message,
        token_state: tokenState(),
      });
    }
    actor.send({ type: "FOLLOWUP" });
    const followup = assistantMessage("Tool execution completed.");
    newMessages.push(followup);
    appendEvent(events, {
      type: "Message",
      message: followup,
      token_state: tokenState(),
    });
  }

  actor.send({ type: "FINISH" });
  appendEvent(events, {
    type: "Finish",
    reason: "turn_completed",
    token_state: tokenState(),
  });
  actor.stop();
  return { events, newMessages };
};

const normalizeEntry = (
  payload: components["schemas"]["ExtensionQuery"],
): RuntimeResult<ExtensionStoredEntry> => {
  const entry = {
    type: "ExtensionEntry",
    config: payload.config,
    enabled: payload.enabled,
    name: payload.name,
  } satisfies ExtensionStoredEntry;
  return { ok: true, data: entry };
};

const createUserMessage = (
  body: operations["reply"]["requestBody"]["content"]["application/json"],
): components["schemas"]["Message"] => ({
  ...body.user_message,
  created:
    typeof body.user_message.created === "number"
      ? body.user_message.created
      : Date.parse(String(body.user_message.created ?? now())),
});

const isElicitationResponse = (
  message: components["schemas"]["Message"],
): boolean =>
  message.content.some(
    (content) =>
      content.type === "actionRequired" &&
      content.data.actionType === "elicitationResponse",
  );

export class RuntimeRegistry {
  private readonly sessionManager: SessionManager;

  private readonly sessionActors = new Map<
    string,
    ReturnType<typeof createSessionActor>
  >();

  private readonly extensions = new Map<string, ExtensionStoredEntry>();

  private readonly extensionActors = new Map<string, ExtensionActorHandle>();

  private providerState: ProviderState = {
    provider: "stub-provider",
    model: "stub-model",
    contextLimit: 8192,
  };

  constructor(options: { settingsDir: string }) {
    this.sessionManager = new SessionManager({
      settingsDir: options.settingsDir,
    });
  }

  startAgent(
    request: operations["start_agent"]["requestBody"]["content"]["application/json"],
  ): RuntimeSession {
    const sessionId = `session-${Date.now()}`;
    const workingDir = request.working_dir ?? process.cwd();
    const session = this.sessionManager.create(sessionId, workingDir);
    const actor = createSessionActor("idle");
    actor.send({ type: "START" });
    this.sessionActors.set(sessionId, actor);
    return this.sessionManager.update({
      ...session,
      status: "running",
      provider: this.providerState,
    });
  }

  resumeAgent(
    request: operations["resume_agent"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<RuntimeSession> {
    const session =
      this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    const actor =
      this.sessionActors.get(request.session_id) ?? createSessionActor("idle");
    actor.send({ type: "RESUME" });
    this.sessionActors.set(request.session_id, actor);
    return {
      ok: true,
      data: this.sessionManager.update({ ...session, status: "running" }),
    };
  }

  restartAgent(
    request: operations["restart_agent"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<{
    session: RuntimeSession;
    extensionResults: { name: string; success: boolean; error?: string }[];
  }> {
    const session =
      this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    const actor =
      this.sessionActors.get(request.session_id) ?? createSessionActor("idle");
    actor.send({ type: "RESTART" });
    this.sessionActors.set(request.session_id, actor);
    const extensionResults = session.activeExtensions.map((name) => ({
      name,
      success: true,
    }));
    const updated = this.sessionManager.update({
      ...session,
      status: "running",
      provider: this.providerState,
    });
    return { ok: true, data: { session: updated, extensionResults } };
  }

  stopAgent(
    request: operations["stop_agent"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    const actor =
      this.sessionActors.get(request.session_id) ?? createSessionActor("idle");
    this.sessionActors.set(request.session_id, actor);
    actor.send({ type: "STOP" });
    actor.stop();
    this.sessionActors.delete(request.session_id);
    const session = this.sessionManager.get(request.session_id);
    if (session) {
      this.sessionManager.update({ ...session, status: "stopped" });
    }
    return { ok: true, data: undefined };
  }

  upsertExtensionConfig(
    request: operations["add_extension"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    const normalized = normalizeEntry(request);
    if (!normalized.ok) {
      return normalized;
    }
    this.extensions.set(request.name, normalized.data);
    this.extensionActors.set(
      request.name,
      createExtensionActor(normalized.data),
    );
    return { ok: true, data: undefined };
  }

  removeExtensionConfig(name: string): RuntimeResult<void> {
    if (!this.extensions.has(name)) {
      return {
        ok: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Extension not found",
        },
      };
    }
    this.extensions.delete(name);
    this.extensionActors.delete(name);
    return { ok: true, data: undefined };
  }

  listExtensions(): ExtensionStoredEntry[] {
    return [...this.extensions.values()];
  }

  addSessionExtension(
    request: operations["agent_add_extension"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    const session =
      this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    const entry = {
      type: "ExtensionEntry",
      config: request.config,
      enabled: true,
      name: request.config.name,
    } satisfies ExtensionStoredEntry;
    this.extensions.set(entry.name, entry);
    this.extensionActors.set(entry.name, createExtensionActor(entry));
    this.sessionManager.setActiveExtensions(session.id, [
      ...new Set([...session.activeExtensions, entry.name]),
    ]);
    return { ok: true, data: undefined };
  }

  removeSessionExtension(
    request: operations["agent_remove_extension"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    const session =
      this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    const active = session.activeExtensions.filter(
      (name) => name !== request.name,
    );
    this.sessionManager.setActiveExtensions(session.id, active);
    return { ok: true, data: undefined };
  }

  updateProvider(
    request: operations["update_agent_provider"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<void> {
    this.sessionManager.get(request.session_id) ??
      this.sessionManager.create(request.session_id, process.cwd());
    const next: ProviderState = {
      provider: request.provider,
      model: request.model ?? this.providerState.model,
      contextLimit: request.context_limit ?? this.providerState.contextLimit,
    };
    this.providerState = next;
    this.sessionManager.setProvider(request.session_id, next);
    return { ok: true, data: undefined };
  }

  setProvider(
    request: operations["set_config_provider"]["requestBody"]["content"]["application/json"],
  ): void {
    this.providerState = {
      provider: request.provider,
      model: request.model,
      contextLimit: this.providerState.contextLimit,
    };
  }

  getProviderState(): ProviderState {
    return this.providerState;
  }

  runReply(
    request: operations["reply"]["requestBody"]["content"]["application/json"],
  ): RuntimeResult<MessageEvent[]> {
    const existing = this.sessionManager.get(request.session_id);
    const session =
      existing ?? this.sessionManager.create(request.session_id, process.cwd());
    if (session.status === "stopped" || session.status === "failed") {
      return {
        ok: false,
        error: {
          code: "SESSION_NOT_ACTIVE",
          message: "Agent session is not active",
        },
      };
    }
    if (!this.sessionActors.has(session.id)) {
      const actor = createSessionActor("idle");
      actor.send({ type: "START" });
      this.sessionActors.set(session.id, actor);
      this.sessionManager.update({ ...session, status: "running" });
    }
    const userMessage = createUserMessage(request);
    this.sessionManager.appendMessage(session.id, userMessage);
    if (isElicitationResponse(userMessage)) {
      return { ok: true, data: [] };
    }
    const router = new ToolRouter({
      getActiveExtensions: () =>
        session.activeExtensions
          .map((name) => this.extensionActors.get(name))
          .filter((entry): entry is ExtensionActorHandle => Boolean(entry)),
    });
    const cycleResult = runAgentCycle({
      session,
      userMessage,
      router,
    });
    for (const message of cycleResult.newMessages) {
      this.sessionManager.appendMessage(session.id, message);
    }
    return { ok: true, data: cycleResult.events };
  }
}

export const toSseStream = (events: MessageEvent[]): string =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
