import { createHash } from "node:crypto";
import { createLogger } from "../../../../logging/index.js";
import type { SecretAuditAction, SecretAuditEntry } from "./types.js";

const logger = createLogger("desktop-secrets");

const scopeFromKey = (key: string): string => {
  const first = key.split(".")[0];
  return first && first.length > 0 ? first : "unknown";
};

const keyIdFromKey = (key: string): string =>
  createHash("sha256").update(key).digest("hex").slice(0, 12);

export const createSecretAuditEntry = (
  action: SecretAuditAction,
  key: string,
  result: "ok" | "error",
  reasonCode?: string,
): SecretAuditEntry => ({
  action,
  keyId: keyIdFromKey(key),
  scope: scopeFromKey(key),
  result,
  timestamp: new Date().toISOString(),
  ...(reasonCode ? { reasonCode } : {}),
});

export const emitSecretAudit = (entry: SecretAuditEntry): void => {
  logger.info("secret_audit", entry);
};
