**English** | [Français](../fr/widget.md)

# AI Task List on the CORSAIR XENEON EDGE

AI Task List displays active tasks and unread results. It refreshes the display whenever the collector updates `%USERPROFILE%\AI-Task-List\tasks.json`.

## Install the widget

1. Check that the XENEON EDGE appears in iCUE on Windows. The widget requires iCUE 5.52 or later.
2. Download [AI-Task-List-2.1.0.icuewidget](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-2.1.0.icuewidget).
3. In iCUE, select the XENEON EDGE, open the widget library, and use the **+** button to import the file. Allow iCUE to read `<Home>/AI-Task-List/tasks.json` when prompted. Add **AI Task List** to a display page. See the [Corsair import guide](https://www.corsair.com/uk/en/explorer/diy-builder/accessories/how-to-install-a-widget/).
4. Start the collector by following the [project instructions](../../README.md#install-on-windows). To test directly from the source tree, open PowerShell at the repository root with Node.js 26 or later, then run the command below and keep the window open.

```powershell
node .\collector\main.cjs
```

To monitor Codex, Work, or ChatGPT tasks, open the desktop app in the same Windows session. A task started elsewhere becomes visible as soon as its state reaches that app.

The package passes Corsair CLI validation. Testing on the physical display remains to be completed.

## Read and customize the display

- **Orange** marks an active task. **Green** marks a completed, unread result. The result disappears when its source marks it as read.
- The second line shows the available task source, model, and reasoning effort. The gray line shows state, turn number, and turn duration.
- The large timer on the right shows goal time when available. Otherwise, it accumulates processing time since the latest user request.
- The footer stays visible while the list scrolls. It shows the used percentage for each primary Codex / Work quota window returned by the service, for example **5 h 32% · 7 d 20%**. It is hidden when quota data is unavailable. Window durations come from the service and can vary by account.
- iCUE personalization settings control text and activity colors, the background, and its opacity.

## If no task appears

| Display | What to check |
| --- | --- |
| **Connecting to collector…** | Wait for the next snapshot. Check that the collector runs under the same Windows account as iCUE. |
| **Collector unavailable** | Check that `tasks.json` exists, is being updated, and is allowed by the iCUE file permission. |
| **Codex data unavailable** | Start the desktop app and check that the collector uses the same Windows account. |
| **No desktop client running** | Start ChatGPT / Codex Desktop or another client declared in `clients.json`. |
| **No active task** | Start a new request or wait for a remote task state to reach the desktop app. |

```powershell
Get-Item -LiteralPath (Join-Path $env:USERPROFILE 'AI-Task-List\tasks.json') |
  Select-Object FullName, LastWriteTime
```

The widget reads this file locally and opens no HTTP port. See the [provider guide](providers.md) to connect another AI assistant.

## Add another language

The widget follows the iCUE language and includes English and French. To add a locale, duplicate the `en` object in `widget\translation.json`, use the required language code, and translate every value without changing the keys. The build verifies that each locale contains the complete key set.
