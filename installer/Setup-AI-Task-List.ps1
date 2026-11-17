[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateSet('Auto','Brave','Chrome','Edge','Firefox','Vivaldi','Opera','OperaGX')]
  [string]$Browser = 'Auto',
  [switch]$SkipBrowser,
  [switch]$BrowserOnly,
  [switch]$ConfigureOnly,
  [switch]$NoCodex
)

$ErrorActionPreference = 'Stop'
if ($SkipBrowser -and ($BrowserOnly -or $ConfigureOnly -or $PSBoundParameters.ContainsKey('Browser'))) {
  throw '-SkipBrowser cannot be combined with browser setup options.'
}

$collector = Join-Path $PSScriptRoot 'Install-AI-Task-Collector.ps1'
$browserSetup = Join-Path $PSScriptRoot 'browser/Install-ChatGPT-Web.ps1'
if (!$BrowserOnly -and !(Test-Path -LiteralPath $collector -PathType Leaf)) {
  throw 'Extract the complete AI Task List Windows archive before running setup.'
}
if (!$SkipBrowser -and !(Test-Path -LiteralPath $browserSetup -PathType Leaf)) {
  throw 'The browser setup is missing. Extract the complete AI Task List Windows archive.'
}

if (!$BrowserOnly -and $PSCmdlet.ShouldProcess([Environment]::UserName, 'Install and start AI Task List Collector')) {
  & $collector -NoPause -NoCodex:$NoCodex
}

if (!$SkipBrowser) {
  & $browserSetup -Browser $Browser -ConfigureOnly:$ConfigureOnly -WhatIf:$WhatIfPreference
}
