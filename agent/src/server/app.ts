import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import swagger from "@fastify/swagger";

import { buildSsePayload, resolveResponse } from "./responder.js";
import { loadSpec, pickSuccessStatus, toFastifyPath, type OpenAPISpec } from "./spec.js";

const PUBLIC_PATHS = new Set(["/status", "/mcp-ui-proxy", "/mcp-app-proxy"]);

type RequestWithQuery = FastifyRequest<{ Querystring: { secret?: string } }>;

const isPublicPath = (path: string): boolean => PUBLIC_PATHS.has(path);

const withAuth = (
  secretKey: string,
): ((request: FastifyRequest, reply: FastifyReply) => Promise<void>) => {
  return async (request, reply) => {
    const routePath = request.routeOptions.url ?? "";
    if (isPublicPath(routePath)) {
      return;
    }

    const headerValue = request.headers["x-secret-key"];
    const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!token || token !== secretKey) {
      reply.code(401).send({ message: "Unauthorized" });
    }
  };
};

const handleMcpUiProxy = (
  request: RequestWithQuery,
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

const registerOpenApiRoutes = (spec: OpenAPISpec, app: ReturnType<typeof Fastify>, secretKey: string): void => {
  const paths = (spec.paths ?? {}) as Record<string, Record<string, Record<string, unknown>>>;

  for (const [openApiPath, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "patch", "delete", "head", "options", "trace"].includes(method)) {
        continue;
      }

      const fastifyPath = toFastifyPath(openApiPath);
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
        preHandler: withAuth(secretKey),
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
          if (openApiPath === "/mcp-ui-proxy" && method === "get") {
            handleMcpUiProxy(request as RequestWithQuery, reply, secretKey);
            return;
          }

          const op = operation as Record<string, any>;
          const statusCode = pickSuccessStatus((op.responses ?? {}) as Record<string, unknown>);

          if (openApiPath === "/reply" && method === "post") {
            const payload = buildSsePayload(op, spec);
            reply.code(200).type("text/event-stream").send(payload);
            return;
          }

          const resolved = resolveResponse(op, statusCode, spec);
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

export const buildApp = (): ReturnType<typeof Fastify> => {
  const app = Fastify({ logger: false });
  const spec = loadSpec();
  const secretKey = process.env.SERVER_SECRET_KEY ?? "dev-secret";

  void app.register(swagger, {
    mode: "dynamic",
    openapi: spec as never,
  });

  app.get("/openapi.json", async () => spec);
  registerOpenApiRoutes(spec, app, secretKey);

  return app;
};
