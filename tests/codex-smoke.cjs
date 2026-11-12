"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { collectTasks } = require("../collector/codex.cjs");

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-task-monitor-"));
const paths = {
  catalogPath: path.join(testRoot, "catalog.sqlite"),
  historyPath: path.join(testRoot, "history.sqlite"),
  queuePath: path.join(testRoot, "queue.sqlite"),
  statePath: path.join(testRoot, "state.sqlite"),
  goalsPath: path.join(testRoot, "goals.sqlite"),
  readStatePath: path.join(testRoot, "read-state.json")
};

try {
  const catalog = new DatabaseSync(paths.catalogPath);
  catalog.exec(`
    CREATE TABLE active_chat_turns (thread_id TEXT PRIMARY KEY, observed_at_ms INTEGER);
    CREATE TABLE local_thread_catalog (
      host_id TEXT,
      thread_id TEXT,
      display_title TEXT,
      source_updated_at REAL
    );
    INSERT INTO active_chat_turns VALUES ('thread-1', 200000);
    INSERT INTO active_chat_turns VALUES ('thread-2', 205000);
    INSERT INTO active_chat_turns VALUES ('chat-1', 208000);
    INSERT INTO local_thread_catalog VALUES ('local', 'thread-1', 'Construire le widget', 199);
    INSERT INTO local_thread_catalog VALUES ('local', 'thread-2', 'Tâche Work locale', 205);
    ALTER TABLE local_thread_catalog ADD COLUMN source_kind TEXT;
    ALTER TABLE local_thread_catalog ADD COLUMN conversation_origin TEXT;
    ALTER TABLE local_thread_catalog ADD COLUMN chatgpt_async_status INTEGER;
    UPDATE local_thread_catalog SET source_kind = 'vscode';
    INSERT INTO local_thread_catalog VALUES
      ('chatgpt', 'chat-1', 'Réponse ChatGPT', 210, 'chatgpt', NULL, 3),
      ('chatgpt', 'chat-2', 'Résultat Work', 208, 'chatgpt', 'tpp', 4),
      ('chatgpt', 'chat-3', 'Autre surface', 207, 'chatgpt', 'other', 6),
      ('chatgpt', 'chat-4', 'Conversation inactive', 211, 'chatgpt', NULL, NULL),
      ('chatgpt', 'thread-2', 'Copie synchronisée', 212, 'chatgpt', 'tpp', 6);
  `);
  catalog.close();

  const history = new DatabaseSync(paths.historyPath);
  history.exec(`
    CREATE TABLE thread_turns (
      thread_id TEXT,
      turn_id TEXT,
      rollout_ordinal INTEGER,
      status TEXT,
      started_at INTEGER,
      completed_at INTEGER
    );
    CREATE TABLE thread_items (
      thread_id TEXT,
      turn_id TEXT,
      item_type TEXT,
      rollout_ordinal INTEGER,
      updated_at_ordinal INTEGER,
      started_at_ms INTEGER,
      completed_at_ms INTEGER,
      item_id TEXT
    );
    INSERT INTO thread_turns VALUES ('thread-1', 'turn-1', 1, 'inProgress', 100, NULL);
    INSERT INTO thread_turns VALUES ('thread-2', 'turn-2', 1, 'inProgress', 160, NULL);
    ALTER TABLE thread_turns ADD COLUMN duration_ms INTEGER;
    ALTER TABLE thread_turns ADD COLUMN root_turn_id TEXT;
    UPDATE thread_turns SET rollout_ordinal = 4 WHERE thread_id = 'thread-1';
    INSERT INTO thread_turns VALUES
      ('thread-1', 'older-turn', 1, 'interrupted', 10, 50, 40500, 'older-turn'),
      ('thread-1', 'nested-turn', 2, 'completed', 15, 25, 10000, 'older-turn'),
      ('thread-1', 'later-turn', 3, 'completed', 70, 90, 19700, 'older-turn');
    INSERT INTO thread_items VALUES
      ('thread-1', 'older-turn', 'userMessage', 1, 1, 10000, 10000, 'original-request'),
      ('thread-1', 'turn-1', 'commandExecution', 2, 2, 150000, NULL, 'command');
  `);
  history.close();

  const queue = new DatabaseSync(paths.queuePath);
  queue.exec("CREATE TABLE queued_items (thread_id TEXT);");
  queue.close();

  const state = new DatabaseSync(paths.statePath);
  state.exec(`
    CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT, source TEXT, originator TEXT,
                          model TEXT, reasoning_effort TEXT, archived INTEGER);
    CREATE TABLE thread_read_receipts (thread_id TEXT PRIMARY KEY, first_unread_turn TEXT);
    INSERT INTO threads VALUES
      ('thread-1', 'Construire le widget', 'vscode', 'Codex Desktop', 'gpt-test', 'high', 0),
      ('thread-2', 'Tâche Work locale', 'vscode', 'codex_work_desktop', 'gpt-work', 'medium', 0);
  `);
  state.close();

  const goals = new DatabaseSync(paths.goalsPath);
  goals.exec(`
    CREATE TABLE thread_goals (thread_id TEXT PRIMARY KEY, status TEXT,
                               time_used_seconds INTEGER, updated_at_ms INTEGER);
    INSERT INTO thread_goals VALUES ('thread-1', 'active', 3600, 200000);
    INSERT INTO thread_goals VALUES ('thread-2', 'paused', 900, 190000);
  `);
  goals.close();

  const snapshot = collectTasks(paths, 220000);
  const byId = Object.fromEntries(snapshot.tasks.map((task) => [task.id, task]));
  assert.equal(snapshot.status, "ok");
  assert.equal(snapshot.count, 5);
  assert.equal(byId["thread-1"].title, "Construire le widget");
  assert.equal(byId["thread-1"].activity, "command");
  assert.equal(byId["thread-1"].elapsedSeconds, 120);
  assert.equal(byId["thread-1"].goalElapsedSeconds, 3620);
  assert.equal(byId["thread-1"].requestElapsedSeconds, null);
  assert.equal(byId["thread-1"].requestTurnNumber, 3);
  assert.equal(byId["thread-1"].source, "Codex");
  assert.equal(byId["thread-1"].model, "gpt-test");
  assert.equal(byId["thread-1"].effort, "high");
  assert.equal(byId["thread-2"].source, "Work");
  assert.equal(byId["thread-2"].title, "Tâche Work locale");
  assert.equal(byId["thread-2"].goalElapsedSeconds, 900);
  assert.equal(byId["chat-1"].source, "ChatGPT");
  assert.equal(byId["chat-1"].model, null);
  assert.equal(byId["chat-1"].effort, null);
  assert.equal(byId["chat-1"].elapsedSeconds, null);
  assert.equal(byId["chat-1"].goalElapsedSeconds, null);
  const withoutGoals = { ...paths, goalsPath: path.join(testRoot, "missing.sqlite") };
  const withoutGoalsById = Object.fromEntries(collectTasks(withoutGoals, 220000)
    .tasks.map((task) => [task.id, task]));
  assert.equal(withoutGoalsById["thread-1"].goalElapsedSeconds, null);
  assert.equal(withoutGoalsById["thread-1"].requestElapsedSeconds, 180);
  assert.equal(withoutGoalsById["thread-2"].requestElapsedSeconds, withoutGoalsById["thread-2"].elapsedSeconds);
  assert.equal(withoutGoalsById["thread-2"].requestTurnNumber, null);
  assert.equal(withoutGoalsById["chat-1"].requestElapsedSeconds, null);
  assert.equal(withoutGoalsById["chat-1"].requestTurnNumber, null);
  assert.equal(byId["chat-2"].source, "Work");
  assert.equal(byId["chat-2"].state, "completedUnread");
  assert.equal(byId["chat-3"].source, "Other");

  const editHistory = new DatabaseSync(paths.historyPath);
  const insertUserMessage = editHistory.prepare(`
    INSERT INTO thread_items VALUES ('thread-1', ?, 'userMessage', ?, ?, ?, NULL, ?)
  `);
  const activeRequest = () => collectTasks(withoutGoals, 220000).tasks.find(({ id }) => id === "thread-1");
  insertUserMessage.run("later-turn", 1, 1, 70000, "new-request");
  let current = activeRequest();
  assert.equal(current.requestElapsedSeconds, 139);
  assert.equal(current.requestTurnNumber, 2);

  insertUserMessage.run("turn-1", 1, 1, 100000, "latest-request");
  current = activeRequest();
  assert.equal(current.requestElapsedSeconds, 120);
  assert.equal(current.requestTurnNumber, 1);

  insertUserMessage.run("turn-1", 3, 3, 180000, "mid-turn-request");
  current = activeRequest();
  assert.equal(current.requestElapsedSeconds, 40);
  assert.equal(current.requestTurnNumber, 1);
  assert.equal(current.elapsedSeconds, 120);

  editHistory.exec("UPDATE thread_turns SET status = 'completed', completed_at = 200 WHERE turn_id = 'turn-1'");
  editHistory.close();
  const editCatalog = new DatabaseSync(paths.catalogPath);
  editCatalog.exec(`
    DELETE FROM active_chat_turns WHERE thread_id = 'thread-1';
    UPDATE local_thread_catalog SET chatgpt_async_status = NULL WHERE thread_id = 'chat-2';
  `);
  editCatalog.close();
  const setUnread = (ids) => fs.writeFileSync(paths.readStatePath, JSON.stringify({
    "electron-thread-read-state-v1": { unreadByIdentity: { profile: { "local:test": ids } } }
  }));
  setUnread(["thread-1"]);
  const afterCompletion = collectTasks(paths, 350000).tasks;
  const completed = afterCompletion.find(({ id }) => id === "thread-1");
  assert.equal(completed.state, "completedUnread");
  assert.equal(completed.elapsedSeconds, 100);
  const completedWithoutGoal = collectTasks(withoutGoals, 350000).tasks.find(({ id }) => id === "thread-1");
  assert.equal(completedWithoutGoal.requestElapsedSeconds, 20);
  assert.equal(completedWithoutGoal.requestTurnNumber, 1);
  assert(!afterCompletion.some(({ id }) => id === "chat-2"));
  setUnread([]);
  assert(!collectTasks(paths, 360000).tasks.some(({ id }) => id === "thread-1"));
  console.log("PASS Codex adapter: sources, settings, request timing, turn numbers and unread lifecycle");
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
