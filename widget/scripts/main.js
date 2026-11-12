const APP_VERSION = "2.0.0";
const SNAPSHOT_PATH = "{Home}/AI-Task-List/tasks.json";
const SNAPSHOT_TIMEOUT = 15_000;
const ACTIVE_ICON = "images/task-list.png";

const fallbackLabels = {
  Analysis: "Analyse",
  Command: "Commande",
  "Completed · unread": "Terminé · non lu",
  Context: "Contexte",
  Files: "Fichiers",
  Image: "Image",
  "In progress": "En cours",
  "No active task": "Aucune tâche active",
  "No unread result": "Aucun résultat non lu",
  "Untitled task": "Tâche sans titre",
  Other: "Autre",
  "Unknown model": "Modèle inconnu",
  "Unknown effort": "Effort inconnu",
  Effort: "Effort",
  Response: "Réponse",
  Search: "Recherche",
  "Waiting for collector": "Connexion au collecteur…",
  "Collector unavailable": "Collecteur indisponible",
  "Codex data unavailable": "Données Codex indisponibles",
  Starting: "Démarrage",
  "Sub-agent": "Sous-agent",
  Tool: "Outil",
  "Turn time": "Tour",
  Waiting: "En attente",
  min: "min"
};

const labels = { ...fallbackLabels };
const durationFormatter = typeof Intl.DurationFormat === "function"
  ? new Intl.DurationFormat("en", { style: "narrow", secondsDisplay: "always" })
  : null;
const rowDataMap = new Map();
const messageRowKey = Symbol("message");
let filesystem = null;
let watchdog = null;
let backgroundPath = null;

function property(name, fallback) {
  const value = window[name];
  return value === undefined || value === null || value === "" ? fallback : value;
}

async function translate(key) {
  try {
    const translator = typeof tr === "function" ? tr : window.tr;
    if (typeof translator === "function") {
      return await translator(key);
    }
  } catch (error) {
    console.warn("[CodexTaskList] Translation fallback:", error);
  }
  return fallbackLabels[key] || key;
}

async function initTranslations() {
  await Promise.all(
    Object.keys(fallbackLabels).map(async (key) => {
      labels[key] = await translate(key);
    })
  );
}

function activityLabel(activity) {
  const keyByActivity = {
    analysis: "Analysis",
    command: "Command",
    completedUnread: "Completed · unread",
    context: "Context",
    files: "Files",
    image: "Image",
    response: "Response",
    search: "Search",
    starting: "Starting",
    subagent: "Sub-agent",
    tool: "Tool",
    waiting: "Waiting"
  };
  return labels[keyByActivity[activity] || "In progress"];
}

function taskColor(task) {
  if (task.state === "completedUnread") return "#81d99b";
  if (task.activity === "waiting") return "#808080";
  return String(property("activityColor", "#FF9421"));
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  if (durationFormatter) {
    return durationFormatter.format({ hours, minutes, seconds });
  }
  return [hours && `${hours}h`, minutes && `${minutes}m`, `${seconds}s`].filter(Boolean).join(" ");
}

function ensureRow(key) {
  if (rowDataMap.has(key)) return rowDataMap.get(key);

  const container = document.createElement("div");
  container.className = "sensor-value sensor-value--normal";

  const leftGroup = document.createElement("div");
  leftGroup.className = "sensor-value__left";

  const iconContainer = document.createElement("div");
  iconContainer.className = "sensor-value__icon";
  iconContainer.setAttribute("aria-hidden", "true");
  leftGroup.appendChild(iconContainer);

  const labelsContainer = document.createElement("div");
  labelsContainer.className = "sensor-value__labels";

  const title = document.createElement("div");
  title.className = "sensor-value__title";

  const subtitle = document.createElement("div");
  subtitle.className = "sensor-value__subtitle";

  const metadata = document.createElement("div");
  metadata.className = "sensor-value__metadata";
  metadata.hidden = true;

  labelsContainer.appendChild(title);
  labelsContainer.appendChild(metadata);
  labelsContainer.appendChild(subtitle);
  leftGroup.appendChild(labelsContainer);

  const rightGroup = document.createElement("div");
  rightGroup.className = "sensor-value__right";
  rightGroup.hidden = true;

  const value = document.createElement("div");
  value.className = "sensor-value__value";

  rightGroup.appendChild(value);
  container.appendChild(leftGroup);
  container.appendChild(rightGroup);
  document.getElementById("sensorsValuesList").appendChild(container);

  const row = { container, iconContainer, title, metadata, subtitle, rightGroup, value };
  rowDataMap.set(key, row);
  return row;
}

