"use strict";

const CHAT_ROWS = "[data-sidebar-chatgpt-conversation-key], [data-app-action-sidebar-thread-row]";
const CHAT_KEY = "chatgpt:conversation:";
const CHAT_ID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const WORKING_LABEL = /^(?:working|running|in progress|en cours(?: de traitement)?|travail en cours|travaille)[. …]*$/i;
const UNREAD_LABEL = /^(?:unread(?: response)?|(?:réponse )?non lu[e]?(?:s)?)[. …]*$/i;

function readChatRow(row) {
  const link = row.querySelector('a[data-interactive-row-link][aria-label], a[href*="/c/"][aria-label]');
  if (!link) return null;
  const key = row.getAttribute("data-sidebar-chatgpt-conversation-key") ??
    row.getAttribute("data-app-action-sidebar-thread-id") ?? "";
  const { origin, pathname } = new URL(link.href);
  const id = key.startsWith(CHAT_KEY) ? key.slice(CHAT_KEY.length) :
    /^(?:\/g\/[^/]+)?\/c\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (!CHAT_ID.test(id ?? "") || !(pathname.endsWith("/c/" + id) || pathname.endsWith("/c/" + id + "/"))) return null;
  if (origin !== location.origin ||
      row.matches('[data-app-action-sidebar-thread-kind="codex"]')) return null;
  const title = link.getAttribute("aria-label")?.trim().slice(0, 300);
  if (!title) return null;
  const working = [...row.querySelectorAll('[role="status"][aria-label]')].some((node) =>
    WORKING_LABEL.test(node.getAttribute("aria-label").trim())) ||
    !!row.querySelector('svg[class~="motion-safe:animate-spin"], svg[class~="animate-spin"]');
  if (working) return { id, title, state: "inProgress" };

  const descriptions = (link.getAttribute("aria-describedby") ?? "").split(/\s+/);
  const unread = descriptions.some((description) => UNREAD_LABEL.test(
    document.getElementById(description)?.textContent?.trim() ?? ""));
  return unread ? { id, title, state: "completedUnread" } : { id, state: "idle" };
}

if (typeof chrome !== "undefined" && chrome.runtime?.connect) {
  const observed = new Set();
  let port;
  let previous = "";
  let scheduled = false;
  let enabled = false;

  function connect() {
    port = chrome.runtime.connect({ name: "chatgpt-sidebar" });
    const connected = port;
    port.onDisconnect.addListener(() => {
      if (port !== connected) return;
      port = null;
      previous = "";
      schedule();
    });
  }

  function publish() {
    if (!enabled) return;
    const rows = new Map();
    for (const element of document.querySelectorAll(CHAT_ROWS)) {
      const row = readChatRow(element);
      if (!row || row.state === "idle" && !observed.has(row.id)) continue;
      if (row.state !== "idle") {
        observed.delete(row.id);
        observed.add(row.id);
        if (observed.size > 100) observed.delete(observed.keys().next().value);
      }
      if (!rows.has(row.id) || row.state !== "idle") rows.set(row.id, row);
    }
    const tasks = [...rows.values()].slice(-100);
    const next = JSON.stringify(tasks);
    if (next === previous) return;
    try {
      if (!port) connect();
      port.postMessage(tasks);
      previous = next;
    } catch {
      // The next page mutation or visibility change can reconnect after a browser update.
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      publish();
    });
  }

  const sidebar = `${CHAT_ROWS}, [data-sidebar-navigation-root]`;
  const observer = new MutationObserver((records) => {
    if (records.some(({ target, addedNodes, removedNodes }) =>
      (target.nodeType === 1 ? target : target.parentElement)?.closest(sidebar) ||
      [...addedNodes, ...removedNodes].some((node) =>
        node.nodeType === 1 && (node.matches(sidebar) || node.querySelector(sidebar))))) {
      schedule();
    }
  });
  function setEnabled(value) {
    if (value === enabled) return;
    enabled = value;
    if (enabled) {
      observer.observe(document.body, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ["aria-label", "aria-describedby", "class", "href", "role",
          "data-sidebar-chatgpt-conversation-key", "data-app-action-sidebar-thread-id", "data-app-action-sidebar-thread-kind"]
      });
      document.addEventListener("visibilitychange", schedule);
      window.addEventListener("pageshow", schedule);
      publish();
      return;
    }
    observer.disconnect();
    document.removeEventListener("visibilitychange", schedule);
    window.removeEventListener("pageshow", schedule);
    const connected = port;
    port = null;
    if (connected) connected.disconnect();
    previous = "";
    observed.clear();
  }

  let preferenceChanged = false;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.localRelayEnabled) return;
    preferenceChanged = true;
    setEnabled(changes.localRelayEnabled.newValue === true);
  });
  chrome.storage.local.get("localRelayEnabled").then(({ localRelayEnabled }) => {
    if (!preferenceChanged) setEnabled(localRelayEnabled === true);
  }).catch(() => {});
}
