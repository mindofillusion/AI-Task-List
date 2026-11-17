**English** | [Français](../../browser/README.md)

# ChatGPT Web tracking

The extension displays in-progress conversations and unread results that are visible in the sidebar of a signed-in ChatGPT tab. It can also send those states to AI Task List Collector on the same Windows PC. The collector writes the local task file read by iCUE. [Privacy policy](../../PRIVACY.md)

## Install and turn on tracking

1. Extract the [Windows bundle](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-2.2.0-windows-unsigned-preview.zip) and run `.\Setup-AI-Task-List.ps1` in PowerShell.
2. Right-click **AI Task List Collector** in the Windows notification area. Choose **Install ChatGPT Web extension**, then a browser or **All detected browsers**. Confirm the installation when the store listing opens. **Awaiting publication** means the bundle has no published listing for that browser yet.
3. Open the extension panel and choose **Enable local tracking**. Keep a signed-in ChatGPT tab open with its sidebar visible. The tab can stay in the background.

| Browser | Store |
| --- | --- |
| Chrome, Brave, Vivaldi, Opera, Opera GX | Chrome Web Store |
| Edge | Microsoft Edge Add-ons |
| Firefox 142 or later | Mozilla Add-ons |

The Windows bundle includes the relay. Safari is outside its Windows scope. The relay path was verified in isolated Brave, Edge, Firefox and Chrome for Testing profiles using a local test page. Vivaldi, Opera and Opera GX have install routes that still need testing on those browsers.

## Test and troubleshoot

Start a request on another device signed in to the same account and workspace. Once the open sidebar on the XENEON EDGE PC shows it as active, compare the extension panel and widget. Check again after completion and after reading the result. The extension relies on the sidebar indicators. Temporary chats, hidden rows and suspended tabs can make activity unavailable or delay it. Model, reasoning effort and timers are shown when the collector has those values from another supported source.

The [display limitations](limitations.md) describe which fields are available from each source and link to the reports filed with OpenAI.

If the panel sees a conversation but iCUE does not, confirm that the tray collector is running and that `%USERPROFILE%\AI-Task-List\tasks.json` is being updated. Restart the collector through its icon near the clock if necessary. To stop Web tracking, use **Disable local tracking** in the extension panel. To remove the relay, run `.\browser\Install-ChatGPT-Web.ps1 -Uninstall` from the extracted Windows bundle, then remove the extension in the browser.

## Submit to the stores

The [publication guide](../../browser/PUBLICATION.md) contains the submission portals, listing copy, permission disclosures, reviewer instructions and steps for linking approved listings to the collector menu. The manifest IDs and native host are configured locally by the Windows setup. Keep an unpublished store entry set to `null` in `browser/stores.json`.
