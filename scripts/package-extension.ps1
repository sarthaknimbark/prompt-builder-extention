$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$zip = Join-Path $dist "promptforge-extension.zip"

if (Test-Path $dist) {
  Remove-Item -Recurse -Force $dist
}

New-Item -ItemType Directory -Path $dist | Out-Null

$items = @(
  "app.html",
  "popup.html",
  "manifest.json",
  "src",
  "icons",
  "README.md"
)

foreach ($item in $items) {
  $source = Join-Path $root $item
  $destination = Join-Path $dist $item
  if (Test-Path $source -PathType Container) {
    Copy-Item $source $destination -Recurse
  } else {
    Copy-Item $source $destination
  }
}

Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zip -Force
Write-Host "Created $zip"
