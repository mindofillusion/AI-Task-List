[CmdletBinding()]
param(
  [switch]$Uninstall,
  [switch]$NoCodex,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'AI-Task-List'
$appDir = Join-Path $installDir 'app'
$runner = Join-Path $appDir 'node.exe'
$entrypoint = Join-Path $appDir 'main.cjs'
$dataDir = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'AI-Task-List'
$snapshot = Join-Path $dataDir 'tasks.json'
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'AI Task List Collector.lnk'
$previousShortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'AI Task Collector.lnk'
$payloadHashes = @{
  'node.exe' = '__NODE_SHA256__'
  'main.cjs' = '__MAIN_SHA256__'
  'codex.cjs' = '__CODEX_SHA256__'
  'clients.cjs' = '__CLIENTS_CODE_SHA256__'
  'clients.json' = '__CLIENTS_CONFIG_SHA256__'
  'usage.cjs' = '__USAGE_SHA256__'
}
$payloadDir = Join-Path $PSScriptRoot 'app'

if (-not $Uninstall) {
  foreach ($file in $payloadHashes.Keys) {
    if ((Get-FileHash -LiteralPath (Join-Path $payloadDir $file) -Algorithm SHA256).Hash -ne $payloadHashes[$file]) {
      throw "Missing or modified collector file: $file"
    }
  }
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
  foreach ($file in (@($shortcutPath, $previousShortcutPath, $snapshot) + $appFiles)) {
    if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file }
  }
  Write-Host 'AI Task Collector removed. Provider files are preserved.'
  return
}

if (Test-Path -LiteralPath $previousShortcutPath -PathType Leaf) {
  Remove-Item -LiteralPath $previousShortcutPath -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $appDir -Force | Out-Null
foreach ($file in $payloadHashes.Keys) {
  Copy-Item -LiteralPath (Join-Path $payloadDir $file) -Destination (Join-Path $appDir $file) -Force
}
$collectorArguments = @('"' + $entrypoint + '"')
if ($NoCodex) { $collectorArguments += '--no-codex' }

# Verify that the installed executable can write its first snapshot before creating startup.
$collector = Start-Process -FilePath $runner -ArgumentList ($collectorArguments + '--once') -WindowStyle Hidden -PassThru -Wait
if ($collector.ExitCode -ne 0) { throw "Collector startup failed ($($collector.ExitCode))." }

try {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $runner
  $shortcut.Arguments = '"' + $entrypoint + '"' + $(if ($NoCodex) { ' --no-codex' } else { '' })
  $shortcut.WorkingDirectory = $installDir
  $shortcut.Description = 'Starts the local AI task collector for iCUE'
  $shortcut.WindowStyle = 7
  $shortcut.Save()
  if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
    throw 'The shortcut did not appear in the startup folder.'
  }
} catch {
  Write-Warning "The collector will run for this session, but automatic startup could not be configured. $($_.Exception.Message)"
}
Start-Process -FilePath $runner -ArgumentList $collectorArguments -WindowStyle Hidden
Write-Host "AI Task Collector installed for the current user. Snapshot: $snapshot"
if (-not $NoPause -and [Environment]::UserInteractive) {
  [void](Read-Host 'Installation terminee. Appuyez sur Entree pour fermer / Installation complete. Press Enter to close')
}
