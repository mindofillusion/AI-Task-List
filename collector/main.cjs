"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseArgs } = require("node:util");
const { collectTasks, resolvePaths } = require("./codex.cjs");

const VERSION = "2.0.0";
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
        const task = publicTask(input, provider, provider);
        if (task) tasks.push(task);
      }
    } catch {
      // A producer may be replacing its file. Read the next snapshot on the next tick.
    }
  }
  return tasks;
}

function createCollector(outputDir, codexPaths) {
  const sourcesDir = path.join(outputDir, "sources");
  const output = path.join(outputDir, "tasks.json");
  fs.mkdirSync(sourcesDir, { recursive: true });
  // Create the file once. Replacing it would invalidate an existing iCUE file watch.
  fs.closeSync(fs.openSync(output, "a"));
  let lastCodexSuccess = null;
  return function publish(now = Date.now()) {
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
    tasks.push(...readExternalTasks(sourcesDir, now));
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const snapshot = {
      schemaVersion: 1,
      updatedAt: now,
      codexAvailable,
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

function main() {
  const { values } = parseArgs({ options: {
    "output-dir": { type: "string", default: path.join(os.homedir(), "AI-Task-List") },
    "codex-dir": { type: "string" },
    "no-codex": { type: "boolean" },
    "once": { type: "boolean" },
    "version": { type: "boolean" }
  } });
  if (values.version) {
    console.log(VERSION);
    return;
  }
  const paths = values["no-codex"] ? null : resolvePaths(values["codex-dir"]);
  const publish = createCollector(values["output-dir"], paths);
  publish();
  if (!values.once) {
    setInterval(() => {
      try {
        publish();
      } catch {
        console.error("Unable to update tasks.json. Retrying.");
      }
    }, 1_000);
  }
}

if (require.main === module) main();
module.exports = { createCollector };
