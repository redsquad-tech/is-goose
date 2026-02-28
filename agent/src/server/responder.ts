import OpenAPISampler from "openapi-sampler";

import type { OpenAPISpec } from "./spec.js";

type JsonMap = Record<string, unknown>;

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

export const buildSsePayload = (
  operation: JsonMap,
  spec: OpenAPISpec,
): string => {
  const responses = (operation.responses ?? {}) as JsonMap;
  const ok = (responses["200"] ?? {}) as JsonMap;
  const content = (ok.content ?? {}) as JsonMap;
  const stream = content["text/event-stream"] as JsonMap | undefined;
  const body = buildResponseBody(stream ?? {}, spec);
  return `data: ${JSON.stringify(body)}\n\n`;
};
