**English** | [Français](README.fr.md)

# AI Task List for iCUE

AI Task List displays active tasks and unread results from AI assistants on the CORSAIR XENEON EDGE. The built-in adapter supports Codex, Work, and ChatGPT whenever their state is available to the desktop app. Other clients can publish their own tasks through the [documented JSON format](docs/en/providers.md).

The gray line shows the current activity, turn number, and duration. The large timer uses goal time when available, or the processing time accumulated since the latest user request. A completed task remains visible until its source no longer reports it as unread. A fixed footer shows the usage percentage for each Codex / Work quota window returned for the connected account.

<img width="845" height="354" alt="image" src="https://github.com/user-attachments/assets/129c2cc7-db78-4abd-9285-db86a49ec94b" /> <img width="845" height="349" alt="image" src="https://github.com/user-attachments/assets/25e46e2f-986c-4d89-8ed1-597afdc07f4d" />

## Download

- [AI Task List 2.2.0 for iCUE](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-2.2.0.icuewidget)
- [Windows collector and widget 2.2.0, unsigned preview](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-2.2.0-windows-unsigned-preview.zip)
- [Widget installation and usage guide](docs/en/widget.md) and [display limitations and OpenAI issue links](docs/en/limitations.md)
- [ChatGPT Web setup](docs/en/chatgpt-web.md), [privacy policy](PRIVACY.md), and [store submission kit](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-Web-0.3.0-publication.zip)
- [Release history](CHANGELOG.md)
- [SHA-256 checksums](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/SHA256SUMS-2.2.0.txt)

Import the `.icuewidget` file directly into iCUE. To provide data to the widget, start the collector or publish a compatible file at the path described in the guide.

## Install on Windows

You need iCUE 5.52 or later and a XENEON EDGE. To monitor Codex, open the desktop app under the same Windows account. The package includes the official Node.js binary and the collector scripts.

1. Extract the Windows archive, then verify the installer and collector signatures in PowerShell.

   ```powershell
   Get-AuthenticodeSignature .\Setup-AI-Task-List.ps1, .\Install-AI-Task-Collector.ps1, .\app\AI-Task-Collector.exe, .\app\node.exe, .\browser\Install-ChatGPT-Web.ps1, .\browser\AI-Task-List-Web.exe
   ```

   A signed distribution must report `Valid` for each file. The Node.js binary is signed by the OpenJS Foundation. Archives named `unsigned-preview` are development builds with unsigned project scripts and executables.

2. Run `.\Setup-AI-Task-List.ps1` in PowerShell. The collector starts for the current user and runs again at sign-in when Windows allows the installer to create its startup shortcut. Setup configures the ChatGPT Web relay for detected browsers and opens the published extension listings. Confirm the installation in your browser. Use `-Browser Brave` to target one browser, `-SkipBrowser` to install only the collector, or `-WhatIf` to preview setup. The [ChatGPT Web guide](browser/README.md) also covers portable browsers.
3. Import the bundled `.icuewidget` into iCUE. Allow access to `<Home>/AI-Task-List/tasks.json` when prompted, then add **AI Task List** to the display. The previously imported 2.1.0 widget can read the new collector data.

The widget refreshes after the next file update. If the collector is unavailable, check the modification time of `%USERPROFILE%\AI-Task-List\tasks.json` and the file permission granted in iCUE.

Starting with the 2.1.1 collector, look for **AI Task List Collector** in the Windows notification area. Its menu lets you restart the collector or quit. The tray application restarts collection after Windows resumes and when the snapshot stops updating. A steering message sent during a turn keeps the current request timer running. The previously installed 2.1.0 widget can read these updates.

To add ChatGPT Web tracking after setup, right-click the collector icon and choose **Install ChatGPT Web extension**, then select your browser or **All detected browsers**. The dialog reports whether it opened the store listing or the extension is still awaiting publication. The 0.3.0 submission packages are available. The menu can open store listings once they are approved and their identifiers are in the installer’s catalog.

The desktop app can show a ChatGPT conversation as active while its activity is absent from the local catalog. The widget displays it when the collector receives a supported active or unread signal.

To uninstall the collector, run `.\Install-AI-Task-Collector.ps1 -Uninstall`. Provider files in `sources` are preserved. Remove the widget from the iCUE display separately.

## Desktop client detection and localization

When the task list is empty, the widget distinguishes an open client with no active task from a computer where no configured desktop client is running. Active tasks and unread results always take priority over this empty state. After installation, client detection is configured in `%LOCALAPPDATA%\AI-Task-List\app\clients.json`. Each entry contains an ID, a label, and one or more Windows process names. ChatGPT / Codex Desktop (`ChatGPT.exe`) is included by default. Add an entry to the `clients` array, then restart the collector to support another desktop client.

The interface follows the language supplied by iCUE. English and French are included in `widget\translation.json`. To add a translation, duplicate the `en` object, replace its language code, and translate the values without changing the keys. The build rejects incomplete locales. If the iCUE translation service is unavailable, the widget uses French for a French locale and English otherwise.

## Data and permissions

The collector runs with the current Windows user's permissions. The Codex adapter opens the catalog and SQLite databases in read-only mode. Every five minutes, it also requests quota data through the Codex app server, which reuses the existing account session. The output file contains task IDs and titles, state, source, model, reasoning effort, available timers, and quota counters. The widget receives permission to read this one file. Task collection remains local; quota retrieval uses Codex network access. Neither the collector nor the widget opens a listening port or requires an additional API key.

## Build and sign

Building requires the official Node.js 26 or later Windows binary, the .NET Framework C# compiler, and the Corsair `icuewidget` CLI on `PATH`. With CLI 0.5 or later, validation also covers permissions. The build validates the widget, runs the tests, writes artifacts to `dist/`, and includes the license for the bundled Node.js version. Use `-NodeLicense` to supply the license from a local file.

```powershell
.\build.ps1
.\build.ps1 -SigningThumbprint 'CERTIFICATE_THUMBPRINT'
```

The second command requires a Windows-trusted code-signing certificate and its private key in the current user's personal certificate store. The build verifies the official Node.js signature, signs the project executables and installers, and records SHA-256 hashes for the collector files. Any signature error stops a signed build. The build also produces a separate archive containing the extension packages for store submission.

- [iCUE File System plugin](https://docs.elgato.com/icue/widgets/references/plugins/file-system-provider/)
- [Create an iCUE widget package](https://docs.elgato.com/icue/widgets/)
- [Authenticode signing in PowerShell](https://learn.microsoft.com/powershell/module/microsoft.powershell.security/set-authenticodesignature)
