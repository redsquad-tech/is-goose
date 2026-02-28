import { spawnSync } from "node:child_process";

const hasCommand = (command) => {
  const check = spawnSync("sh", ["-lc", `command -v ${command}`], {
    stdio: "ignore",
  });
  return check.status === 0;
};

const toSignature = (failedFiles, failedTests) => `${failedFiles}:${failedTests}`;

export default class NotifyOnFailureReporter {
  constructor() {
    this.platform = process.platform;
    this.notifyEnabled = this.resolveNotifyEnabled();
    this.warnedMissingNotify = false;
    this.lastFailureSignature = "";
  }

  resolveNotifyEnabled() {
    if (this.platform === "linux") {
      return hasCommand("notify-send");
    }
    if (this.platform === "darwin") {
      return hasCommand("osascript");
    }
    return false;
  }

  notify(title, message) {
    if (this.platform === "linux") {
      spawnSync("notify-send", [title, message, "-u", "critical"], {
        stdio: "ignore",
      });
      return;
    }

    if (this.platform === "darwin") {
      const escapedTitle = title.replaceAll('"', '\\"');
      const escapedMessage = message.replaceAll('"', '\\"');
      const script = `display notification "${escapedMessage}" with title "${escapedTitle}"`;
      spawnSync("osascript", ["-e", script], { stdio: "ignore" });
    }
  }

  warningMessage() {
    if (this.platform === "linux") {
      return "notify-send not found; OS notifications are disabled.";
    }
    if (this.platform === "darwin") {
      return "osascript not found; OS notifications are disabled.";
    }
    return `OS notifications are disabled on platform: ${this.platform}`;
  }

  onFinished(files) {
    let failedFiles = 0;
    let failedTests = 0;

    for (const file of files) {
      const result = file.result;
      if (!result) {
        continue;
      }

      if (result.state === "fail") {
        failedFiles += 1;
      }
      failedTests += result.failed ?? 0;
    }

    if (failedFiles === 0 && failedTests === 0) {
      this.lastFailureSignature = "";
      return;
    }

    const signature = toSignature(failedFiles, failedTests);
    if (signature === this.lastFailureSignature) {
      return;
    }
    this.lastFailureSignature = signature;

    if (!this.notifyEnabled) {
      if (!this.warnedMissingNotify) {
        this.warnedMissingNotify = true;
        console.warn(this.warningMessage());
      }
      return;
    }

    this.notify("Tests Failed", `Failed files: ${failedFiles}, failed tests: ${failedTests}`);
  }
}
