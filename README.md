**English** | [Français](README.fr.md)

# AI Task List for iCUE

AI Task List displays active tasks and unread results from AI assistants on the CORSAIR XENEON EDGE. The built-in adapter supports Codex, Work, and ChatGPT whenever their state is available to the desktop app. Other clients can publish their own tasks through the [documented JSON format](docs/en/providers.md).

The gray line shows the current activity, turn number, and duration. The large timer uses goal time when available, or the processing time accumulated since the latest user request. A completed task remains visible until its source no longer reports it as unread. A fixed footer shows the usage percentage for each Codex / Work quota window returned for the connected account.

<img width="845" height="354" alt="image" src="https://github.com/user-attachments/assets/129c2cc7-db78-4abd-9285-db86a49ec94b" /> <img width="845" height="349" alt="image" src="https://github.com/user-attachments/assets/25e46e2f-986c-4d89-8ed1-597afdc07f4d" />


## Download the widget

- [AI Task List 2.1.0 for iCUE](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-2.1.0.icuewidget)
- [Widget installation and usage guide](docs/en/widget.md)

Import the `.icuewidget` file directly into iCUE. To provide data to the widget, start the collector or publish a compatible file at the path described in the guide.

## Install on Windows

You need iCUE 5.52 or later and a XENEON EDGE. To monitor Codex, open the desktop app under the same Windows account. The package includes the official Node.js binary and the collector scripts.

1. Extract the Windows archive, then verify the installer and collector signatures in PowerShell.

   ```powershell
   Get-AuthenticodeSignature .\Install-AI-Task-Collector.ps1, .\app\node.exe
   ```

   A signed distribution must report `Valid` for both files. The Node.js binary is signed by the OpenJS Foundation. Archives named `unsigned-preview` are development builds with an unsigned installer.

2. Run `.\Install-AI-Task-Collector.ps1` in PowerShell. The collector starts for the current user and runs again at sign-in when Windows allows the installer to create its startup shortcut. The installer waits for Enter before closing; add `-NoPause` for an unattended installation. If startup shortcut creation fails, rerun the command to start the collector in a new session. Add `-NoCodex` to use only external providers.
3. Import `AI-Task-List-2.1.0.icuewidget` into iCUE. Allow access to `<Home>/AI-Task-List/tasks.json` when prompted, then add **AI Task List** to the display.

The widget refreshes after the next file update. If the collector is unavailable, check the modification time of `%USERPROFILE%\AI-Task-List\tasks.json` and the file permission granted in iCUE.

To uninstall the collector, run `.\Install-AI-Task-Collector.ps1 -Uninstall`. Provider files in `sources` are preserved. Remove the widget from the iCUE display separately.

## Desktop client detection and localization

When the task list is empty, the widget distinguishes an open client with no active task from a computer where no configured desktop client is running. Active tasks and unread results always take priority over this empty state. After installation, client detection is configured in `%LOCALAPPDATA%\AI-Task-List\app\clients.json`. Each entry contains an ID, a label, and one or more Windows process names. ChatGPT / Codex Desktop (`ChatGPT.exe`) is included by default. Add an entry to the `clients` array, then restart the collector to support another desktop client.

The interface follows the language supplied by iCUE. English and French are included in `widget\translation.json`. To add a translation, duplicate the `en` object, replace its language code, and translate the values without changing the keys. The build rejects incomplete locales. If the iCUE translation service is unavailable, the widget uses French for a French locale and English otherwise.

## Data and permissions

The collector runs with the current Windows user's permissions. The Codex adapter opens the catalog and SQLite databases in read-only mode. Every five minutes, it also requests quota data through the Codex app server, which reuses the existing account session. The output file contains task IDs and titles, state, source, model, reasoning effort, available timers, and quota counters. The widget receives permission to read this one file. Task collection remains local; quota retrieval uses Codex network access. Neither the collector nor the widget opens a listening port or requires an additional API key.

## Build and sign

Building requires the official Node.js 26 or later Windows binary and the Corsair `icuewidget` CLI on `PATH`. With CLI 0.5 or later, validation also covers permissions. The build validates the widget, runs the tests, writes artifacts to `dist/`, and includes the license for the bundled Node.js version. Use `-NodeLicense` to supply the license from a local file.

```powershell
.\build.ps1
.\build.ps1 -SigningThumbprint 'CERTIFICATE_THUMBPRINT'
```

The second command requires a Windows-trusted code-signing certificate and its private key in the current user's personal certificate store. The build verifies the official Node.js signature, records SHA-256 hashes for the binary and collector scripts in the installer, then signs and verifies the installer. Any signature error stops a signed build.

- [iCUE File System plugin](https://docs.elgato.com/icue/widgets/references/plugins/file-system-provider/)
- [Create an iCUE widget package](https://docs.elgato.com/icue/widgets/)
- [Authenticode signing in PowerShell](https://learn.microsoft.com/powershell/module/microsoft.powershell.security/set-authenticodesignature)