function applyMaskedIcon(row, iconPath, color) {
  if (row.iconPath === iconPath && row.iconColor === color) return;
  row.iconPath = iconPath;
  row.iconColor = color;
  row.iconContainer.replaceChildren();
  row.iconContainer.style.backgroundColor = color;
  row.iconContainer.style.mask = `url(${iconPath}) no-repeat center / contain`;
  row.iconContainer.style.webkitMask = `url(${iconPath}) no-repeat center / contain`;
}

function updateText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function updateTaskRow(task) {
  const row = ensureRow(task.id);
  const color = taskColor(task);
  row.container.classList.remove("sensor-value--warning");
  row.container.classList.add("sensor-value--normal");
  applyMaskedIcon(row, ACTIVE_ICON, color);
  updateText(row.title, task.title || labels["Untitled task"]);
  const source = task.source && task.source !== "Other" ? task.source : labels.Other;
  const model = task.model || labels["Unknown model"];
  const effort = task.effort ? `${labels.Effort} ${task.effort}` : labels["Unknown effort"];
  updateText(row.metadata, `${source} · ${model} · ${effort}`);
  row.metadata.hidden = false;
  const activity = activityLabel(task.state === "completedUnread" ? task.state : task.activity);
  const hasGoalTime = Number.isFinite(task.goalElapsedSeconds);
  const turnNumber = Number.isInteger(task.requestTurnNumber) && task.requestTurnNumber > 0
    ? ` ${task.requestTurnNumber}`
    : "";
  const turnTime = Number.isFinite(task.elapsedSeconds) ? formatDuration(task.elapsedSeconds) : "";
  const turnLabel = turnNumber || turnTime ? `${labels["Turn time"]}${turnNumber}` : "";
  updateText(row.subtitle, [activity, turnLabel, turnTime].filter(Boolean).join(" · "));
  const primarySeconds = hasGoalTime ? task.goalElapsedSeconds : task.requestElapsedSeconds;
  const hasPrimaryTime = Number.isFinite(primarySeconds);
  updateText(row.value, hasPrimaryTime ? formatDuration(primarySeconds) : "");
  row.value.style.color = color;
  row.rightGroup.hidden = !hasPrimaryTime;
}

function updateMessageRow(title, subtitle, warning = false) {
  const row = ensureRow(messageRowKey);
  row.title.textContent = title;
  row.metadata.hidden = true;
  row.subtitle.textContent = subtitle;
  row.value.textContent = "";
  row.rightGroup.hidden = true;
  if (warning) {
    row.container.classList.add("sensor-value--warning");
    row.container.classList.remove("sensor-value--normal");
    applyMaskedIcon(row, ACTIVE_ICON, "#ffb06e");
  } else {
    row.container.classList.remove("sensor-value--warning");
    row.container.classList.add("sensor-value--normal");
    applyMaskedIcon(row, ACTIVE_ICON, "#808080");
  }
}

function removeExtraRows(visibleKeys) {
  for (const [key, row] of rowDataMap) {
    if (!visibleKeys.has(key)) {
      row.container.remove();
      rowDataMap.delete(key);
    }
  }
}

