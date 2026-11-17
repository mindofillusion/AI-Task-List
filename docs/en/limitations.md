**English** | [Français](../fr/limitations.md)

# What the widget can display

The widget lists running tasks and completed results that their source reports as unread. An entry disappears when its source stops reporting it. Read results and conversation history are outside this list.

| Source | Available fields | Display limits |
| --- | --- | --- |
| **Codex and Work** | Title, source, state, activity, model, reasoning effort, turn number and timers when exposed by the local catalog. | Missing model or effort is shown as **Unknown model** or **Unknown effort**. Turn numbers and timers are shown when their values are available. |
| **ChatGPT via the Windows app** | Title and states exposed by the local catalog, plus any available conversation metadata. | Regular ChatGPT activity can appear late, be absent during generation, or appear only after completion. This also affects conversations started on another device. |
| **ChatGPT via the Web extension** | Title and **In progress** or **Completed, unread** state based on the visible sidebar markers. | The extension supplies these fields and the identifier used by the collector to match the conversation. Without matching local metadata, model and effort remain unknown and turn numbers and timers are blank. |
| **Other clients** | Fields supplied by a data provider. | Detecting an open desktop process shows that the client is present. Task activity requires a [data provider](providers.md). |

The main timer displays cumulative goal time when available. Otherwise it displays processing time accumulated since the latest user request. The smaller line shows the turn and its duration when available. Steering an active request preserves its accumulated time.

The footer displays the **Codex / Work** quota windows returned for the current account. Their duration depends on the account and the windows exposed by the service. For example, an account may display only a seven-day window. The footer is hidden when no valid window is available. Regular ChatGPT usage is outside these counters.

## Activity started on another device

On the iCUE PC, keep a ChatGPT tab signed in to the same account and workspace, with local tracking enabled and the sidebar open. The tab may stay in the background. Hidden sidebar rows, temporary chats and sleeping tabs can delay or prevent detection. Reading a result on another device clears its entry when the observed source stops reporting it as unread.

The 0.3.0 extension packages are ready for store submission. The tray menu shows **Awaiting publication** until the store catalog contains an approved listing for the browser. [ChatGPT Web setup](chatgpt-web.md)

## Reports filed with OpenAI

- The Windows desktop app can report an active ChatGPT Web turn as idle until it completes. [openai/codex #61143](https://github.com/openai/codex/issues/61143)
- Regular Chat activity can reach the Windows local catalog later and less consistently than Work and Codex activity. [openai/codex #61827](https://github.com/openai/codex/issues/61827)
