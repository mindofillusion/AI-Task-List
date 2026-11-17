[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateSet('Auto','Brave','Chrome','Edge','Firefox','Vivaldi','Opera','OperaGX')]
  [string]$Browser = 'Auto',
  [ValidatePattern('^[a-p]{32}$')][string]$ChromeStoreId,
  [ValidatePattern('^[a-p]{32}$')][string]$EdgeStoreId,
  [ValidatePattern('^[a-z0-9_-]+$')][string]$FirefoxStoreSlug,
  [string]$Executable,
  [switch]$StageChrome,
  [string]$FirefoxEsrXpi,
  [switch]$ConfigureOnly,
  [switch]$ReportJson,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
trap {
  if ($ReportJson) {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
  }
  break
}
$name = 'fr.pierrechevalier.ai_task_list'
$previewId = 'bjklhlobcpcinekfbkiieocjkpcampkp'
$firefoxId = 'ai-task-list-web@pierrechevalier.fr'
$install = Join-Path $env:LOCALAPPDATA 'AI-Task-List/browser'
$hostExe = Join-Path $install 'AI-Task-List-Web.exe'
$chromiumManifest = Join-Path $install "$name.json"
$firefoxManifest = Join-Path $install "$name.firefox.json"
$utf8 = [Text.UTF8Encoding]::new($false)

# The native-relay registry is separate from extension distribution.
$browsers = [ordered]@{
  Brave   = @{ Exe='brave.exe'; Path='BraveSoftware/Brave-Browser/Application/brave.exe'; Registry=@('Chromium'); Store='chrome' }
  Chrome  = @{ Exe='chrome.exe'; Path='Google/Chrome/Application/chrome.exe'; Registry=@('Google\Chrome'); Store='chrome' }
  Edge    = @{ Exe='msedge.exe'; Path='Microsoft/Edge/Application/msedge.exe'; Registry=@('Microsoft\Edge'); Store='edge' }
  Firefox = @{ Exe='firefox.exe'; Path='Mozilla Firefox/firefox.exe'; Registry=@('Mozilla'); Store='firefox' }
  Vivaldi = @{ Exe='vivaldi.exe'; Path='Vivaldi/Application/vivaldi.exe'; Registry=@('Vivaldi','Chromium'); Store='chrome' }
  Opera   = @{ Exe='opera.exe'; Path='Opera/launcher.exe'; Registry=@('Opera Software\Opera Stable','Chromium'); Store='chrome' }
  OperaGX = @{ Exe='opera.exe'; Path='Opera GX/launcher.exe'; Registry=@('Opera Software\Opera GX Stable','Chromium'); Store='chrome' }
}

function Get-BrowserPath($definition, [string]$browserName) {
  if ($Executable -and $Browser -ne 'Auto') {
    return (Get-Item -LiteralPath $Executable).FullName
  }
  $paths = @(
    foreach ($root in @($env:LOCALAPPDATA, "$env:LOCALAPPDATA/Programs", $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
      if ($root) { Join-Path $root $definition.Path }
    }
    if ($browserName -notin @('Opera','OperaGX')) {
      foreach ($hive in @('HKCU','HKLM')) {
        $entry = "${hive}:\Software\Microsoft\Windows\CurrentVersion\App Paths\$($definition.Exe)"
        Get-ItemPropertyValue -LiteralPath $entry -Name '(default)' -ErrorAction SilentlyContinue
      }
    }
  )
  return $paths | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
}

function Get-HostKeys($vendors) {
  $vendors | Sort-Object -Unique | ForEach-Object { "HKCU:\Software\$_\NativeMessagingHosts\$name" }
}

function Get-RelayHash([string]$path) {
  $file = [IO.File]::OpenRead($path)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { [Convert]::ToBase64String($sha.ComputeHash($file)) }
  finally { $sha.Dispose(); $file.Dispose() }
}

if ($Uninstall) {
  $vendors = @($browsers.Values | ForEach-Object Registry) + 'BraveSoftware\Brave-Browser'
  foreach ($key in (Get-HostKeys $vendors)) {
    $current = Get-ItemPropertyValue -LiteralPath $key -Name '(default)' -ErrorAction SilentlyContinue
    if ($current -in @($chromiumManifest, $firefoxManifest)) { Remove-Item -LiteralPath $key }
  }
  foreach ($file in @($hostExe, $chromiumManifest, $firefoxManifest)) {
    if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file }
  }
  return
}

