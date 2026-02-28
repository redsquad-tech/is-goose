import { spawnSync } from "node:child_process";

type PreflightResult = {
  ok: boolean;
  messages: string[];
};

const hasCommand = (cmd: string): boolean => {
  const check = spawnSync("where", [cmd], { stdio: "ignore", shell: true });
  return check.status === 0;
};

const installWithWinget = (id: string): boolean => {
  const command = "winget";
  const args = [
    "install",
    "--id",
    id,
    "-e",
    "--source",
    "winget",
    "--accept-source-agreements",
    "--accept-package-agreements",
  ];
  const run = spawnSync(command, args, { stdio: "ignore", shell: true });
  return run.status === 0;
};

export const runWindowsPreflight = (): PreflightResult => {
  if (process.platform !== "win32") {
    return { ok: true, messages: [] };
  }

  const messages: string[] = [];
  const hasPowerShell = hasCommand("powershell");
  const hasWinget = hasCommand("winget");
  let hasGitBash = hasCommand("bash");

  if (!hasPowerShell) {
    messages.push("PowerShell is required but not available.");
  }

  if (!hasWinget) {
    messages.push("WinGet is required but not available.");
  }

  if (!hasGitBash) {
    if (hasWinget) {
      const installed = installWithWinget("Git.Git");
      hasGitBash = installed && hasCommand("bash");
      if (hasGitBash) {
        messages.push("Git Bash was installed with WinGet.");
      } else {
        messages.push("Git Bash auto-install attempt failed.");
      }
    } else {
      messages.push("Git Bash is required but missing.");
    }
  }

  return {
    ok: hasPowerShell && hasWinget && hasGitBash,
    messages,
  };
};
