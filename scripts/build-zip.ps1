# Build script - Meet Split for Broadcast
# Empacota o conteudo de extension/ em ZIP versionado dentro de dist/

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$ext = Join-Path $root "extension"
$dist = Join-Path $root "dist"

if (-not (Test-Path "$ext/manifest.json")) {
    throw "manifest.json nao encontrado em $ext"
}

$manifest = Get-Content "$ext/manifest.json" -Raw | ConvertFrom-Json
$version = $manifest.version
$zipName = "meet-split-for-broadcast-v$version.zip"
$zipPath = Join-Path $dist $zipName

if (-not (Test-Path $dist)) {
    New-Item -ItemType Directory -Path $dist | Out-Null
}

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path "$ext/*" -DestinationPath $zipPath -Force

$size = (Get-Item $zipPath).Length
$sizeKB = [math]::Round($size / 1KB, 2)
Write-Host "Build OK: $zipName ($sizeKB KB)"
Write-Host "Path: $zipPath"
