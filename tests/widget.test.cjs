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
  const translations = JSON.parse(fs.readFileSync(path.join(widget, "translation.json"), "utf8"));
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
  const elements = new Map();
  function elementById(id) {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  }
  const context = vm.createContext({
    window: { plugins: { Filesystemprovider: plugin } },
    document: { documentElement: { lang: "en", style: { setProperty() {} } },
      createElement: element, getElementById: elementById },
    navigator: { language: "fr-FR" }, clearTimeout() {}, setTimeout() {}, Intl, Date
  });
  vm.runInContext(source.split("\ninitialize().catch")[0] + "\nwatchSnapshot();", context);
  const fallbackKeys = vm.runInContext("Object.keys(fallbackTranslations.en).sort()", context);
  assert.deepEqual([...fallbackKeys], Object.keys(translations.en.translation).filter((key) =>
    fallbackKeys.includes(key)).sort());
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
  render({ schemaVersion: 1, updatedAt: Date.now(), tasks: [], clientState: "stopped" });
  const message = vm.runInContext("rowDataMap.get(messageRowKey)", context);
  assert.equal(message.title.textContent, "Aucun client de bureau actif");
  assert.match(message.subtitle.textContent, /client de bureau configuré/);
  const footer = elementById("quotaFooter");
  const weekly = { usedPercent: 20, windowDurationMins: 10080 };
  const short = { usedPercent: 0, windowDurationMins: 300 };
  assert.equal(footer.hidden, true);
  render({ schemaVersion: 1, updatedAt: Date.now(), tasks: [], quota: [weekly] });
  assert.equal(footer.hidden, false);
  assert.match(footer.textContent, /7 j 20 %$/);
  render({ schemaVersion: 1, updatedAt: Date.now(), tasks: [], quota: [short, weekly] });
  assert.match(footer.textContent, /5 h 0 % · 7 j 20 %$/);
  render({ schemaVersion: 1, updatedAt: Date.now(), tasks: [], quota: [
    { ...short, resetsAt: 1 }, { usedPercent: 23, windowDurationMins: 1440 }
  ] });
  assert.match(footer.textContent, /24 h 23 %$/);
  assert.doesNotMatch(footer.textContent, /5 h/);
});
