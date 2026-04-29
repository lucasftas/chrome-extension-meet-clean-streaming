# Create Chrome (Broadcast) Shortcut
#
# Generates a Windows shortcut (.lnk) that launches Google Chrome with the
# three hardening flags required for the extension to keep rendering when
# the window is occluded by another app (e.g., when your broadcast switcher
# runs fullscreen on top of Chrome):
#
#   --disable-renderer-backgrounding
#   --disable-background-timer-throttling
#   --disable-backgrounding-occluded-windows
#
# Without these flags, Chrome pauses page rendering when the window loses
# focus or is covered by another app, and your video capture freezes mid-live.
#
# Usage from repo root:
#
#   .\scripts\create-chrome-shortcut.ps1
#       -> Creates "Chrome (Broadcast).lnk" on your Desktop
#
#   .\scripts\create-chrome-shortcut.ps1 -OutputFolder "C:\my\path"
#   .\scripts\create-chrome-shortcut.ps1 -Name "Chrome OBS"
#   .\scripts\create-chrome-shortcut.ps1 -OutputFolder "D:\Streaming" -Name "Chrome vMix"

param(
    [string]$OutputFolder = "$env:USERPROFILE\Desktop",
    [string]$Name = "Chrome (Broadcast)"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Chrome (Broadcast) Shortcut Generator ==="
Write-Host ""

# Detect Chrome installation across common locations
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chromePath = $chromePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $chromePath) {
    Write-Error @"
Google Chrome was not found in any of the standard locations:
$($chromePaths -join "`n")

Please install Chrome first, or pass the path explicitly via -OutputFolder
after editing this script's `$chromePaths array.
"@
    exit 1
}

Write-Host "Chrome detected: $chromePath"

# Validate output folder
if (-not (Test-Path -LiteralPath $OutputFolder)) {
    Write-Host "Output folder does not exist; creating: $OutputFolder"
    New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
}

$shortcutPath = Join-Path $OutputFolder "$Name.lnk"

if (Test-Path -LiteralPath $shortcutPath) {
    Write-Host "Existing shortcut at $shortcutPath will be overwritten."
}

# Create the .lnk via WScript.Shell COM
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $chromePath
$shortcut.Arguments = "--disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows"
$shortcut.WorkingDirectory = Split-Path $chromePath -Parent
$shortcut.IconLocation = "$chromePath,0"
$shortcut.Description = "Chrome with hardening flags for live broadcast capture (Meet Split for Broadcast)"
$shortcut.Save()

Write-Host ""
Write-Host "=== Shortcut created successfully ==="
Write-Host ""
Write-Host "Location:"
Write-Host "  $shortcutPath"
Write-Host ""
Write-Host "Flags applied:"
Write-Host "  --disable-renderer-backgrounding"
Write-Host "  --disable-background-timer-throttling"
Write-Host "  --disable-backgrounding-occluded-windows"
Write-Host ""
Write-Host "BEFORE FIRST USE:"
Write-Host ""
Write-Host "  1. Close ALL existing Chrome windows."
Write-Host "  2. Open Task Manager (Ctrl+Shift+Esc) and end any remaining"
Write-Host "     'Google Chrome' processes. Chrome reuses processes; if any"
Write-Host "     existed before, the shortcut opens a new window in the old"
Write-Host "     instance and IGNORES the flags."
Write-Host "  3. Then double-click the shortcut to launch Chrome."
Write-Host ""
Write-Host "VERIFY THE FLAGS ARE ACTIVE:"
Write-Host ""
Write-Host "  Paste in Chrome's URL bar:"
Write-Host "    chrome://version/"
Write-Host "  Look at the 'Command Line' field. The three flags must appear."
Write-Host ""
Write-Host "QUICK TEST OF THE BEHAVIOR:"
Write-Host ""
Write-Host "  Open horacerta.com (or any clock site) in a tab. Cover the"
Write-Host "  Chrome window with another fullscreen app for 30 seconds, then"
Write-Host "  bring Chrome back. The clock should show the correct time"
Write-Host "  (not frozen at the moment you covered it). If it's frozen,"
Write-Host "  the flags are not active - go back to step 1."
