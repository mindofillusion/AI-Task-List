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
$translations = Get-Content -LiteralPath (Join-Path $widget 'translation.json') -Raw | ConvertFrom-Json
$englishKeys = @($translations.en.translation.PSObject.Properties.Name)
if ($englishKeys.Count -eq 0) { throw 'English translations are required.' }
foreach ($locale in $translations.PSObject.Properties) {
  if (-not $locale.Value.translation) { throw "Locale $($locale.Name) must contain a translation object." }
  $localeKeys = @($locale.Value.translation.PSObject.Properties.Name)
  foreach ($key in $englishKeys) {
    if ($localeKeys -notcontains $key) { throw "Locale $($locale.Name) is missing translation key: $key" }
  }
}
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
$appDir = Join-Path $bundle 'app'
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
$nodeSource = (Get-Command node.exe -ErrorAction Stop).Source
$nodeSignature = Get-AuthenticodeSignature -LiteralPath $nodeSource
if ($nodeSignature.Status -ne 'Valid' -or $nodeSignature.SignerCertificate.Subject -notmatch '(^|, )O=OpenJS Foundation(,|$)') {
  throw 'Packaging requires the official Node.js Windows binary with a valid OpenJS Foundation signature.'
}
$runner = Join-Path $appDir 'node.exe'
Copy-Item -LiteralPath $nodeSource -Destination $runner -Force
Copy-Item -LiteralPath (Join-Path $root 'collector/main.cjs'),(Join-Path $root 'collector/codex.cjs'),(Join-Path $root 'collector/clients.cjs'),(Join-Path $root 'collector/clients.json'),(Join-Path $root 'collector/usage.cjs') -Destination $appDir -Force
if ((& $runner (Join-Path $appDir 'main.cjs') --version) -ne $manifest.version -or $LASTEXITCODE -ne 0) {
  throw 'Bundled collector verification failed.'
}

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
$tray = Join-Path $appDir 'AI-Task-Collector.exe'
$iconPath = Join-Path $intermediate 'collector.ico'
Add-Type -AssemblyName System.Drawing
$artwork = [Drawing.Image]::FromFile((Join-Path $widget 'images/task-list.png'))
try {
  $frames = foreach ($size in @(16, 20, 24, 32, 48)) {
    $bitmap = [Drawing.Bitmap]::new($size, $size)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $png = [IO.MemoryStream]::new()
    try {
      $graphics.Clear([Drawing.Color]::FromArgb(23, 68, 85))
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $inset = [int][Math]::Floor($size / 12)
      $extent = $size - 2 * $inset
      $graphics.DrawImage($artwork, [Drawing.Rectangle]::new($inset, $inset, $extent, $extent))
      $bitmap.Save($png, [Drawing.Imaging.ImageFormat]::Png)
      [pscustomobject]@{ Size = $size; Bytes = $png.ToArray() }
    } finally {
      $png.Dispose()
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
} finally { $artwork.Dispose() }
$iconStream = [IO.File]::Create($iconPath)
$iconWriter = [IO.BinaryWriter]::new($iconStream)
try {
  $iconWriter.Write([uint16]0)
  $iconWriter.Write([uint16]1)
  $iconWriter.Write([uint16]$frames.Count)
  $offset = 6 + 16 * $frames.Count
  foreach ($frame in $frames) {
    $iconWriter.Write([byte]$frame.Size)
    $iconWriter.Write([byte]$frame.Size)
    $iconWriter.Write([uint16]0)
    $iconWriter.Write([uint16]1)
    $iconWriter.Write([uint16]32)
    $iconWriter.Write([uint32]$frame.Bytes.Length)
    $iconWriter.Write([uint32]$offset)
    $offset += $frame.Bytes.Length
  }
  foreach ($frame in $frames) { $iconWriter.Write([byte[]]$frame.Bytes) }
} finally {
  $iconWriter.Dispose()
}
$csc = Join-Path ([System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
if (-not (Test-Path -LiteralPath $csc -PathType Leaf)) {
  $csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
}
& $csc /nologo /codepage:65001 /target:winexe /optimize+ "/out:$tray" "/win32icon:$iconPath" "/resource:$iconPath,Collector.ico" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll (Join-Path $root 'installer/CollectorTray.cs')
if ($LASTEXITCODE -ne 0) { throw 'Collector tray build failed.' }
Sign-PackageFile $tray

$setup = Join-Path $bundle 'Setup-AI-Task-List.ps1'
Copy-Item -LiteralPath (Join-Path $root 'installer/Setup-AI-Task-List.ps1') -Destination $setup -Force
Sign-PackageFile $setup

$browserArchive = & (Join-Path $root 'browser/build.ps1') -SigningThumbprint $SigningThumbprint -TimestampServer $TimestampServer
$browserBundle = Join-Path $bundle 'browser'
New-Item -ItemType Directory -Path $browserBundle -Force | Out-Null
$browserPackage = Join-Path $browserArchive.DirectoryName $browserArchive.BaseName
$browserFiles = @(
  'AI-Task-List-Web.exe', 'Install-ChatGPT-Web.ps1', 'stores.json', 'README.md', 'PUBLICATION.md' |
    ForEach-Object { Join-Path $browserPackage $_ }
)
Copy-Item -LiteralPath $browserFiles -Destination $browserBundle -Force

$installerSource = [IO.File]::ReadAllText((Join-Path $root 'installer/Install-AI-Task-Collector.ps1'))
$payloads = @{
  TRAY = 'app/AI-Task-Collector.exe'; NODE = 'app/node.exe'; MAIN = 'app/main.cjs'
  CODEX = 'app/codex.cjs'; CLIENTS_CODE = 'app/clients.cjs'; CLIENTS_CONFIG = 'app/clients.json'; USAGE = 'app/usage.cjs'
  BROWSER_SETUP = 'browser/Install-ChatGPT-Web.ps1'; BROWSER_RELAY = 'browser/AI-Task-List-Web.exe'
}
foreach ($entry in $payloads.GetEnumerator()) {
  $hash = (Get-FileHash -LiteralPath (Join-Path $bundle $entry.Value) -Algorithm SHA256).Hash
  $installerSource = $installerSource.Replace(('__{0}_SHA256__' -f $entry.Key), $hash)
}
$installer = Join-Path $bundle 'Install-AI-Task-Collector.ps1'
[IO.File]::WriteAllText($installer, $installerSource, $utf8)
Sign-PackageFile $installer

Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $bundle -Force
Copy-Item -LiteralPath (Join-Path $root 'README.fr.md') -Destination $bundle -Force
Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination $bundle -Force
Copy-Item -LiteralPath (Join-Path $root 'CHANGELOG.md') -Destination $bundle -Force
Copy-Item -LiteralPath (Join-Path $root 'docs') -Destination $bundle -Recurse -Force
$privacy = Join-Path $bundle 'PRIVACY.md'
Copy-Item -LiteralPath (Join-Path $root 'PRIVACY.md') -Destination $privacy -Force
$nodeNotice = Join-Path $bundle 'NODE-LICENSE.txt'
if ($NodeLicense) {
  $licensePath = (Resolve-Path -LiteralPath $NodeLicense).Path
  if ($licensePath -ne $nodeNotice) {
    Copy-Item -LiteralPath $licensePath -Destination $nodeNotice -Force
  }
} else {
  $nodeVersion = & node --version
  if ($nodeVersion -notmatch '^v\d+\.\d+\.\d+$') { throw 'Unexpected Node.js version.' }
  Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/nodejs/node/$nodeVersion/LICENSE" -OutFile $nodeNotice
}

$flavor = if ($SigningThumbprint) { 'signed' } else { 'unsigned-preview' }
$archive = Join-Path $dist "AI-Task-List-$($manifest.version)-windows-$flavor.zip"
Compress-Archive -LiteralPath $widgetPackage,$appDir,$installer,$setup,$browserBundle,(Join-Path $bundle 'README.md'),(Join-Path $bundle 'README.fr.md'),(Join-Path $bundle 'CHANGELOG.md'),(Join-Path $bundle 'docs'),(Join-Path $bundle 'LICENSE'),$privacy,$nodeNotice -DestinationPath $archive -Force
Get-FileHash -LiteralPath $archive -Algorithm SHA256