if ($Browser -eq 'Auto' -and $Executable) { throw 'Select a browser when using -Executable.' }
if ($StageChrome -and $Browser -ne 'Chrome') { throw 'Use -Browser Chrome with -StageChrome.' }
if ($FirefoxEsrXpi -and $Browser -ne 'Firefox') { throw 'Use -Browser Firefox with -FirefoxEsrXpi.' }
$selected = if ($Browser -eq 'Auto') { $browsers.Keys } else { @($Browser) }
$detected = @(
  foreach ($candidate in $selected) {
    $path = Get-BrowserPath $browsers[$candidate] $candidate
    if ($path) { [pscustomobject]@{ Name=$candidate; Path=$path; Definition=$browsers[$candidate] } }
  }
)
if (!$detected.Count) {
  if ($ReportJson) {
    if ($Browser -eq 'Auto') { return '[]' }
    return ConvertTo-Json -InputObject @(@{Browser=$Browser; Extension='BrowserNotFound'}) -Compress
  }
  if ($Browser -ne 'Auto') { throw "$Browser was not found. Use -Executable for a portable installation." }
  Write-Warning 'No supported browser was found. The ChatGPT Web extension setup was skipped.'
  return
}

$stores = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'stores.json') -Raw | ConvertFrom-Json
$catalog = @{
  chrome = if ($ChromeStoreId) { $ChromeStoreId } else { $stores.chrome }
  edge = if ($EdgeStoreId) { $EdgeStoreId } else { $stores.edge }
  firefox = if ($FirefoxStoreSlug) { $FirefoxStoreSlug } else { $stores.firefox }
}
foreach ($type in @('chrome','edge')) {
  if ($catalog[$type] -and $catalog[$type] -cnotmatch '^[a-p]{32}$') { throw "Invalid $type store ID." }
}
if ($catalog.firefox -and $catalog.firefox -cnotmatch '^[a-z0-9_-]+$') { throw 'Invalid Firefox store slug.' }
if ($StageChrome -and !$catalog.chrome) { throw 'Chrome registry staging requires a published Chrome Web Store ID.' }

