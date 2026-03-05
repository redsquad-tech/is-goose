import fs from "node:fs";
import path from "node:path";
import swagger from "@fastify/swagger";
import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import OpenAPISampler from "openapi-sampler";

import type {
  components,
  operations,
} from "../shared/http/openapi.generated.js";
import { RuntimeRegistry, toSseStream } from "./runtime.js";

const PUBLIC_PATHS = new Set(["/status", "/mcp-ui-proxy", "/mcp-app-proxy"]);
const SEND_LOGS_COMMAND = "/send-logs";
const specPath = path.resolve("docs/requirements/GOOSE_SERVER_OPENAPI.json");

type OpenAPISpec = Record<string, unknown>;
type JsonMap = Record<string, unknown>;
type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "head"
  | "options"
  | "trace";
type OpenApiOperationObject = {
  responses?: Record<string, unknown>;
};
type OpenApiPathItem = Partial<Record<HttpMethod, OpenApiOperationObject>>;

const RUNTIME_ROUTES = [
  { method: "post", path: "/agent/start" },
  { method: "post", path: "/agent/resume" },
  { method: "post", path: "/agent/restart" },
  { method: "post", path: "/agent/stop" },
  { method: "post", path: "/agent/add_extension" },
  { method: "post", path: "/agent/remove_extension" },
  { method: "post", path: "/agent/update_provider" },
  { method: "get", path: "/config/extensions" },
  { method: "post", path: "/config/extensions" },
  { method: "delete", path: "/config/extensions/:name" },
  { method: "get", path: "/config/providers" },
  { method: "post", path: "/config/check_provider" },
  { method: "post", path: "/config/detect-provider" },
  { method: "post", path: "/config/set_provider" },
  { method: "post", path: "/reply" },
] as const;

const runtimeRouteSet = new Set(
  RUNTIME_ROUTES.map((route) => `${route.method.toUpperCase()} ${route.path}`),
);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const isPublicPath = (pathValue: string): boolean =>
  PUBLIC_PATHS.has(pathValue);

export const loadSpec = (): OpenAPISpec => {
  const raw = fs.readFileSync(specPath, "utf8");
  return JSON.parse(raw) as OpenAPISpec;
};

export const toFastifyPath = (openApiPath: string): string =>
  openApiPath.replaceAll(/\{([^}]+)\}/g, ":$1");

export const pickSuccessStatus = (
  responses: Record<string, unknown>,
): number => {
  const preferred = ["200", "201", "202", "204"];
  for (const code of preferred) {
    if (responses[code] !== undefined) {
      return Number(code);
    }
  }

  const first2xx = Object.keys(responses)
    .filter((code) => /^2\d\d$/.test(code))
    .sort()[0];

  if (first2xx) {
    return Number(first2xx);
  }

  return 200;
};

const pickContentType = (content: JsonMap): string | null => {
  const preference = [
    "application/json",
    "text/plain",
    "application/zip",
    "text/event-stream",
  ];

  for (const type of preference) {
    if (content[type] !== undefined) {
      return type;
    }
  }

  const first = Object.keys(content)[0];
  return first ?? null;
};

const sampleFromSchema = (
  schema: JsonMap | undefined,
  spec: OpenAPISpec,
): unknown => {
  if (!schema) {
    return {};
  }
  try {
    return OpenAPISampler.sample(schema, {}, spec);
  } catch {
    return {};
  }
};

const buildResponseBody = (
  mediaTypeObject: JsonMap,
  spec: OpenAPISpec,
): unknown => {
  if (mediaTypeObject.example !== undefined) {
    return mediaTypeObject.example;
  }

  if (
    mediaTypeObject.examples &&
    typeof mediaTypeObject.examples === "object"
  ) {
    const first = Object.values(mediaTypeObject.examples as JsonMap)[0] as
      | JsonMap
      | undefined;
    if (first?.value !== undefined) {
      return first.value;
    }
  }

  return sampleFromSchema(mediaTypeObject.schema as JsonMap | undefined, spec);
};

export const resolveResponse = (
  operation: JsonMap,
  statusCode: number,
  spec: OpenAPISpec,
): { statusCode: number; contentType: string | null; body: unknown } => {
  const responses = (operation.responses ?? {}) as JsonMap;
  const response = (responses[String(statusCode)] ??
    responses.default ??
    {}) as JsonMap;
  const content = (response.content ?? {}) as JsonMap;
  const contentType = pickContentType(content);

  if (!contentType) {
    return { statusCode, contentType: null, body: null };
  }

  const mediaTypeObject = content[contentType] as JsonMap;
  const body = buildResponseBody(mediaTypeObject, spec);
  return { statusCode, contentType, body };
};

