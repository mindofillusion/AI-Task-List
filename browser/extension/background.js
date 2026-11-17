"use strict";

const CHAT_ID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const priority = { idle: 0, completedUnread: 1, inProgress: 2 };
const tabs = new Map();
let native;
let retry;
let revoked = 0;

function mergeTasks() {
  const tasks = new Map();
  for (const rows of tabs.values()) {
    for (const row of rows) {
      const existing = tasks.get(row.id);
      if (!existing || priority[existing.state] <= priority[row.state]) tasks.set(row.id, row);
    }
  }
  return [...tasks.values()].slice(-100);
}

function disconnectNative() {
  clearTimeout(retry);
  retry = null;
  const connected = native;
  native = null;
  if (connected) connected.disconnect();
}

function publish() {
  const tasks = mergeTasks();
  if (!native && tasks.length === 0) return;
  if (!native) {
    native = chrome.runtime.connectNative("fr.pierrechevalier.ai_task_list");
    const connected = native;
    native.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError?.message;
      if (native !== connected) return;
      if (error) console.warn(error);
      native = null;
      if (tabs.size > 0 && !retry) {
        retry = setTimeout(() => { retry = null; publish(); }, 5000);
      }
    });
  }
  native.postMessage({ tasks });
}

const panelUrl = chrome.runtime.getURL("panel.html");
chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  if (reason === "install" || reason === "update" && previousVersion === "0.2.0") {
    chrome.tabs.create({ url: panelUrl }).catch(() => {});
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.localRelayEnabled || changes.localRelayEnabled.newValue === true) return;
  revoked++;
  for (const port of tabs.keys()) port.disconnect();
  tabs.clear();
  disconnectNative();
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.url !== panelUrl || message?.type !== "visibleTasks") return;
  respond(mergeTasks().filter(({ state }) => state !== "idle").map(({ title, state }) => ({ title, state })));
});

chrome.runtime.onConnect.addListener((port) => {
  let origin;
  try { origin = new URL(port.sender.url).origin; } catch { return; }
  if (origin !== "https://chatgpt.com" || port.sender.frameId !== 0 || port.sender.tab?.incognito ||
      port.name !== "chatgpt-sidebar") return;
  tabs.set(port, []);
  port.onMessage.addListener(async (rows) => {
    if (!Array.isArray(rows) || rows.length > 100) return;
    const revision = revoked;
    const { localRelayEnabled } = await chrome.storage.local.get("localRelayEnabled").catch(() => ({}));
    if (localRelayEnabled !== true || revision !== revoked || !tabs.has(port)) return;
    const tasks = rows.flatMap((row) => {
      if (typeof row?.id !== "string" || !CHAT_ID.test(row.id)) return [];
      const id = row.id.toLowerCase();
      if (row.state === "idle") return [{ id, state: "idle" }];
      if (!["inProgress", "completedUnread"].includes(row.state) ||
          typeof row.title !== "string" || !row.title.trim()) return [];
      return [{ id, title: row.title.trim().slice(0, 300), state: row.state }];
    });
    tabs.set(port, tasks);
    publish();
  });
  port.onDisconnect.addListener(() => {
    tabs.delete(port);
    if (!tabs.size) disconnectNative();
    else publish();
  });
});
