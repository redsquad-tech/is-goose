const toEnvPart = (value: string): string =>
  value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

const mapMcpExtKey = (
  parts: string[],
  value: string,
): [string, string] | null => {
  if (parts.length < 4) {
    return null;
  }
  const extensionId = toEnvPart(parts[2] ?? "");
  const rest = toEnvPart(parts.slice(3).join("_"));
  if (!extensionId || !rest) {
    return null;
  }
  return [`MCP_EXT_${extensionId}_${rest}`, value];
};

export const mapSecretsToServerEnv = (
  records: Record<string, string>,
): Record<string, string> => {
  const mapped: Record<string, string> = {};

  for (const [key, value] of Object.entries(records)) {
    const parts = key.split(".");
    const head = parts[0] ?? "";

    if (head === "provider" && parts.length >= 3) {
      const provider = toEnvPart(parts[1] ?? "");
      const rest = toEnvPart(parts.slice(2).join("_"));
      if (provider && rest) {
        mapped[`PROVIDER_${provider}_${rest}`] = value;
      }
      continue;
    }

    if (head === "sftp" && parts.length >= 2) {
      const rest = toEnvPart(parts.slice(1).join("_"));
      if (rest) {
        mapped[`SFTP_${rest}`] = value;
      }
      continue;
    }

    if (head === "mcp" && parts[1] === "system" && parts.length >= 3) {
      const rest = toEnvPart(parts.slice(2).join("_"));
      if (rest) {
        mapped[`MCP_SYSTEM_${rest}`] = value;
      }
      continue;
    }

    if (head === "mcp" && parts[1] === "ext") {
      const env = mapMcpExtKey(parts, value);
      if (env) {
        mapped[env[0]] = env[1];
      }
      continue;
    }

    if (head === "server" && parts.length >= 2) {
      const rest = toEnvPart(parts.slice(1).join("_"));
      if (rest) {
        mapped[`SERVER_${rest}`] = value;
      }
      continue;
    }

    const fallback = toEnvPart(key);
    if (fallback) {
      mapped[`APP_SECRET_${fallback}`] = value;
    }
  }

  return mapped;
};