const routeOperation = (
  spec: OpenAPISpec,
  openApiPath: string,
  method: "get" | "post" | "delete",
): Record<string, unknown> => {
  const paths = asRecord(spec.paths);
  const pathItem = asRecord(paths[openApiPath]);
  return asRecord(pathItem[method]);
};

const sampleResponse = (
  spec: OpenAPISpec,
  openApiPath: string,
  method: "get" | "post" | "delete",
  statusCode: number,
): { contentType: string | null; body: unknown } => {
  const operation = routeOperation(spec, openApiPath, method);
  const resolved = resolveResponse(operation, statusCode, spec);
  return { contentType: resolved.contentType, body: resolved.body };
};

const unauthorized = (reply: FastifyReply): void => {
  reply.code(401).send({ message: "Unauthorized" });
};

const withAuth = (
  request: FastifyRequest,
  reply: FastifyReply,
  secretKey: string,
): boolean => {
  const routePath = request.routeOptions.url ?? "";
  if (isPublicPath(routePath)) {
    return true;
  }
  const headerValue = request.headers["x-secret-key"];
  const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!token || token !== secretKey) {
    unauthorized(reply);
    return false;
  }
  return true;
};

const extractReplyCommand = (
  request: operations["reply"]["requestBody"]["content"]["application/json"],
): string | null => {
  const blocks = request.user_message.content;
  for (const block of blocks) {
    if (block.type === "text") {
      return block.text.trim();
    }
  }
  return null;
};

const sendLogsStubPayload = (): string =>
  JSON.stringify({
    ok: true,
    message: "Send logs dry-run completed",
    artifactPath: `${process.env.AGENT_LOGS_DIR ?? ""}/send-logs-dry-run.txt`,
    remotePath: "dry-run://pending",
  });

const patchSessionBody = (
  body: unknown,
  session: {
    id: string;
    workingDir: string;
    createdAt: string;
    updatedAt: string;
    provider: string;
    model: string;
    conversation: components["schemas"]["Message"][];
  },
): unknown => {
  const sample = asRecord(body);
  const modelConfig = asRecord(sample.model_config);
  return {
    ...sample,
    id: session.id,
    working_dir: session.workingDir,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    provider_name: session.provider,
    conversation: session.conversation,
    model_config: {
      ...modelConfig,
      model_name: session.model,
    },
  };
};

const handleMcpUiProxy = (
  request: FastifyRequest<{
    Querystring: operations["mcp_ui_proxy"]["parameters"]["query"];
  }>,
  reply: FastifyReply,
  secretKey: string,
): void => {
  if (!request.query.secret || request.query.secret !== secretKey) {
    reply.code(401).send("Unauthorized");
    return;
  }

  reply
    .code(200)
    .type("text/html")
    .send("<!doctype html><html><body><h1>MCP UI Proxy</h1></body></html>");
};

