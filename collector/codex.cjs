"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

// Async statuses used by the desktop catalog: streaming, realtime, busy, background.
const ACTIVE_CHATGPT_STATUSES = [3, 5, 6, 7];
const UNREAD_CHATGPT_STATUS = 4;

function resolvePaths(codexDirectory = path.join(os.homedir(), ".codex")) {
  return {
    catalogPath: path.join(codexDirectory, "sqlite", "codex.db"),
    historyPath: path.join(codexDirectory, "thread_history_1.sqlite"),
    queuePath: path.join(codexDirectory, "queue_1.sqlite"),
    statePath: path.join(codexDirectory, "state_5.sqlite"),
    goalsPath: path.join(codexDirectory, "goals_1.sqlite"),
    readStatePath: path.join(codexDirectory, ".codex-global-state.json")
  };
}

function openReadOnly(databasePath) {
  return new DatabaseSync(databasePath, {
    open: true,
    readOnly: true,
    enableForeignKeyConstraints: false,
    timeout: 1000
  });
}

function activityFromItem(item) {
  const activityByType = {
    agentMessage: "response",
    collabAgentToolCall: "subagent",
    commandExecution: "command",
    contextCompaction: "context",
    fileChange: "files",
    imageGeneration: "image",
    imageView: "image",
    mcpToolCall: "tool",
    reasoning: "analysis",
    subAgentActivity: "subagent",
    webSearch: "search"
  };
  return activityByType[item?.item_type] || "inprogress";
}

function taskSource(row, settings) {
  if (row.trial_conversation_type === "work" || row.conversation_origin === "tpp" ||
      settings?.originator === "codex_work_desktop" || row.source_kind === "work") {
    return "Work";
  }
  if (row.source_kind === "chatgpt") {
    return row.conversation_origin ? "Other" : "ChatGPT";
  }
  if (["vscode", "cli", "exec", "appServer", "codex"].includes(row.source_kind || settings?.source)) {
    return "Codex";
  }
  return "Other";
}

