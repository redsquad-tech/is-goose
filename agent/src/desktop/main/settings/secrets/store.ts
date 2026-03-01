import fs from "node:fs";
import path from "node:path";
import { createSecretAuditEntry, emitSecretAudit } from "./audit.js";
import type {
  SecretBackend,
  SecretMetadata,
  SecretRecord,
  SecretStatus,
} from "./types.js";

type SecretState = {
  records: Record<string, SecretRecord>;
};

type SecretStoreOptions = {
  configDir: string;
  crypto?: SecretCrypto;
};

export type SecretCrypto = {
  isAvailable: () => boolean;
  encrypt: (input: string) => string;
  decrypt: (input: string) => string;
};

const SECRET_ENV_PREFIX = "AGENT_SECRET_KEY_HEX_";

const nowIso = (): string => new Date().toISOString();

const scopeFromKey = (key: string): string => {
  const scope = key.split(".")[0];
  return scope && scope.length > 0 ? scope : "unknown";
};

const encodeHex = (value: string): string =>
  Buffer.from(value, "utf8").toString("hex").toUpperCase();

const decodeHex = (value: string): string =>
  Buffer.from(value.toLowerCase(), "hex").toString("utf8");

const ensureDir = (directory: string): void => {
  fs.mkdirSync(directory, { recursive: true });
};

const parseEnvFile = (file: string): Record<string, string> => {
  if (!fs.existsSync(file)) {
    return {};
  }

  const lines = fs.readFileSync(file, "utf8").split("\n");
  const out: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1);
    out[name] = value;
  }
  return out;
};

const stringifyEnvFile = (entries: Record<string, string>): string => {
  const ordered = Object.keys(entries).sort();
  const lines = ordered.map((name) => `${name}=${entries[name] ?? ""}`);
  return `${lines.join("\n")}\n`;
};

const toSecretState = (records: Record<string, string>): SecretState => {
  const out: Record<string, SecretRecord> = {};
  for (const [key, value] of Object.entries(records)) {
    out[key] = { value, updatedAt: nowIso() };
  }
  return { records: out };
};

const normalizeState = (value: unknown): SecretState => {
  if (!value || typeof value !== "object") {
    return { records: {} };
  }
  const obj = value as Record<string, unknown>;
  const records =
    obj.records && typeof obj.records === "object"
      ? (obj.records as Record<string, unknown>)
      : {};

  const normalized: Record<string, SecretRecord> = {};
  for (const [key, raw] of Object.entries(records)) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const record = raw as Record<string, unknown>;
    if (typeof record.value !== "string" || record.value.length === 0) {
      continue;
    }
    normalized[key] = {
      value: record.value,
      updatedAt:
        typeof record.updatedAt === "string" && record.updatedAt.length > 0
          ? record.updatedAt
          : nowIso(),
    };
  }
  return { records: normalized };
};

export class DesktopSecretStore {
  private readonly encryptedFile: string;

  private readonly fallbackFile: string;

  private readonly crypto: SecretCrypto | undefined;

  private backend: SecretBackend;

  private state: SecretState = { records: {} };

  constructor(options: SecretStoreOptions) {
    ensureDir(options.configDir);
    this.encryptedFile = path.join(options.configDir, "secrets.enc");
    this.fallbackFile = path.join(options.configDir, "secrets.env");
    this.crypto = options.crypto;
    this.backend = this.crypto?.isAvailable()
      ? "keychain"
      : "fallback_env_file";

    this.state = this.loadState();
  }

  getStatus(): SecretStatus {
    return {
      backend: this.backend,
      initialized: Object.keys(this.state.records).length > 0,
    };
  }

  listMetadata(): SecretMetadata[] {
    return Object.entries(this.state.records)
      .map(([key, record]) => ({
        key,
        scope: scopeFromKey(key),
        hasValue: record.value.length > 0,
        updatedAt: record.updatedAt,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  getAllSecrets(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, record] of Object.entries(this.state.records)) {
      out[key] = record.value;
    }
    return out;
  }

  upsert(key: string, value: string): void {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      emitSecretAudit(
        createSecretAuditEntry("error", key, "error", "key_empty"),
      );
      throw new Error("Secret key must not be empty");
    }
    if (!value || value.length === 0) {
      emitSecretAudit(
        createSecretAuditEntry("error", trimmedKey, "error", "value_empty"),
      );
      throw new Error("Secret value must not be empty");
    }

    this.state.records[trimmedKey] = {
      value,
      updatedAt: nowIso(),
    };
    this.saveState();
    emitSecretAudit(createSecretAuditEntry("upsert", trimmedKey, "ok"));
  }

  remove(key: string): void {
    if (!this.state.records[key]) {
      return;
    }
    delete this.state.records[key];
    this.saveState();
    emitSecretAudit(createSecretAuditEntry("remove", key, "ok"));
  }

  private loadState(): SecretState {
    if (this.backend === "keychain") {
      try {
        if (!fs.existsSync(this.encryptedFile)) {
          return { records: {} };
        }
        const encrypted = fs.readFileSync(this.encryptedFile, "utf8");
        if (!encrypted) {
          return { records: {} };
        }
        const decrypted = this.crypto?.decrypt(encrypted);
        if (!decrypted) {
          return { records: {} };
        }
        return normalizeState(JSON.parse(decrypted) as unknown);
      } catch {
        this.backend = "fallback_env_file";
        emitSecretAudit(
          createSecretAuditEntry(
            "error",
            "storage",
            "error",
            "keychain_unavailable",
          ),
        );
      }
    }

    const env = parseEnvFile(this.fallbackFile);
    const decoded: Record<string, string> = {};
    for (const [name, value] of Object.entries(env)) {
      if (!name.startsWith(SECRET_ENV_PREFIX)) {
        continue;
      }
      const encodedKey = name.slice(SECRET_ENV_PREFIX.length);
      if (!encodedKey) {
        continue;
      }
      try {
        decoded[decodeHex(encodedKey)] = value;
      } catch {
        // skip invalid record
      }
    }
    return toSecretState(decoded);
  }

  private saveState(): void {
    if (this.backend === "keychain") {
      try {
        const serialized = JSON.stringify(this.state);
        const encrypted = this.crypto?.encrypt(serialized);
        if (!encrypted) {
          throw new Error("Encryption is unavailable");
        }
        fs.writeFileSync(this.encryptedFile, encrypted, "utf8");
        return;
      } catch {
        this.backend = "fallback_env_file";
        emitSecretAudit(
          createSecretAuditEntry(
            "error",
            "storage",
            "error",
            "fallback_switch",
          ),
        );
      }
    }

    const entries: Record<string, string> = {};
    for (const [key, record] of Object.entries(this.state.records)) {
      entries[`${SECRET_ENV_PREFIX}${encodeHex(key)}`] = record.value;
    }
    fs.writeFileSync(this.fallbackFile, stringifyEnvFile(entries), "utf8");
  }
}