const registerRuntimeRoutes = (
  app: FastifyInstance,
  spec: OpenAPISpec,
  secretKey: string,
): void => {
  const registry = new RuntimeRegistry({
    settingsDir: process.env.AGENT_CONFIG_DIR ?? process.cwd(),
  });

  app.post<{
    Body: operations["start_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/start", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const session = registry.startAgent(request.body);
    const sampled = sampleResponse(spec, "/agent/start", "post", 200);
    const body = patchSessionBody(sampled.body, {
      id: session.id,
      workingDir: session.workingDir,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      provider: session.provider.provider,
      model: session.provider.model,
      conversation: session.conversation,
    });
    reply.code(200).type("application/json").send(body);
  });

  app.post<{
    Body: operations["resume_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/resume", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const resumed = registry.resumeAgent(request.body);
    if (!resumed.ok) {
      reply.code(404).send();
      return;
    }
    const sampled = sampleResponse(spec, "/agent/resume", "post", 200);
    const raw = asRecord(sampled.body);
    const rawSession = asRecord(raw.session);
    const patchedSession = patchSessionBody(rawSession, {
      id: resumed.data.id,
      workingDir: resumed.data.workingDir,
      createdAt: resumed.data.createdAt,
      updatedAt: resumed.data.updatedAt,
      provider: resumed.data.provider.provider,
      model: resumed.data.provider.model,
      conversation: resumed.data.conversation,
    });
    reply
      .code(200)
      .type("application/json")
      .send({
        ...raw,
        session: patchedSession,
        extension_results: [],
      });
  });

  app.post<{
    Body: operations["restart_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/restart", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const restarted = registry.restartAgent(request.body);
    if (!restarted.ok) {
      reply.code(404).send();
      return;
    }
    const sampled = sampleResponse(spec, "/agent/restart", "post", 200);
    const raw = asRecord(sampled.body);
    reply
      .code(200)
      .type("application/json")
      .send({
        ...raw,
        extension_results: restarted.data.extensionResults,
      });
  });

  app.post<{
    Body: operations["stop_agent"]["requestBody"]["content"]["application/json"];
  }>("/agent/stop", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const stopped = registry.stopAgent(request.body);
    if (!stopped.ok) {
      reply.code(404).send();
      return;
    }
    const sampled = sampleResponse(spec, "/agent/stop", "post", 200);
    reply
      .code(200)
      .type("text/plain")
      .send(String(sampled.body ?? "ok"));
  });

  app.post<{
    Body: operations["add_extension"]["requestBody"]["content"]["application/json"];
  }>("/config/extensions", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const upserted = registry.upsertExtensionConfig(request.body);
    if (!upserted.ok) {
      reply.code(400).send();
      return;
    }
    const sampled = sampleResponse(spec, "/config/extensions", "post", 200);
    reply
      .code(200)
      .type("text/plain")
      .send(String(sampled.body ?? "ok"));
  });

  app.get("/config/extensions", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const sampled = sampleResponse(spec, "/config/extensions", "get", 200);
    const raw = asRecord(sampled.body);
    const extensions = registry.listExtensions().map((entry) => ({
      ...Object.fromEntries(
        Object.entries(entry.config as Record<string, unknown>).filter(
          ([key]) => key !== "type",
        ),
      ),
      type: "ExtensionEntry",
      enabled: entry.enabled,
      name: entry.name,
    }));
    reply
      .code(200)
      .type("application/json")
      .send({
        ...raw,
        extensions,
        warnings: [],
      });
  });

  app.delete<{ Params: operations["remove_extension"]["parameters"]["path"] }>(
    "/config/extensions/:name",
    async (request, reply) => {
      if (!withAuth(request, reply, secretKey)) {
        return;
      }
      const removed = registry.removeExtensionConfig(request.params.name);
      if (!removed.ok) {
        reply.code(404).send();
        return;
      }
      const sampled = sampleResponse(
        spec,
        "/config/extensions/{name}",
        "delete",
        200,
      );
      reply
        .code(200)
        .type("text/plain")
        .send(String(sampled.body ?? "ok"));
    },
  );

  app.post<{
    Body: operations["agent_add_extension"]["requestBody"]["content"]["application/json"];
  }>("/agent/add_extension", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const added = registry.addSessionExtension(request.body);
    if (!added.ok) {
      reply.code(404).send();
      return;
    }
    const sampled = sampleResponse(spec, "/agent/add_extension", "post", 200);
    reply
      .code(200)
      .type("text/plain")
      .send(String(sampled.body ?? "ok"));
  });

  app.post<{
    Body: operations["agent_remove_extension"]["requestBody"]["content"]["application/json"];
  }>("/agent/remove_extension", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const removed = registry.removeSessionExtension(request.body);
    if (!removed.ok) {
      reply.code(404).send();
      return;
    }
    const sampled = sampleResponse(
      spec,
      "/agent/remove_extension",
      "post",
      200,
    );
    reply
      .code(200)
      .type("text/plain")
      .send(String(sampled.body ?? "ok"));
  });

  app.post<{
    Body: operations["update_agent_provider"]["requestBody"]["content"]["application/json"];
  }>("/agent/update_provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const updated = registry.updateProvider(request.body);
    if (!updated.ok) {
      reply.code(404).send();
      return;
    }
    reply.code(200).send();
  });

  app.get("/config/providers", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const sampled = sampleResponse(spec, "/config/providers", "get", 200);
    const body = sampled.body;
    if (!Array.isArray(body) || body.length === 0) {
      reply.code(200).type("application/json").send([]);
      return;
    }
    const first = asRecord(body[0]);
    const metadata = asRecord(first.metadata);
    reply
      .code(200)
      .type("application/json")
      .send([
        {
          ...first,
          name: registry.getProviderState().provider,
          metadata: {
            ...metadata,
            name: registry.getProviderState().provider,
            default_model: registry.getProviderState().model,
          },
        },
      ]);
  });

  app.post<{
    Body: operations["check_provider"]["requestBody"]["content"]["application/json"];
  }>("/config/check_provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const sampled = sampleResponse(spec, "/config/check_provider", "post", 200);
    reply.code(200).type("application/json").send(sampled.body);
  });

  app.post<{
    Body: operations["detect_provider"]["requestBody"]["content"]["application/json"];
  }>("/config/detect-provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const sampled = sampleResponse(
      spec,
      "/config/detect-provider",
      "post",
      200,
    );
    const raw = asRecord(sampled.body);
    reply
      .code(200)
      .type("application/json")
      .send({
        ...raw,
        provider_name: registry.getProviderState().provider,
        models: [registry.getProviderState().model],
      });
  });

  app.post<{
    Body: operations["set_config_provider"]["requestBody"]["content"]["application/json"];
  }>("/config/set_provider", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    registry.setProvider(request.body);
    reply.code(200).send();
  });

  app.post<{
    Body: operations["reply"]["requestBody"]["content"]["application/json"];
  }>("/reply", async (request, reply) => {
    if (!withAuth(request, reply, secretKey)) {
      return;
    }
    const command = extractReplyCommand(request.body);
    if (command === SEND_LOGS_COMMAND) {
      reply
        .code(200)
        .type("text/event-stream")
        .send(`data: ${sendLogsStubPayload()}\n\n`);
      return;
    }
    const result = registry.runReply(request.body);
    if (!result.ok) {
      reply.code(424).send();
      return;
    }
    reply.code(200).type("text/event-stream").send(toSseStream(result.data));
  });
};

