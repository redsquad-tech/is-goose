import OpenAPISampler from "openapi-sampler";

import type { OpenAPISpec } from "./spec.js";

const pickContentType = (content: Record<string, unknown>): string | null => {
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

const sampleFromSchema = (schema: Record<string, unknown> | undefined, spec: OpenAPISpec): unknown => {
  if (!schema) {
    return {};
  }
  try {
    return OpenAPISampler.sample(schema, {}, spec);
  } catch {
    return {};
  }
};

export const buildResponseBody = (
  mediaTypeObject: Record<string, any>,
  spec: OpenAPISpec,
): unknown => {
  if (mediaTypeObject.example !== undefined) {
    return mediaTypeObject.example;
  }

  if (mediaTypeObject.examples && typeof mediaTypeObject.examples === "object") {
    const first = Object.values(mediaTypeObject.examples)[0] as Record<string, unknown> | undefined;
    if (first?.value !== undefined) {
      return first.value;
    }
  }

  return sampleFromSchema(mediaTypeObject.schema as Record<string, unknown> | undefined, spec);
};

export const resolveResponse = (
  operation: Record<string, any>,
  statusCode: number,
  spec: OpenAPISpec,
): { statusCode: number; contentType: string | null; body: unknown } => {
  const response = (operation.responses?.[String(statusCode)] ??
    operation.responses?.default ??
    {}) as Record<string, any>;
  const content = (response.content ?? {}) as Record<string, unknown>;
  const contentType = pickContentType(content);

  if (!contentType) {
    return { statusCode, contentType: null, body: null };
  }

  const mediaTypeObject = content[contentType] as Record<string, any>;
  const body = buildResponseBody(mediaTypeObject, spec);
  return { statusCode, contentType, body };
};

export const buildSsePayload = (operation: Record<string, any>, spec: OpenAPISpec): string => {
  const stream =
    operation.responses?.["200"]?.content?.["text/event-stream"] as Record<string, any> | undefined;
  const body = buildResponseBody(stream ?? {}, spec);
  return `data: ${JSON.stringify(body)}\n\n`;
};
