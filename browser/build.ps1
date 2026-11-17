[CmdletBinding()]
param(
  [string]$SigningThumbprint,
  [string]$TimestampServer = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$repo = Split-Path -Parent $root
$version = (Get-Content -LiteralPath (Join-Path $root 'extension/manifest.json') -Raw | ConvertFrom-Json).version
$package = Join-Path $repo "dist/AI-Task-List-Web-$version"
New-Item -Path $package -ItemType Directory -Force | Out-Null
$exe = Join-Path $package 'AI-Task-List-Web.exe'
$csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $csc /nologo /codepage:65001 /target:winexe /optimize+ "/out:$exe" /reference:System.Web.Extensions.dll (Join-Path $root 'NativeHost.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native messaging host build failed.' }
Copy-Item -LiteralPath (Join-Path $root 'extension') -Destination $package -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root 'Install-ChatGPT-Web.ps1'),(Join-Path $root 'stores.json'),(Join-Path $root 'README.md'),(Join-Path $root 'PUBLICATION.md'),(Join-Path $repo 'PRIVACY.md') -Destination $package -Force
$installer = Join-Path $package 'Install-ChatGPT-Web.ps1'
if ($SigningThumbprint) {
  $certificate = Get-Item -LiteralPath "Cert:/CurrentUser/My/$SigningThumbprint"
  foreach ($file in @($exe, $installer)) {
    $result = Set-AuthenticodeSignature -LiteralPath $file -Certificate $certificate -HashAlgorithm SHA256 -IncludeChain NotRoot -TimestampServer $TimestampServer
    if ($result.Status -ne 'Valid') { throw "Signature verification failed for $file ($($result.Status))." }
  }
}
$chromium = Join-Path $package 'extension'
$utf8 = [Text.UTF8Encoding]::new($false)

# The stores require a 128 px icon. Reuse the widget's 96 px artwork at native size.
Add-Type -AssemblyName System.Drawing
$artwork = [Drawing.Image]::FromFile((Join-Path $repo 'widget/images/task-list.png'))
$icon = [Drawing.Bitmap]::new(128, 128)
$graphics = [Drawing.Graphics]::FromImage($icon)
try {
  $tile = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(23, 68, 85))
  try {
    $graphics.FillRectangle($tile, 16, 16, 96, 96)
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($artwork, [Drawing.Rectangle]::new(22, 22, 84, 84))
  } finally { $tile.Dispose() }
  $icon.Save((Join-Path $chromium 'icon-128.png'), [Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $icon.Dispose()
  $artwork.Dispose()
}
$chromiumManifest = Join-Path $chromium 'manifest.json'
Copy-Item -LiteralPath (Join-Path $repo 'LICENSE') -Destination $chromium -Force
$manifest = Get-Content -LiteralPath $chromiumManifest -Raw | ConvertFrom-Json
$manifest | Add-Member -NotePropertyName icons -NotePropertyValue @{ '128' = 'icon-128.png' }
$manifest.action | Add-Member -NotePropertyName default_icon -NotePropertyValue 'icon-128.png'
[IO.File]::WriteAllText($chromiumManifest, ($manifest | ConvertTo-Json -Depth 8), $utf8)

$storeSource = Join-Path (Split-Path -Parent $package) 'build/chatgpt-web-store'
New-Item -Path $storeSource -ItemType Directory -Force | Out-Null
Get-ChildItem -LiteralPath $chromium -File | Copy-Item -Destination $storeSource -Force
$storeManifest = Join-Path $storeSource 'manifest.json'
$manifest = Get-Content -LiteralPath $storeManifest -Raw | ConvertFrom-Json
$manifest.PSObject.Properties.Remove('key')
[IO.File]::WriteAllText($storeManifest, ($manifest | ConvertTo-Json -Depth 8), $utf8)
Compress-Archive -Path "$storeSource/*" -DestinationPath (Join-Path $package 'chromium-store-upload.zip') -Force
$firefox = Join-Path $package 'firefox-extension'
New-Item -Path $firefox -ItemType Directory -Force | Out-Null
Get-ChildItem -LiteralPath $chromium -File | Copy-Item -Destination $firefox -Force
$manifestPath = Join-Path $firefox 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$manifest.PSObject.Properties.Remove('key')
$manifest.background = @{ scripts = @('background.js') }
$manifest | Add-Member -NotePropertyName browser_specific_settings -NotePropertyValue @{ gecko = @{
  id = 'ai-task-list-web@pierrechevalier.fr'
  strict_min_version = '142.0'
  data_collection_permissions = @{ required = @('websiteContent') }
} }
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), $utf8)
$firefoxUpload = Join-Path $package 'firefox-signing-upload.zip'
Compress-Archive -Path "$firefox/*" -DestinationPath $firefoxUpload -Force
$payload = @($exe, $chromium, $firefox, $firefoxUpload, (Join-Path $package 'chromium-store-upload.zip'),
  $installer, (Join-Path $package 'stores.json'), (Join-Path $package 'README.md'),
  (Join-Path $package 'PUBLICATION.md'), (Join-Path $package 'PRIVACY.md'))
Compress-Archive -LiteralPath $payload -DestinationPath "$package.zip" -Force
Get-Item -LiteralPath "$package.zip"