function renderTasks(tasks, codexAvailable) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    const subtitle = codexAvailable === false ? "Codex data unavailable" : "No unread result";
    updateMessageRow(labels["No active task"], labels[subtitle]);
    removeExtraRows(new Set([messageRowKey]));
  } else {
    const visibleKeys = new Set(tasks.map(({ id }) => id));
    const list = document.getElementById("sensorsValuesList");
    const viewportTop = list.getBoundingClientRect().top;
    const anchor = list.scrollTop > 0
      ? [...rowDataMap].find(([key, row]) =>
        visibleKeys.has(key) && row.container.getBoundingClientRect().bottom > viewportTop
      )?.[1].container
      : null;
    const anchorTop = anchor?.getBoundingClientRect().top;
    removeExtraRows(visibleKeys);
    // Existing nodes stay in place. Sorting only affects newly appended rows.
    const chronological = [...tasks].sort((a, b) =>
      (a.startedAt ?? a.lastItemAt ?? 0) - (b.startedAt ?? b.lastItemAt ?? 0)
    );
    chronological.forEach(updateTaskRow);
    if (anchor) {
      const shift = anchor.getBoundingClientRect().top - anchorTop;
      if (Math.abs(shift) > 0.5) list.scrollTop += shift;
    }
  }
}

function renderError() {
  updateMessageRow(labels["Collector unavailable"], `AI Task List · v${APP_VERSION}`, true);
  removeExtraRows(new Set([messageRowKey]));
}

function armWatchdog() {
  clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    renderError();
    watchSnapshot(true);
    armWatchdog();
  }, SNAPSHOT_TIMEOUT);
}

function acceptSnapshot(_filePath, content) {
  let payload;
  try {
    payload = JSON.parse(content);
  } catch {
    return;
  }
  const age = Date.now() - payload?.updatedAt;
  if (payload?.schemaVersion !== 1 || !Number.isFinite(age) || age < -5_000 ||
      age > SNAPSHOT_TIMEOUT || !Array.isArray(payload.tasks)) return;
  renderTasks(payload.tasks, payload.codexAvailable);
  armWatchdog();
}

function watchSnapshot(retry = false) {
  const plugin = window.plugins?.Filesystemprovider;
  if (!plugin) return;
  try {
    if (plugin !== filesystem) {
      plugin.fileChanged.connect(acceptSnapshot);
      filesystem = plugin;
    } else if (retry) {
      plugin.unwatchPath(SNAPSHOT_PATH);
    } else {
      return;
    }
    plugin.watchPath(SNAPSHOT_PATH);
  } catch (error) {
    console.warn("[AI Task List] File watch failed:", error);
  }
}

function applyBackground() {
  const media = property("backgroundMedia", null);
  const asset = media?.pathToAsset || null;
  const container = document.getElementById("media-background");
  if (asset !== backgroundPath) {
    container.replaceChildren();
    backgroundPath = asset;
    if (asset) {
      const video = /\.(mp4|webm|mkv)(?:[?#]|$)/i.test(asset);
      const element = document.createElement(video ? "video" : "img");
      if (video) {
        element.muted = true;
        element.loop = true;
        element.autoplay = true;
        element.playsInline = true;
      } else {
        element.alt = "";
      }
      element.src = asset;
      container.appendChild(element);
    }
  }
  document.documentElement.style.setProperty("--background-color", String(property("backgroundColor", "#000000")));
  document.documentElement.style.setProperty("--widget-opacity", String(Number(property("transparency", 80)) / 100));
}

function applyTextColor() {
  document.getElementById("sensorsValuesList").style.setProperty("--text-color", String(property("textColor", "#FFFFFF")));
}

function onIcueDataUpdated() {
  applyBackground();
  applyTextColor();
  watchSnapshot();
}

const icueCallbacks = { onDataUpdated: onIcueDataUpdated };
if (typeof icueEvents !== "undefined") {
  icueEvents = icueCallbacks;
} else {
  window.icueEvents = icueCallbacks;
}

async function initialize() {
  await initTranslations();
  updateMessageRow(labels["Waiting for collector"], "AI Task List");
  applyBackground();
  applyTextColor();
  pluginFilesystemproviderEvents = { onInitialized: watchSnapshot };
  watchSnapshot();
  armWatchdog();
}

initialize().catch((error) => {
  console.error("[CodexTaskList] Initialization failed:", error);
  renderError();
});
