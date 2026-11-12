**English** | [Français](../fr/providers.md)

# Add an AI client

A provider is a component that knows the task state of an AI client. It publishes a UTF-8 snapshot to `%USERPROFILE%\AI-Task-List\sources\<provider>.json`. The collector reads these snapshots once per second, merges the tasks, and writes the file consumed by iCUE.

The file name identifies the provider. Use lowercase letters, numbers, and hyphens, with at most 50 characters before the extension. `codex.json` is reserved for the built-in adapter.

```json
{
  "schemaVersion": 1,
  "updatedAt": 1794488400000,
  "tasks": [
    {
      "id": "task-42",
      "title": "Review the configuration",
      "source": "My AI client",
      "model": "my-model",
      "effort": "medium",
      "state": "inProgress",
      "activity": "analysis",
      "startedAt": 1794488380000,
      "elapsedSeconds": 20,
      "requestElapsedSeconds": 35,
      "requestTurnNumber": 2
    }
  ]
}
```

Set `updatedAt` to the write time in Unix milliseconds. Publish a complete snapshot after every change and at least once every 15 seconds. The collector rejects snapshots older than 30 seconds, larger than 256 KiB, or dated more than five seconds in the future. To avoid partial reads, write a temporary file first, then rename it over the provider file.

| Task field | Rule |
| --- | --- |
| `id` | Required. Stable identifier within this provider. IDs from different providers remain isolated. |
| `state` | Required. Use `inProgress` or `completedUnread`. Remove the task from the snapshot after its result is read. |
| `title`, `source`, `model`, `effort` | Optional labels. If `source` is missing, the provider name is displayed. |
| `activity` | Optional. Use `analysis`, `command`, `context`, `files`, `image`, `response`, `search`, `starting`, `subagent`, `tool`, or `waiting`. |
| `startedAt`, `lastItemAt` | Unix timestamps in milliseconds, used for initial ordering. |
| `elapsedSeconds`, `requestElapsedSeconds`, `goalElapsedSeconds` | Non-negative integers for turn time, latest-request time, and goal time. Omit unavailable values. |
| `requestTurnNumber` | Turn number within the latest request, starting at 1. |

The collector copies only documented fields and exposes at most 100 tasks to the widget. Each provider calculates durations from the activity data it can observe. To test an integration without reading Codex data, run `.\app\node.exe .\app\main.cjs --no-codex --once` from the extracted package.
