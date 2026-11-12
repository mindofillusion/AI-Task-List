[CmdletBinding()]
param(
  [switch]$Uninstall,
  [switch]$NoCodex
)

$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'AI-Task-List'
$appDir = Join-Path $installDir 'app'
$runner = Join-Path $appDir 'node.exe'
$entrypoint = Join-Path $appDir 'main.cjs'
$dataDir = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'AI-Task-List'
$snapshot = Join-Path $dataDir 'tasks.json'
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'AI Task Collector.lnk'
$payloadHashes = @{
  'node.exe' = '__NODE_SHA256__'
  'main.cjs' = '__MAIN_SHA256__'
  'codex.cjs' = '__CODEX_SHA256__'
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
  foreach ($file in (@($shortcutPath, $snapshot) + $appFiles)) {
    if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file }
  }
  Write-Host 'AI Task Collector removed. Provider files are preserved.'
  return
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

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
if (-not (Test-Path -LiteralPath $shortcut.TargetPath)) {
  $shortcut.TargetPath = (Get-Command powershell.exe).Source
}
$quotedRunner = $runner.Replace("'", "''")
$quotedArguments = ($collectorArguments -join ' ').Replace("'", "''")
$startupCommand = "Start-Process -FilePath '$quotedRunner' -ArgumentList '$quotedArguments' -WindowStyle Hidden"
$encodedStartup = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($startupCommand))
$shortcut.Arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand $encodedStartup"
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = 'Start the local AI task collector for iCUE'
$shortcut.WindowStyle = 7
$shortcut.Save()
Start-Process -FilePath $runner -ArgumentList $collectorArguments -WindowStyle Hidden
Write-Host "AI Task Collector installed for the current user. Snapshot: $snapshot"