const registerOpenApiFallbackRoutes = (
  spec: OpenAPISpec,
  app: FastifyInstance,
  secretKey: string,
): void => {
  const paths = (spec.paths ?? {}) as Record<string, OpenApiPathItem>;

  for (const [openApiPath, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (
        ![
          "get",
          "post",
          "put",
          "patch",
          "delete",
          "head",
          "options",
          "trace",
        ].includes(method)
      ) {
        continue;
      }
      if (!operation) {
        continue;
      }

      const fastifyPath = toFastifyPath(openApiPath);
      const key = `${method.toUpperCase()} ${fastifyPath}`;
      if (runtimeRouteSet.has(key)) {
        continue;
      }
      app.route({
        method: method.toUpperCase() as
          | "GET"
          | "POST"
          | "PUT"
          | "PATCH"
          | "DELETE"
          | "HEAD"
          | "OPTIONS"
          | "TRACE",
        url: fastifyPath,
        preHandler: async (request, reply) => {
          if (!withAuth(request, reply, secretKey)) {
            return;
          }
        },
        handler: async (
          request: FastifyRequest,
          reply: FastifyReply,
        ): Promise<void> => {
          if (openApiPath === "/mcp-ui-proxy" && method === "get") {
            handleMcpUiProxy(
              request as FastifyRequest<{
                Querystring: operations["mcp_ui_proxy"]["parameters"]["query"];
              }>,
              reply,
              secretKey,
            );
            return;
          }

          const statusCode = pickSuccessStatus(operation.responses ?? {});
          const resolved = resolveResponse(
            operation as Record<string, unknown>,
            statusCode,
            spec,
          );
          if (resolved.statusCode === 204) {
            reply.code(204).send();
            return;
          }

          if (resolved.contentType) {
            reply.type(resolved.contentType);
          }

          if (resolved.contentType === "application/zip") {
            reply.code(resolved.statusCode).send(Buffer.from("PK\x03\x04"));
            return;
          }

          reply.code(resolved.statusCode).send(resolved.body);
        },
      });
    }
  }
};

const registerRoutes = (
  app: FastifyInstance,
  spec: OpenAPISpec,
  secretKey: string,
): void => {
  registerRuntimeRoutes(app, spec, secretKey);
  registerOpenApiFallbackRoutes(spec, app, secretKey);
};

export const buildApp = (): ReturnType<typeof Fastify> => {
  const app = Fastify({ logger: false });
  const spec = loadSpec();
  const secretKey = process.env.SERVER_SECRET_KEY ?? "dev-secret";

  void app.register(swagger, {
    mode: "dynamic",
    openapi: spec as never,
  });

  app.get("/openapi.json", async () => spec);
  registerRoutes(app, spec, secretKey);

  return app;
};
