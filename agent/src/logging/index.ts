type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY =
  /(secret|token|authorization|password|x-secret-key|api[_-]?key)/i;

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = process.env.LOG_LEVEL;
const currentLevel: LogLevel =
  envLevel === "debug" ||
  envLevel === "info" ||
  envLevel === "warn" ||
  envLevel === "error"
    ? envLevel
    : "info";

const shouldLog = (level: LogLevel): boolean =>
  levelOrder[level] >= levelOrder[currentLevel];

const redactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactValue(val);
    }
    return out;
  }
  return value;
};

const write = (
  level: LogLevel,
  component: string,
  event: string,
  details?: Record<string, unknown>,
): void => {
  if (!shouldLog(level)) {
    return;
  }
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    component,
    event,
    ...(details ? (redactValue(details) as Record<string, unknown>) : {}),
  };
  const line = `${JSON.stringify(payload)}\n`;
  if (level === "error") {
    process.stderr.write(line);
    return;
  }
  process.stdout.write(line);
};

export const createLogger = (component: string) => ({
  debug: (event: string, details?: Record<string, unknown>): void =>
    write("debug", component, event, details),
  info: (event: string, details?: Record<string, unknown>): void =>
    write("info", component, event, details),
  warn: (event: string, details?: Record<string, unknown>): void =>
    write("warn", component, event, details),
  error: (event: string, details?: Record<string, unknown>): void =>
    write("error", component, event, details),
});
