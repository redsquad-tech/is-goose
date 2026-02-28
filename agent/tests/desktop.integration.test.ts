import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tsxCliPath = path.resolve("node_modules/tsx/dist/cli.mjs");

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForHealth = async (baseUrl: string): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/status`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until timeout
    }
    await wait(250);
  }
  throw new Error(`server health check timed out: ${baseUrl}`);
};

const waitForExit = (
  child: ChildProcessWithoutNullStreams,
): Promise<number | null> =>
  new Promise((resolve) => {
    child.once("exit", (code) => resolve(code));
  });

const killProcess = async (
  child: ChildProcessWithoutNullStreams,
): Promise<void> => {
  if (child.killed) {
    return;
  }
  child.kill("SIGTERM");
  await Promise.race([
    waitForExit(child),
    wait(1500).then(() => {
      child.kill("SIGKILL");
    }),
  ]);
};

const children: ChildProcessWithoutNullStreams[] = [];

afterEach(async () => {
  while (children.length > 0) {
    const child = children.pop();
    if (child) {
      await killProcess(child);
    }
  }
});

describe("MUST desktop integration requirements", () => {
  it("MUST start server and desktop probe as separate processes", async () => {
    const port = 33000 + Math.floor(Math.random() * 1000);
    const backendUrl = `http://127.0.0.1:${port}`;

    const server = spawn(
      process.execPath,
      [tsxCliPath, "src/server/index.ts"],
      {
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          PORT: String(port),
        },
        stdio: "pipe",
      },
    );
    children.push(server);

    await waitForHealth(backendUrl);

    const probe = spawn(
      process.execPath,
      [tsxCliPath, "src/desktop/devProbe.ts"],
      {
        env: {
          ...process.env,
          AGENT_SERVER_URL: backendUrl,
        },
        stdio: "pipe",
      },
    );
    children.push(probe);

    let probeStdout = "";
    let probeStderr = "";
    probe.stdout.on("data", (chunk) => {
      probeStdout += String(chunk);
    });
    probe.stderr.on("data", (chunk) => {
      probeStderr += String(chunk);
    });

    const code = await waitForExit(probe);
    await killProcess(probe);

    expect(server.pid).toBeDefined();
    expect(probe.pid).toBeDefined();
    expect(code).toBe(0);
    expect(probeStderr).toBe("");
    expect(probeStdout).toContain("desktop-probe:ok");
  });
});
