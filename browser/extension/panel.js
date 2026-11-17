"use strict";

const french = chrome.i18n.getUILanguage().toLowerCase().startsWith("fr");
const strings = french ? {
  disclosure: "Si vous activez le suivi, l’extension lit les titres, les identifiants et les indicateurs d’activité affichés dans la barre latérale de ChatGPT. Elle les transmet au collecteur AI Task List sur ce PC pour le widget iCUE. L’éditeur ne reçoit aucune donnée de conversation.",
  enable: "Activer le suivi local",
  disable: "Désactiver le suivi local",
  paused: "Suivi désactivé.",
  active: "Suivi actif.",
  waiting: "Suivi actif. Gardez un onglet ChatGPT connecté avec sa barre latérale ouverte.",
  error: "L’état du suivi est momentanément indisponible.",
  inProgress: "En cours",
  completedUnread: "Terminé, non lu",
  tasks: "Activité ChatGPT",
  help: "Installation sous Windows et confidentialité"
} : {
  disclosure: document.getElementById("disclosure").textContent,
  enable: "Enable local tracking",
  disable: "Disable local tracking",
  paused: "Tracking is off.",
  active: "Tracking is on.",
  waiting: "Tracking is on. Keep a signed-in ChatGPT tab open with its sidebar visible.",
  error: "Tracking status is temporarily unavailable.",
  inProgress: "In progress",
  completedUnread: "Completed, unread",
  tasks: "ChatGPT activity",
  help: "Windows setup and privacy"
};
const toggle = document.getElementById("toggle");
const status = document.getElementById("status");
const tasks = document.getElementById("tasks");
document.documentElement.lang = french ? "fr" : "en";
document.getElementById("disclosure").textContent = strings.disclosure;
document.getElementById("help").textContent = strings.help;
tasks.setAttribute("aria-label", strings.tasks);
let enabled = false;
let changeInProgress = false;
let rendered = "";

async function refresh() {
  if (changeInProgress) return;
  try {
    const preference = await chrome.storage.local.get("localRelayEnabled");
    if (changeInProgress) return;
    enabled = preference.localRelayEnabled === true;
    toggle.textContent = enabled ? strings.disable : strings.enable;
    toggle.disabled = false;
    const rows = enabled ? await chrome.runtime.sendMessage({ type: "visibleTasks" }) : [];
    if (changeInProgress) return;
    const key = JSON.stringify(rows);
    if (key !== rendered) {
      rendered = key;
      tasks.replaceChildren(...rows.map(({ title, state }) => {
        const row = document.createElement("li");
        row.textContent = title + " · " + strings[state];
        return row;
      }));
      tasks.hidden = rows.length === 0;
    }
    const message = !enabled ? strings.paused : rows.length ? strings.active : strings.waiting;
    if (status.textContent !== message) status.textContent = message;
  } catch {
    status.textContent = strings.error;
  }
}

toggle.addEventListener("click", async () => {
  changeInProgress = true;
  toggle.disabled = true;
  try {
    await chrome.storage.local.set({ localRelayEnabled: !enabled });
  } catch {
    status.textContent = strings.error;
    return;
  } finally {
    changeInProgress = false;
    toggle.disabled = false;
  }
  await refresh();
});

refresh();
setInterval(refresh, 1500);