function readDesktopUnreadIds(readStatePath) {
  if (!readStatePath) return [];
  try {
    const globalState = JSON.parse(fs.readFileSync(readStatePath, "utf8"));
    const readState = globalState["electron-thread-read-state-v1"];
    const ids = new Set();
    for (const hosts of Object.values(readState?.unreadByIdentity ?? {})) {
      for (const [host, threadIds] of Object.entries(hosts ?? {})) {
        if (!host.startsWith("local:") || !Array.isArray(threadIds)) continue;
        for (const id of threadIds) {
          if (typeof id === "string") ids.add(id);
        }
      }
    }
    return [...ids];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function collectTasks(paths = resolvePaths(), nowMs = Date.now()) {
  const catalog = openReadOnly(paths.catalogPath);
  let history = null;
  let queue = null;
  let state = null;
  let goals = null;

  try {
    history = openReadOnly(paths.historyPath);
    try {
      queue = openReadOnly(paths.queuePath);
    } catch {
      queue = null;
    }

    let threadSettings = null;
    const unreadIds = new Set(readDesktopUnreadIds(paths.readStatePath));
    try {
      if (paths.statePath) {
        state = openReadOnly(paths.statePath);
        threadSettings = state.prepare("SELECT title, source, originator, model, reasoning_effort, archived FROM threads WHERE id = ?");
        const receipts = state.prepare("SELECT thread_id FROM thread_read_receipts WHERE first_unread_turn IS NOT NULL");
        for (const { thread_id } of receipts.all()) unreadIds.add(thread_id);
      }
    } catch {
      // Older installations may not have the settings database or these columns.
    }

    let goalByThread = null;
    try {
      if (paths.goalsPath) {
        goals = openReadOnly(paths.goalsPath);
        goalByThread = goals.prepare(
          "SELECT status, time_used_seconds, updated_at_ms FROM thread_goals WHERE thread_id = ?"
        );
      }
    } catch {
      // Goal timing is optional on installations that do not expose it locally.
    }

    const columns = new Set(catalog.prepare("PRAGMA table_info(local_thread_catalog)").all().map(({ name }) => name));
    const column = (name) => columns.has(name) ? `c.${name}` : "NULL";
    const currentEntry = columns.has("missing_candidate") ? "AND c.missing_candidate = 0" : "";
    const hasAsyncStatus = columns.has("source_kind") && columns.has("chatgpt_async_status");
    const activeCloudRows = hasAsyncStatus ? `
      UNION ALL
      SELECT c.thread_id, CAST(c.source_updated_at * 1000 AS INTEGER), NULL,
             c.chatgpt_async_status <> ${UNREAD_CHATGPT_STATUS},
             c.chatgpt_async_status = ${UNREAD_CHATGPT_STATUS}
      FROM local_thread_catalog AS c
      WHERE c.source_kind = 'chatgpt' ${currentEntry}
        AND c.chatgpt_async_status IN (${[...ACTIVE_CHATGPT_STATUSES, UNREAD_CHATGPT_STATUS].join(", ")})
    ` : "";

    const activeRows = catalog.prepare(`
      WITH activity AS (
        SELECT thread_id, observed_at_ms, observed_at_ms AS local_observed_at_ms,
               1 AS running, 0 AS cloud_unread
        FROM active_chat_turns
        ${activeCloudRows}
      ),
      active AS (
        SELECT thread_id, MAX(observed_at_ms) AS observed_at_ms,
               MAX(local_observed_at_ms) AS local_observed_at_ms,
               MAX(running) AS running, MAX(cloud_unread) AS cloud_unread
        FROM activity
        GROUP BY thread_id
      )
      SELECT a.thread_id, c.display_title AS title, c.host_id, a.observed_at_ms,
             a.local_observed_at_ms, a.running, a.cloud_unread, ${column("source_kind")} AS source_kind,
             ${column("conversation_origin")} AS conversation_origin,
             ${column("trial_conversation_type")} AS trial_conversation_type
      FROM (
        SELECT * FROM active
        UNION ALL
        SELECT value, NULL, NULL, 0, 0
        FROM json_each(?) WHERE NOT EXISTS (SELECT 1 FROM active WHERE thread_id = value)
      ) AS a
      LEFT JOIN local_thread_catalog AS c ON c.thread_id = a.thread_id AND c.host_id = (
        SELECT c.host_id FROM local_thread_catalog AS c
        WHERE c.thread_id = a.thread_id ${currentEntry}
        ORDER BY CASE WHEN c.host_id = 'local' AND a.local_observed_at_ms IS NOT NULL THEN 0 ELSE 1 END,
                 c.source_updated_at DESC, c.host_id
        LIMIT 1
      )
      ORDER BY a.observed_at_ms DESC, title COLLATE NOCASE, a.thread_id
    `).all(JSON.stringify([...unreadIds]));

    const turnColumns = new Set(history.prepare("PRAGMA table_info(thread_turns)").all().map(({ name }) => name));
    // Count later continuations separately even when they share the root ID.
    // Only exclude a nested turn if the parent actually covers its interval.
    const topLevelTurn = turnColumns.has("root_turn_id") ? `
      AND NOT EXISTS (
        SELECT 1 FROM thread_turns AS parent
        WHERE parent.thread_id = t.thread_id AND parent.turn_id = t.root_turn_id
          AND parent.turn_id <> t.turn_id
          AND parent.started_at <= t.started_at
          AND parent.completed_at >= t.completed_at
      )
    ` : "";
    const timestampDuration = "MAX(0, (t.completed_at - t.started_at) * 1000)";
    const recordedDuration = turnColumns.has("duration_ms")
      ? `COALESCE(CASE WHEN t.duration_ms >= 0 THEN t.duration_ms END, ${timestampDuration})`
      : timestampDuration;
    const latestTurn = history.prepare(`
      SELECT t.turn_id, t.status, t.started_at, t.completed_at, t.rollout_ordinal,
             ${recordedDuration} AS elapsed_ms
      FROM thread_turns AS t
      WHERE t.thread_id = ? ${topLevelTurn}
      ORDER BY t.rollout_ordinal DESC
      LIMIT 1
    `);
    const firstUserItem = turnColumns.has("first_user_item_id") ? "t.first_user_item_id" : "NULL";
    // A steering message within a running turn does not start a new request.
    const requestBoundary = history.prepare(`
      SELECT t.rollout_ordinal AS turn_ordinal
      FROM thread_turns AS t
      WHERE t.thread_id = ? AND t.rollout_ordinal <= ?
        AND COALESCE(${firstUserItem}, (
               SELECT first.item_id FROM thread_items AS first
               WHERE first.thread_id = t.thread_id AND first.turn_id = t.turn_id
                 AND first.item_type = 'userMessage'
               ORDER BY first.rollout_ordinal LIMIT 1
              )) IS NOT NULL
      ORDER BY t.rollout_ordinal DESC
      LIMIT 1
    `);
    const requestTurns = history.prepare(`
      SELECT COUNT(*) AS turn_count,
             SUM(CASE
               WHEN t.status = 'inProgress' THEN NULL
               ELSE ${recordedDuration}
             END) AS finished_ms
      FROM thread_turns AS t
      WHERE t.thread_id = $thread AND t.rollout_ordinal BETWEEN $boundary AND $latest
        AND t.status IN ('completed', 'failed', 'interrupted', 'inProgress')
        ${topLevelTurn}
    `);
    const latestItem = history.prepare(`
      SELECT item_type, started_at_ms, completed_at_ms
      FROM thread_items
      WHERE thread_id = ? AND turn_id = ?
      ORDER BY updated_at_ordinal DESC, rollout_ordinal DESC
      LIMIT 1
    `);
    const queueCount = queue
      ? queue.prepare("SELECT COUNT(*) AS count FROM queued_items WHERE thread_id = ?")
      : null;

    const tasks = [];
    for (const row of activeRows) {
      const turn = latestTurn.get(row.thread_id);
      const settings = threadSettings?.get(row.thread_id);
      const completedUnread = !row.running && (row.cloud_unread ||
        (settings?.archived !== 1 && unreadIds.has(row.thread_id) && turn?.status === "completed"));
      if (!row.running && !completedUnread) continue;

      const displayedTurn = completedUnread ? turn : turn?.status === "inProgress" ? turn : null;
      const item = displayedTurn ? latestItem.get(row.thread_id, displayedTurn.turn_id) : null;
      const queued = queueCount ? Number(queueCount.get(row.thread_id)?.count || 0) : 0;
      const startedAtMs = Number(displayedTurn?.started_at || 0) * 1000 || null;
      const completedAtMs = Number(displayedTurn?.completed_at || 0) * 1000 || null;
      const turnElapsedMs = completedUnread
        ? displayedTurn?.elapsed_ms ?? null
        : startedAtMs === null ? null : Math.max(0, nowMs - startedAtMs);
      const goal = goalByThread?.get(row.thread_id);
      const goalElapsedSeconds = goal
        ? Math.max(0, Math.floor(goal.time_used_seconds + (
          goal.status === "active" ? (nowMs - goal.updated_at_ms) / 1000 : 0
        )))
        : null;
      let requestElapsedMs = null;
      let requestTurnNumber = null;
      if (displayedTurn) {
        const latest = displayedTurn.rollout_ordinal;
        const boundary = requestBoundary.get(row.thread_id, latest);
        if (boundary) {
          const request = requestTurns.get({
            thread: row.thread_id, boundary: boundary.turn_ordinal, latest
          });
          requestTurnNumber = request.turn_count || null;
          const finishedMs = request.finished_ms;
          const activeMs = completedUnread ? null : turnElapsedMs;
          if (!goal && (finishedMs !== null || activeMs !== null)) {
            requestElapsedMs = (finishedMs ?? 0) + (activeMs ?? 0);
          }
        } else if (!goal) {
          requestElapsedMs = turnElapsedMs;
        }
      }

      tasks.push({
        id: row.thread_id,
        title: row.title || settings?.title || null,
        source: taskSource(row, settings),
        model: settings?.model || null,
        effort: settings?.reasoning_effort || null,
        state: completedUnread ? "completedUnread" : "inProgress",
        activity: completedUnread ? "completedUnread" : queued > 0 ? "waiting" : activityFromItem(item),
        hostId: String(row.host_id || "local"),
        queuedCount: queued,
        startedAt: startedAtMs,
        goalElapsedSeconds,
        elapsedSeconds: turnElapsedMs === null ? null : Math.floor(turnElapsedMs / 1000),
        requestElapsedSeconds: requestElapsedMs === null ? null : Math.floor(requestElapsedMs / 1000),
        requestTurnNumber,
        lastItemAt: Number(completedAtMs || item?.completed_at_ms || item?.started_at_ms || row.observed_at_ms || 0)
      });
    }
    tasks.sort((a, b) => Number(a.state === "completedUnread") - Number(b.state === "completedUnread") ||
      b.lastItemAt - a.lastItemAt || a.title?.localeCompare(b.title || "") || a.id.localeCompare(b.id));

    return {
      status: "ok",
      updatedAt: nowMs,
      count: tasks.length,
      tasks
    };
  } finally {
    if (goals) goals.close();
    if (state) state.close();
    if (queue) queue.close();
    if (history) history.close();
    catalog.close();
  }
}

module.exports = { collectTasks, resolvePaths };
