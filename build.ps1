[CmdletBinding()]
param(
  [string]$SigningThumbprint,
  [string]$TimestampServer = 'http://timestamp.digicert.com',
  [string]$NodeLicense
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$widget = Join-Path $root 'widget'
$manifest = Get-Content -LiteralPath (Join-Path $widget 'manifest.json') -Raw | ConvertFrom-Json
$dist = Join-Path $root 'dist'
$bundle = Join-Path $dist ('AI-Task-List-' + $manifest.version)
$intermediate = Join-Path $dist 'build'
New-Item -ItemType Directory -Path $dist,$bundle,$intermediate -Force | Out-Null

& node --test (Join-Path $root 'tests/codex-smoke.cjs') (Join-Path $root 'tests/collector.test.cjs') (Join-Path $root 'tests/widget.test.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }

$cli = (Get-Command icuewidget.cmd -ErrorAction Stop).Source
& $cli validate $widget
if ($LASTEXITCODE -ne 0) { throw 'iCUE package validation failed.' }
$widgetPackage = Join-Path $bundle "AI-Task-List-$($manifest.version).icuewidget"
$cliPackage = Join-Path $intermediate 'validated.icuewidget'
& $cli package $widget --output $cliPackage
if ($LASTEXITCODE -ne 0) { throw 'iCUE package build failed.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$orderedPackage = Join-Path $intermediate 'ordered.icuewidget'
$sourceZip = [IO.Compression.ZipFile]::OpenRead($cliPackage)
try {
  $targetZip = [IO.Compression.ZipFile]::Open($orderedPackage, [IO.Compression.ZipArchiveMode]::Create)
  try {
    $entries = $sourceZip.Entries | Sort-Object { $_.FullName -ne 'index.html' }, FullName
    foreach ($entry in $entries) {
      $inputStream = $entry.Open()
      $outputStream = $targetZip.CreateEntry($entry.FullName, [IO.Compression.CompressionLevel]::Optimal).Open()
      try { $inputStream.CopyTo($outputStream) }
      finally { $inputStream.Dispose(); $outputStream.Dispose() }
    }
  } finally {
    $targetZip.Dispose()
  }
} finally {
  $sourceZip.Dispose()
}
Move-Item -LiteralPath $orderedPackage -Destination $widgetPackage -Force

$utf8 = [Text.UTF8Encoding]::new($false)
$adapter = [IO.File]::ReadAllText((Join-Path $root 'collector/codex.cjs'))
$collector = [IO.File]::ReadAllText((Join-Path $root 'collector/main.cjs'))
$adapterImport = 'const { collectTasks, resolvePaths } = require("./codex.cjs");'
if (-not $collector.Contains($adapterImport)) { throw 'Collector adapter import changed.' }
$inlinedAdapter = "const { collectTasks, resolvePaths } = (() => {`nconst module = { exports: {} };`n$adapter`nreturn module.exports;`n})();"
$main = Join-Path $intermediate 'collector.cjs'
[IO.File]::WriteAllText($main, $collector.Replace($adapterImport, $inlinedAdapter), $utf8)
$binary = Join-Path $bundle 'AI-Task-Collector.exe'
$configPath = Join-Path $intermediate 'sea-config.json'
$config = @{ main = $main; output = $binary; disableExperimentalSEAWarning = $true }
[IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Compress), $utf8)
& node --build-sea $configPath
if ($LASTEXITCODE -ne 0) { throw 'Standalone collector build failed. Use Node.js 26 or later.' }

if ($SigningThumbprint) {
  $certificate = Get-Item -LiteralPath "Cert:/CurrentUser/My/$SigningThumbprint"
  if (-not $certificate.HasPrivateKey) { throw 'The signing certificate private key is unavailable.' }
}
function Sign-PackageFile($file) {
  if ($SigningThumbprint) {
    $result = Set-AuthenticodeSignature -LiteralPath $file -Certificate $certificate -HashAlgorithm SHA256 -IncludeChain NotRoot -TimestampServer $TimestampServer
    if ($result.Status -ne 'Valid') { throw "Signature verification failed for $file ($($result.Status))." }
  }
}
Sign-PackageFile $binary
if ((& $binary --version) -ne $manifest.version -or $LASTEXITCODE -ne 0) { throw 'Standalone collector verification failed.' }

$installerSource = [IO.File]::ReadAllText((Join-Path $root 'installer/Install-AI-Task-Collector.ps1'))
$binaryHash = (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash
$installer = Join-Path $bundle 'Install-AI-Task-Collector.ps1'
[IO.File]::WriteAllText($installer, $installerSource.Replace('__COLLECTOR_SHA256__', $binaryHash), $utf8)
Sign-PackageFile $installer
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $bundle -Force
Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination $bundle -Force
$nodeNotice = Join-Path $bundle 'NODE-LICENSE.txt'
if ($NodeLicense) {
  Copy-Item -LiteralPath $NodeLicense -Destination $nodeNotice -Force
} else {
  $nodeVersion = & node --version
  if ($nodeVersion -notmatch '^v\d+\.\d+\.\d+$') { throw 'Unexpected Node.js version.' }
  Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/nodejs/node/$nodeVersion/LICENSE" -OutFile $nodeNotice
}

$flavor = if ($SigningThumbprint) { 'signed' } else { 'unsigned-preview' }
$archive = Join-Path $dist "AI-Task-List-$($manifest.version)-windows-$flavor.zip"
Compress-Archive -LiteralPath $widgetPackage,$binary,$installer,(Join-Path $bundle 'README.md'),(Join-Path $bundle 'LICENSE'),$nodeNotice -DestinationPath $archive -Force
Get-FileHash -LiteralPath $archive -Algorithm SHA256
