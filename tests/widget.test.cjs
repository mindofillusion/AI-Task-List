"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

test("subscribes to iCUE and renders only fresh snapshots with correct timers", () => {
  const widget = path.join(__dirname, "..", "widget");
  const source = fs.readFileSync(path.join(widget, "scripts", "main.js"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(widget, "manifest.json"), "utf8"));
  const watched = [];
  let listener;
  const plugin = {
    fileChanged: { connect(callback) { listener = callback; } },
    watchPath(file) { watched.push(file); }
  };
  const element = () => ({
    style: {}, classList: { add() {}, remove() {} }, setAttribute() {},
    appendChild() {}, replaceChildren() {}, remove() {}, getBoundingClientRect() { return { top: 0 }; },
    scrollTop: 0
  });
  const context = vm.createContext({
    window: { plugins: { Filesystemprovider: plugin } },
    document: { createElement: element, getElementById: element },
    clearTimeout() {}, setTimeout() {}, Intl, Date
  });
  vm.runInContext(source.split("\ninitialize().catch")[0] + "\nwatchSnapshot();", context);
  assert.deepEqual(watched, [manifest.permissions[0].path.replace("<Home>", "{Home}")]);
  const task = { id: "test:1", title: "Test", source: "Test Client", state: "inProgress",
    activity: "analysis", requestTurnNumber: 2, elapsedSeconds: 12, requestElapsedSeconds: 28 };
  function render(snapshot) { listener(watched[0], JSON.stringify(snapshot)); }
  function row() { return vm.runInContext('rowDataMap.get("test:1")', context); }
  listener(watched[0], "{");
  render({ schemaVersion: 1, updatedAt: Date.now() - 30_000, tasks: [task] });
  assert.equal(row(), undefined);
  render({ schemaVersion: 1, updatedAt: Date.now(), tasks: [task] });
  assert.match(row().metadata.textContent, /^Test Client/);
  assert.match(row().subtitle.textContent, /Tour 2/);
  assert.equal(row().value.textContent, vm.runInContext("formatDuration(28)", context));
  const original = row();
  render({ schemaVersion: 1, updatedAt: Date.now(), tasks: [{ ...task, goalElapsedSeconds: 138 }] });
  assert.equal(row(), original);
  assert.equal(row().value.textContent, vm.runInContext("formatDuration(138)", context));
});
