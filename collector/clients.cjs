"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DETECTION_TTL_MS = 5_000;

function normalizeProcessName(name) {
  return String(name || "").trim().toLowerCase().replace(/\.exe$/i, "");
}

function readClientConfig(configPath = path.join(__dirname, "clients.json")) {
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!Array.isArray(parsed.clients)) throw new Error("clients.json must contain a clients array");
  return parsed.clients.map((client) => {
    if (!client || typeof client.id !== "string" || typeof client.label !== "string" ||
        !Array.isArray(client.processNames) || client.processNames.length === 0) {
      throw new Error("Each configured client needs id, label and processNames");
    }
    const processNames = client.processNames.map(normalizeProcessName).filter(Boolean);
    if (processNames.length === 0) throw new Error(`Client ${client.id} has no valid process name`);
    return { id: client.id, label: client.label, processNames };
  });
}

function listWindowsProcessNames() {
  if (process.platform !== "win32") return [];
  const tasklistPath = path.join(process.env.WINDIR || "C:\\Windows", "System32", "tasklist.exe");
  const output = execFileSync(tasklistPath, ["/FO", "CSV", "/NH"], {
    encoding: "utf8",
    timeout: 2500,
    windowsHide: true
  });
  return output.split(/\r?\n/).map((line) => {
    const match = line.match(/^"((?:[^"]|"")*)"/);
    return normalizeProcessName(match ? match[1].replace(/""/g, '"') : "");
  }).filter(Boolean);
}

function detectConfiguredClients(clients, runningProcessNames = listWindowsProcessNames()) {
  const runningNames = new Set(runningProcessNames.map(normalizeProcessName));
  const detected = clients.map((client) => ({
    id: client.id,
    label: client.label,
    running: client.processNames.some((name) => runningNames.has(name))
  }));
  return {
    clientState: detected.length === 0 ? "unknown" : detected.some(({ running }) => running) ? "running" : "stopped",
    clients: detected
  };
}

function createClientDetector(configPath = path.join(__dirname, "clients.json"), ttlMs = DETECTION_TTL_MS) {
  let clients;
  try {
    clients = readClientConfig(configPath);
  } catch {
    return () => ({ clientState: "unknown", clients: [] });
  }
  let cachedAt = 0;
  let cached = { clientState: "unknown", clients: clients.map(({ id, label }) => ({ id, label, running: null })) };
  return function detect(now = Date.now()) {
    if (now - cachedAt < ttlMs) return cached;
    try {
      cached = detectConfiguredClients(clients);
    } catch {
      cached = { clientState: "unknown", clients: clients.map(({ id, label }) => ({ id, label, running: null })) };
    }
    cachedAt = now;
    return cached;
  };
}

module.exports = { createClientDetector, detectConfiguredClients, readClientConfig };
