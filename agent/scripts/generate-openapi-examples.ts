import fs from "node:fs";
import path from "node:path";

import OpenAPISampler from "openapi-sampler";

const specPath = path.resolve("requirements/GOOSE_SERVER_OPENAPI.json");
const raw = fs.readFileSync(specPath, "utf8");
const spec = JSON.parse(raw) as Record<string, unknown>;

const httpMethods = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
]);

const fallbackByType: Record<string, unknown> = {
  string: "example",
  integer: 1,
  number: 1,
  boolean: true,
  array: [],
  object: {},
};

const sampleSchema = (schema: Record<string, unknown> | undefined): unknown => {
  if (!schema) {
    return {};
  }

  try {
    return OpenAPISampler.sample(schema, {}, spec);
  } catch {
    const enumValues = schema.enum as unknown[] | undefined;
    if (enumValues && enumValues.length > 0) {
      return enumValues[0];
    }
    const schemaType = schema.type as string | undefined;
    if (schemaType && schemaType in fallbackByType) {
      return fallbackByType[schemaType];
    }
    return {};
  }
};

const ensureParameterExample = (parameter: Record<string, unknown>): void => {
  if (parameter.example !== undefined) {
    return;
  }
  const schema = parameter.schema as Record<string, unknown> | undefined;
  if (schema) {
    parameter.example = sampleSchema(schema);
  }
};

const ensureMediaExample = (mediaType: Record<string, unknown>): void => {
  if (mediaType.example !== undefined || mediaType.examples !== undefined) {
    return;
  }
  const schema = mediaType.schema as Record<string, unknown> | undefined;
  if (schema) {
    mediaType.example = sampleSchema(schema);
  }
};

const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
for (const pathItem of Object.values(paths ?? {})) {
  const pathLevelParameters = (pathItem.parameters ?? []) as Record<string, unknown>[];
  for (const parameter of pathLevelParameters) {
    ensureParameterExample(parameter);
  }

  for (const [method, operation] of Object.entries(pathItem)) {
    if (!httpMethods.has(method)) {
      continue;
    }

    const opParameters = (operation.parameters ?? []) as Record<string, unknown>[];
    for (const parameter of opParameters) {
      ensureParameterExample(parameter);
    }

    const requestBody = operation.requestBody as Record<string, unknown> | undefined;
    const requestContent = (requestBody?.content ?? {}) as Record<string, Record<string, unknown>>;
    for (const mediaType of Object.values(requestContent)) {
      ensureMediaExample(mediaType);
    }

    const responses = (operation.responses ?? {}) as Record<string, Record<string, unknown>>;
    for (const response of Object.values(responses)) {
      const responseContent = (response.content ?? {}) as Record<string, Record<string, unknown>>;
      for (const mediaType of Object.values(responseContent)) {
        ensureMediaExample(mediaType);
      }
    }
  }
}

const components = spec.components as Record<string, unknown> | undefined;
const schemas = (components?.schemas ?? {}) as Record<string, Record<string, unknown>>;
for (const schema of Object.values(schemas)) {
  if (schema.example !== undefined || schema.examples !== undefined) {
    continue;
  }
  schema.example = sampleSchema(schema);
}

fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
console.log("Generated examples for OpenAPI spec:", specPath);
