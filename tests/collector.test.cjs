"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { createCollector } = require("../collector/main.cjs");

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
