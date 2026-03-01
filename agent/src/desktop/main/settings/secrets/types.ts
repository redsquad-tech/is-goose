export type SecretBackend = "keychain" | "fallback_env_file";

export type SecretRecord = {
  value: string;
  updatedAt: string;
};

export type SecretMetadata = {
  key: string;
  scope: string;
  hasValue: boolean;
  updatedAt: string;
};

export type SecretStatus = {
  backend: SecretBackend;
  initialized: boolean;
};

export type SecretAuditAction = "upsert" | "remove" | "read" | "error";

export type SecretAuditEntry = {
  action: SecretAuditAction;
  keyId: string;
  scope: string;
  result: "ok" | "error";
  timestamp: string;
  reasonCode?: string;
};