if ($FirefoxEsrXpi) {
  $firefoxDir = Split-Path -Parent $detected[0].Path
  $channel = Join-Path $firefoxDir 'update-settings.ini'
  if (!(Test-Path -LiteralPath $channel) -or !(Select-String -LiteralPath $channel -Pattern 'mozilla-esr' -Quiet)) {
    throw 'The selected Firefox installation does not identify itself as Firefox ESR.'
  }
  $xpi = (Get-Item -LiteralPath $FirefoxEsrXpi).FullName
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($xpi)
  try {
    $entry = $archive.GetEntry('manifest.json')
    if (!$entry -or $entry.Length -gt 65536 -or !$archive.GetEntry('META-INF/mozilla.rsa')) {
      throw 'Provide a Mozilla-signed AI Task List XPI.'
    }
    $reader = [IO.StreamReader]::new($entry.Open())
    try { $addon = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    if ($addon.browser_specific_settings.gecko.id -cne $firefoxId) {
      throw 'The XPI ID does not match the AI Task List Firefox extension.'
    }
  } finally { $archive.Dispose() }
}

$extensionIds = if ($catalog.chrome -or $catalog.edge) { @($catalog.chrome, $catalog.edge) } else { @($previewId) }
$origins = @($extensionIds | Where-Object { $_ } |
  Sort-Object -Unique | ForEach-Object { "chrome-extension://$_/" })
if ($PSCmdlet.ShouldProcess($install, 'Install the AI Task List native relay')) {
  $sourceExe = Join-Path $PSScriptRoot 'AI-Task-List-Web.exe'
  $sourceHash = Get-RelayHash $sourceExe
  New-Item -ItemType Directory -Path $install -Force | Out-Null
  if (!(Test-Path -LiteralPath $hostExe -PathType Leaf) -or
      (Get-RelayHash $hostExe) -cne $sourceHash) {
    try {
      Copy-Item -LiteralPath $sourceExe -Destination $hostExe -Force
    } catch {
      throw "Unable to update the ChatGPT Web relay. Close the browsers using it and run setup again. $($_.Exception.Message)"
    }
  }
  $base = @{ name=$name; description='Local ChatGPT activity relay for AI Task List'; path=$hostExe; type='stdio' }
  [IO.File]::WriteAllText($chromiumManifest, (($base + @{allowed_origins=$origins}) | ConvertTo-Json), $utf8)
  [IO.File]::WriteAllText($firefoxManifest, (($base + @{allowed_extensions=@($firefoxId)}) | ConvertTo-Json), $utf8)
}

$results = [Collections.Generic.List[object]]::new()
foreach ($target in $detected) {
  $store = $target.Definition.Store
  $manifest = if ($store -eq 'firefox') { $firefoxManifest } else { $chromiumManifest }
  foreach ($key in (Get-HostKeys $target.Definition.Registry)) {
    if ($PSCmdlet.ShouldProcess($key, 'Register the native relay for the current user')) {
      if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null }
      Set-Item -LiteralPath $key -Value $manifest
    }
  }
  if ($StageChrome) {
    $path = "Software\Google\Chrome\Extensions\$($catalog.chrome)"
    if ($PSCmdlet.ShouldProcess("HKLM:\$path (32-bit registry view)", 'Stage the published Chrome extension')) {
      $machine = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
        [Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry32)
      try {
        $key = $machine.CreateSubKey($path)
        try { $key.SetValue('update_url', 'https://clients2.google.com/service/update2/crx') }
        finally { $key.Dispose() }
      } finally { $machine.Dispose() }
    }
    Write-Host 'Chrome will offer to enable the extension after restart.'
    continue
  }
  if ($FirefoxEsrXpi) {
    $directory = Join-Path $firefoxDir 'distribution/extensions'
    if ($PSCmdlet.ShouldProcess($directory, 'Stage the signed extension for Firefox ESR')) {
      New-Item -Path $directory -ItemType Directory -Force | Out-Null
      Copy-Item -LiteralPath $xpi -Destination (Join-Path $directory "$firefoxId.xpi") -Force
    }
    Write-Host 'Firefox ESR will validate the signature when applying distribution extensions.'
    continue
  }
  $status = 'RelayOnly'
  if (!$ConfigureOnly) {
    $storeId = $catalog[$store]
    if (!$storeId) {
      $status = 'AwaitingPublication'
      Write-Warning "$($target.Name): this package has no published extension listed in stores.json."
    } else {
      $url = switch ($store) {
        chrome { "https://chromewebstore.google.com/detail/$storeId" }
        edge { "https://microsoftedge.microsoft.com/addons/detail/$storeId" }
        firefox { "https://addons.mozilla.org/firefox/addon/$storeId/" }
      }
      $status = 'StorePagePending'
      if ($PSCmdlet.ShouldProcess($target.Name, "Open $url")) {
        Start-Process -FilePath $target.Path -ArgumentList $url
        $status = 'AwaitingBrowserConfirmation'
      }
    }
  }
  $relayStatus = if ($WhatIfPreference) { 'Planned' } else { 'Configured' }
  $results.Add([pscustomobject]@{ Browser=$target.Name; Relay=$relayStatus; Extension=$status })
}
if ($ReportJson) { ConvertTo-Json -InputObject ($results.ToArray()) -Compress }
else { $results }
