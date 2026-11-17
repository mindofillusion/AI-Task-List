"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { createCollector } = require("../collector/main.cjs");
const { detectConfiguredClients, readClientConfig } = require("../collector/clients.cjs");
const { quotaWindows } = require("../collector/usage.cjs");

test("combines fresh providers without exposing extra fields or replacing the watched file", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai-task-list-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const publish = createCollector(directory, null);
  const snapshotFile = path.join(directory, "tasks.json");
  const inode = fs.statSync(snapshotFile).ino;
  const now = 100_000;
  function source(name, updatedAt, tasks) {
    fs.writeFileSync(path.join(directory, "sources", name + ".json"),
      JSON.stringify({ schemaVersion: 1, updatedAt, tasks }));
  }
  source("test-client", now, [
    { id: "active", title: "Résumé", source: "Test Client", state: "inProgress",
      elapsedSeconds: 9, requestTurnNumber: 2, prompt: "private" },
    { id: "unread", state: "completedUnread" },
    { id: "read", state: "completed" }
  ]);
  source("other-client", now, [{ id: "active", state: "inProgress" }]);
  source("old-client", now - 30_001, [{ id: "stale", state: "inProgress" }]);
  source("future-client", now + 5_001, [{ id: "future", state: "inProgress" }]);
  fs.writeFileSync(path.join(directory, "sources", "partial.json"), "{");
  const data = publish(now);
  assert.deepEqual(data.tasks.map(({ id }) => id).sort(), [
    "other-client:active", "test-client:active", "test-client:unread"
  ]);
  assert.equal(data.codexAvailable, null);
  const task = data.tasks.find(({ id }) => id === "test-client:active");
  assert.equal(task.title, "Résumé");
  assert.equal(task.elapsedSeconds, 9);
  assert.equal(task.requestTurnNumber, 2);
  assert.equal(Object.hasOwn(task, "prompt"), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(snapshotFile, "utf8")), data);
  assert.equal(publish(now + 35_002).tasks.length, 0);
  assert.equal(fs.statSync(snapshotFile).ino, inode);
  assert.equal(JSON.parse(fs.readFileSync(snapshotFile, "utf8")).tasks.length, 0);
});

test("merges a live browser task and clears it when the browser reports it was read", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai-task-list-web-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const publish = createCollector(directory, null);
  const id = "6afb0e36-2504-83eb-bf02-b01e8d347de8";
  const source = path.join(directory, "sources", "chatgpt-web-1234.json");
  function set(state, updatedAt) {
    fs.writeFileSync(source, JSON.stringify({ schemaVersion: 1, updatedAt, tasks: [
      { id, title: "Test ChatGPT", state }, { id: "not-a-guid", title: "Ignored", state }
    ] }));
  }
  set("inProgress", 100_000);
  const [active] = publish(100_000).tasks;
  assert.equal(active.id, `codex:${id}`);
  assert.equal(active.source, "ChatGPT");
  assert.equal(active.state, "inProgress");
  assert.equal(active.elapsedSeconds, null);
  set("completedUnread", 101_000);
  assert.equal(publish(101_000).tasks[0].state, "completedUnread");
  set("idle", 102_000);
  assert.deepEqual(publish(102_000).tasks, []);
  set("inProgress", 100_000);
  assert.deepEqual(publish(131_000).tasks, []);
});

test("detects configured desktop clients and publishes their state", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai-task-list-clients-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const clients = readClientConfig(path.join(__dirname, "..", "collector", "clients.json"));
  const running = detectConfiguredClients(clients, ["ChatGPT.exe", "node.exe"]);
  const stopped = detectConfiguredClients(clients, ["node.exe"]);
  assert.equal(running.clientState, "running");
  assert.equal(running.clients[0].running, true);
  assert.equal(stopped.clientState, "stopped");
  assert.equal(stopped.clients[0].running, false);
  const snapshot = createCollector(directory, null, () => stopped)(100_000);
  assert.equal(snapshot.clientState, "stopped");
  assert.equal(snapshot.clients[0].label, "ChatGPT / Codex Desktop");
});

test("publishes only the reported windows of the shared Codex quota", () => {
  const weekly = { usedPercent: 20, windowDurationMins: 10080, resetsAt: 2_000_000_000 };
  const short = { usedPercent: 0, windowDurationMins: 300, resetsAt: 1_999_999_000 };
  assert.deepEqual(quotaWindows({ rateLimits: { limitId: "codex", primary: weekly } }), [weekly]);
  assert.deepEqual(quotaWindows({
    rateLimitsByLimitId: {
      codex: { primary: { ...weekly, internal: "private" }, secondary: short },
      other: { primary: { usedPercent: 70, windowDurationMins: 1440 } }
    }
  }), [short, weekly]);
  assert.deepEqual(quotaWindows({
    rateLimits: { limitId: "codex", primary: { usedPercent: 0, windowDurationMins: null } }
  }), []);
});
