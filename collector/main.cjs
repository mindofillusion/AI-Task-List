"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseArgs } = require("node:util");
const { collectTasks, resolvePaths } = require("./codex.cjs");
const { createClientDetector } = require("./clients.cjs");
const { readQuota, REFRESH_MS } = require("./usage.cjs");

const VERSION = "2.2.0";
const SOURCE_TTL_MS = 30_000;
const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_TASKS = 100;

function displayText(value, limit) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, limit) || null : null;
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function publicTask(input, provider, fallbackSource) {
  const id = displayText(input?.id, 200);
  if (!id || !["inProgress", "completedUnread"].includes(input.state)) return null;
  return {
    id: `${provider}:${id}`,
    title: displayText(input.title, 300),
    source: displayText(input.source, 45) || fallbackSource,
    model: displayText(input.model, 100),
    effort: displayText(input.effort, 40),
    state: input.state,
    activity: displayText(input.activity, 40),
    startedAt: nonnegativeInteger(input.startedAt),
    lastItemAt: nonnegativeInteger(input.lastItemAt),
    goalElapsedSeconds: nonnegativeInteger(input.goalElapsedSeconds),
    requestElapsedSeconds: nonnegativeInteger(input.requestElapsedSeconds),
    elapsedSeconds: nonnegativeInteger(input.elapsedSeconds),
    requestTurnNumber: nonnegativeInteger(input.requestTurnNumber) || null
  };
}

function readExternalTasks(sourcesDir, now) {
  const tasks = [];
  const browserRows = new Map();
  for (const entry of fs.readdirSync(sourcesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^[a-z0-9][a-z0-9-]{0,49}\.json$/.test(entry.name) || entry.name === "codex.json") continue;
    const file = path.join(sourcesDir, entry.name);
    try {
      if (fs.statSync(file).size > MAX_SOURCE_BYTES) continue;
      const snapshot = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
      const updatedAt = nonnegativeInteger(snapshot.updatedAt);
      if (snapshot.schemaVersion !== 1 || updatedAt === null ||
          updatedAt < now - SOURCE_TTL_MS || updatedAt > now + 5_000 ||
          !Array.isArray(snapshot.tasks)) continue;
      const provider = path.basename(entry.name, ".json");
      for (const input of snapshot.tasks.slice(0, MAX_TASKS)) {
        if (/^chatgpt-web-\d+$/.test(provider)) {
          const id = input?.id;
          const priority = ["idle", "completedUnread", "inProgress"].indexOf(input?.state);
          if (typeof id !== "string" || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(id) ||
              priority < 0) continue;
          // Prefer the most recent observation from a connected browser profile.
          const current = browserRows.get(id);
          if (!current || current.updatedAt < updatedAt ||
              current.updatedAt === updatedAt && current.priority < priority) {
            browserRows.set(id, { input, updatedAt, priority });
          }
          continue;
        }
        const task = publicTask(input, provider, provider);
        if (task) tasks.push(task);
      }
    } catch {
      // A producer may be replacing its file. Read the next snapshot on the next tick.
    }
  }
  return { tasks, browserRows };
}

function createCollector(outputDir, codexPaths, detectClients = () => ({ clientState: "unknown", clients: [] })) {
  const sourcesDir = path.join(outputDir, "sources");
  const output = path.join(outputDir, "tasks.json");
  fs.mkdirSync(sourcesDir, { recursive: true });
  // Create the file once. Replacing it would invalidate an existing iCUE file watch.
  fs.closeSync(fs.openSync(output, "a"));
  let lastCodexSuccess = null;
  return function publish(now = Date.now(), quota = []) {
    let tasks = [];
    let codexAvailable = null;
    if (codexPaths) {
      try {
        tasks = collectTasks(codexPaths, now).tasks.slice(0, MAX_TASKS)
          .map((task) => publicTask(task, "codex", "Codex")).filter(Boolean);
        codexAvailable = true;
      } catch {
        codexAvailable = false;
      }
      if (lastCodexSuccess !== codexAvailable && !codexAvailable) {
        console.error("Codex data is unavailable. Check that the desktop app has created its local catalog.");
      }
      lastCodexSuccess = codexAvailable;
    }
    const external = readExternalTasks(sourcesDir, now);
    const byId = new Map([...tasks, ...external.tasks].map((task) => [task.id, task]));
    for (const [id, { input }] of external.browserRows) {
      const key = `codex:${id}`;
      const existing = byId.get(key);
      if (existing && existing.source !== "ChatGPT") continue;
      if (input.state === "idle") {
        byId.delete(key);
      } else {
        const task = publicTask({ id, title: input.title || existing?.title, state: input.state },
          "codex", "ChatGPT");
        byId.set(key, {
          ...(existing?.state === task.state ? existing : task), title: task.title,
          model: existing?.model ?? null, effort: existing?.effort ?? null
        });
      }
    }
    const clientStatus = detectClients(now);
    const snapshot = {
      schemaVersion: 1,
      updatedAt: now,
      codexAvailable,
      clientState: clientStatus.clientState,
      clients: clientStatus.clients,
      quota,
      tasks: [...byId.values()].slice(0, MAX_TASKS)
    };
    const bytes = Buffer.from(JSON.stringify(snapshot) + "\n");
    const fd = fs.openSync(output, "r+");
    try {
      fs.writeFileSync(fd, bytes);
      fs.ftruncateSync(fd, bytes.length);
    } finally {
      fs.closeSync(fd);
    }
    return snapshot;
  };
}

async function main() {
  const { values } = parseArgs({ options: {
    "output-dir": { type: "string", default: path.join(os.homedir(), "AI-Task-List") },
    "codex-dir": { type: "string" },
    "no-codex": { type: "boolean" },
    supervised: { type: "boolean" },
    "once": { type: "boolean" },
    "version": { type: "boolean" }
  } });
  if (values.version) {
    console.log(VERSION);
    return;
  }
  if (values.supervised) {
    process.stdin.once("end", () => process.exit(0));
    process.stdin.resume();
  }
  const codexDirectory = values["codex-dir"] || process.env.CODEX_HOME;
  const paths = values["no-codex"] ? null : resolvePaths(codexDirectory);
  const publish = createCollector(values["output-dir"], paths, createClientDetector());
  publish();
  let quota = [];
  const refreshQuota = async () => {
    quota = await readQuota(codexDirectory).catch(() => []);
  };
  if (values.once) {
    if (paths) {
      await refreshQuota();
      publish(Date.now(), quota);
    }
    return;
  }
  if (paths) {
    void refreshQuota();
    setInterval(refreshQuota, REFRESH_MS);
  }
  setInterval(() => {
    try {
      publish(Date.now(), quota);
    } catch {
      console.error("Unable to update tasks.json. Retrying.");
    }
  }, 1_000);
}

if (require.main === module) {
  main().catch(() => {
    console.error("Unable to start AI Task Collector.");
    process.exitCode = 1;
  });
}
module.exports = { createCollector };
