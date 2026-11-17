[CmdletBinding()]
param(
  [switch]$Uninstall,
  [switch]$NoCodex,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'AI-Task-List'
$appDir = Join-Path $installDir 'app'
$browserSetupDir = Join-Path $installDir 'browser-setup'
$tray = Join-Path $appDir 'AI-Task-Collector.exe'
$runner = Join-Path $appDir 'node.exe'
$dataDir = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'AI-Task-List'
$snapshot = Join-Path $dataDir 'tasks.json'
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'AI Task List Collector.lnk'
$previousShortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'AI Task Collector.lnk'
$payloadHashes = @{
  'AI-Task-Collector.exe' = '__TRAY_SHA256__'
  'node.exe' = '__NODE_SHA256__'
  'main.cjs' = '__MAIN_SHA256__'
  'codex.cjs' = '__CODEX_SHA256__'
  'clients.cjs' = '__CLIENTS_CODE_SHA256__'
  'clients.json' = '__CLIENTS_CONFIG_SHA256__'
  'usage.cjs' = '__USAGE_SHA256__'
}
$payloadDir = Join-Path $PSScriptRoot 'app'
$browserPayload = Join-Path $PSScriptRoot 'browser'
$browserHashes = @{
  'Install-ChatGPT-Web.ps1' = '__BROWSER_SETUP_SHA256__'
  'AI-Task-List-Web.exe' = '__BROWSER_RELAY_SHA256__'
}
$browserFiles = @('Install-ChatGPT-Web.ps1', 'AI-Task-List-Web.exe', 'stores.json')

if (-not $Uninstall) {
  foreach ($file in $payloadHashes.Keys) {
    if ((Get-FileHash -LiteralPath (Join-Path $payloadDir $file) -Algorithm SHA256).Hash -ne $payloadHashes[$file]) {
      throw "Missing or modified collector file: $file"
    }
  }
  foreach ($file in $browserHashes.Keys) {
    if ((Get-FileHash -LiteralPath (Join-Path $browserPayload $file) -Algorithm SHA256).Hash -ne $browserHashes[$file]) {
      throw "Missing or modified browser installer file: $file"
    }
  }
  if (!(Test-Path -LiteralPath (Join-Path $browserPayload 'stores.json') -PathType Leaf)) {
    throw 'The browser store catalog is missing. Extract the complete Windows archive.'
  }
}

if (Test-Path -LiteralPath $tray -PathType Leaf) {
  $stop = Start-Process -FilePath $tray -ArgumentList '--stop' -WindowStyle Hidden -PassThru -Wait
  if ($stop.ExitCode -ne 0) { throw 'Unable to stop the running collector.' }
}

Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.ExecutablePath -eq $runner } |
  ForEach-Object {
    $runningCollector = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
    if ($runningCollector -and $runningCollector.Path -eq $runner) {
      Stop-Process -InputObject $runningCollector
      $runningCollector.WaitForExit()
    }
  }

if ($Uninstall) {
  $appFiles = $payloadHashes.Keys | ForEach-Object { Join-Path $appDir $_ }
  $browserInstallerFiles = $browserFiles | ForEach-Object { Join-Path $browserSetupDir $_ }
  foreach ($file in (@($shortcutPath, $previousShortcutPath, $snapshot) + $appFiles + $browserInstallerFiles)) {
    if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file }
  }
  Write-Host 'AI Task Collector removed. Provider files are preserved.'
  return
}

if (Test-Path -LiteralPath $previousShortcutPath -PathType Leaf) {
  Remove-Item -LiteralPath $previousShortcutPath -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $appDir,$browserSetupDir -Force | Out-Null
foreach ($file in $payloadHashes.Keys) {
  $destination = Join-Path $appDir $file
  if ($file -eq 'clients.json' -and (Test-Path -LiteralPath $destination -PathType Leaf)) { continue }
  Copy-Item -LiteralPath (Join-Path $payloadDir $file) -Destination $destination -Force
}
foreach ($file in $browserFiles) {
  Copy-Item -LiteralPath (Join-Path $browserPayload $file) -Destination $browserSetupDir -Force
}
$collectorArguments = if ($NoCodex) { '--no-codex' } else { '' }

# Verify that the installed executable can write its first snapshot before creating startup.
$collector = Start-Process -FilePath $tray -ArgumentList ("--once $collectorArguments") -WindowStyle Hidden -PassThru -Wait
if ($collector.ExitCode -ne 0) { throw "Collector startup failed ($($collector.ExitCode))." }

try {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $tray
  $shortcut.Arguments = $collectorArguments
  $shortcut.WorkingDirectory = $installDir
  $shortcut.Description = 'Starts the local AI task collector for iCUE'
  $shortcut.WindowStyle = 1
  $shortcut.Save()
  if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
    throw 'The shortcut did not appear in the startup folder.'
  }
} catch {
  Write-Warning "The collector will run for this session, but automatic startup could not be configured. $($_.Exception.Message)"
}
if ($NoCodex) {
  Start-Process -FilePath $tray -ArgumentList $collectorArguments -WindowStyle Hidden
} else {
  Start-Process -FilePath $tray -WindowStyle Hidden
}
Write-Host "AI Task Collector installed for the current user. Snapshot: $snapshot"
if (-not $NoPause -and [Environment]::UserInteractive) {
  [void](Read-Host 'Installation terminee. Appuyez sur Entree pour fermer / Installation complete. Press Enter to close')
}
