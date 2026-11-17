"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { createInterface } = require("node:readline");

const REFRESH_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 12_000;

function findCodex() {
  const executable = process.platform === "win32" ? "codex.exe" : "codex";
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue;
    const candidate = path.join(directory, executable);
    if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) return candidate;
  }
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA) return null;

  // A Windows sign-in session may not inherit the desktop app's CLI directory.
  const bin = path.join(process.env.LOCALAPPDATA, "OpenAI", "Codex", "bin");
  try {
    const installed = fs.readdirSync(bin, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(bin, entry.name, executable))
      .map((file) => ({ file, stat: fs.statSync(file, { throwIfNoEntry: false }) }))
      .filter(({ stat }) => stat?.isFile())
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    return installed[0]?.file ?? null;
  } catch {
    return null;
  }
}

function quotaWindows(result) {
  const limit = result?.rateLimitsByLimitId?.codex ??
    (result?.rateLimits?.limitId === "codex" ? result.rateLimits : null);
  return [limit?.primary, limit?.secondary]
    .filter((window) => Number.isFinite(window?.usedPercent) && window.usedPercent >= 0 &&
      Number.isSafeInteger(window.windowDurationMins) && window.windowDurationMins > 0)
    .map(({ usedPercent, windowDurationMins, resetsAt }) => ({
      usedPercent, windowDurationMins,
      resetsAt: Number.isSafeInteger(resetsAt) && resetsAt > 0 ? resetsAt : null
    }))
    .sort((a, b) => a.windowDurationMins - b.windowDurationMins);
}

async function readQuota(codexDirectory) {
  const executable = findCodex();
  if (!executable) return [];
  const env = codexDirectory
    ? { ...process.env, CODEX_HOME: path.resolve(codexDirectory) }
    : process.env;
  return new Promise((resolve) => {
    const child = spawn(executable, ["app-server"], {
      env, stdio: ["pipe", "pipe", "ignore"], windowsHide: true
    });
    const lines = createInterface({ input: child.stdout });
    const timeout = setTimeout(() => finish([]), REQUEST_TIMEOUT_MS);
    let finished = false;
    function finish(windows) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      lines.close();
      child.stdin.end();
      child.kill();
      resolve(windows);
    }
    function send(message) {
      child.stdin.write(JSON.stringify(message) + "\n");
    }
    child.on("error", () => finish([]));
    child.on("exit", () => finish([]));
    child.stdin.on("error", () => finish([]));
    lines.on("line", (line) => {
      let response;
      try { response = JSON.parse(line); } catch { return; }
      if (response.id === 1) {
        if (response.error) return finish([]);
        send({ method: "initialized" });
        send({ id: 2, method: "account/rateLimits/read" });
      }
      if (response.id === 2) finish(quotaWindows(response.result));
    });
    send({
      id: 1,
      method: "initialize",
      params: { clientInfo: { name: "ai_task_list", title: "AI Task List", version: "2.2.0" } }
    });
  });
}

module.exports = { quotaWindows, readQuota, REFRESH_MS };
