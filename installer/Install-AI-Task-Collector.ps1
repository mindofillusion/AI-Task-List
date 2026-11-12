[CmdletBinding()]
param(
  [switch]$Uninstall,
  [switch]$NoCodex
)

$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'AI-Task-List'
$installed = Join-Path $installDir 'AI-Task-Collector.exe'
$dataDir = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'AI-Task-List'
$snapshot = Join-Path $dataDir 'tasks.json'
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'AI Task Collector.lnk'
$expectedSha256 = '__COLLECTOR_SHA256__'

if (-not $Uninstall) {
  $binary = Join-Path $PSScriptRoot 'AI-Task-Collector.exe'
  if ((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -ne $expectedSha256) {
    throw 'The collector is missing or its SHA-256 hash differs from the installer.'
  }
}

Get-CimInstance Win32_Process -Filter "Name = 'AI-Task-Collector.exe'" |
  Where-Object { $_.ExecutablePath -eq $installed } |
  ForEach-Object {
    $runningCollector = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
    if ($runningCollector -and $runningCollector.Path -eq $installed) {
      Stop-Process -InputObject $runningCollector
      $runningCollector.WaitForExit()
    }
  }

if ($Uninstall) {
  foreach ($file in @($shortcutPath, $installed, $snapshot)) {
    if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file }
  }
  Write-Host 'AI Task Collector removed. Provider files are preserved.'
  return
}

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Copy-Item -LiteralPath $binary -Destination $installed -Force
$collectorArguments = @()
if ($NoCodex) { $collectorArguments += '--no-codex' }

# Verify that the installed executable can write its first snapshot before creating startup.
$collector = Start-Process -FilePath $installed -ArgumentList (@('--once') + $collectorArguments) -WindowStyle Hidden -PassThru -Wait
if ($collector.ExitCode -ne 0) { throw "Collector startup failed ($($collector.ExitCode))." }

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
if (-not (Test-Path -LiteralPath $shortcut.TargetPath)) {
  $shortcut.TargetPath = (Get-Command powershell.exe).Source
}
$quotedExe = $installed.Replace("'", "''")
$startupCommand = "Start-Process -FilePath '$quotedExe' -WindowStyle Hidden"
if ($NoCodex) { $startupCommand += " -ArgumentList '--no-codex'" }
$encodedStartup = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($startupCommand))
$shortcut.Arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand $encodedStartup"
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = 'Start the local AI task collector for iCUE'
$shortcut.WindowStyle = 7
$shortcut.Save()
$start = @{ FilePath = $installed; WindowStyle = 'Hidden' }
if ($collectorArguments.Count) { $start.ArgumentList = $collectorArguments }
Start-Process @start
Write-Host "AI Task Collector installed for the current user. Snapshot: $snapshot"
