# TravelBoard — start dev server + WhatsApp bot in separate windows.
# Usage: npm run start:all   OR   double-click start-travelboard.cmd

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$nodeBin = Join-Path $env:USERPROFILE "Tools\node"
$pgsqlBin = Join-Path $env:USERPROFILE "Tools\pgsql\bin"
$pathPrefix = @(
  if (Test-Path $nodeBin) { $nodeBin }
  if (Test-Path $pgsqlBin) { $pgsqlBin }
) -join ";"

function Start-TravelBoardWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  $inner = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
if ('$pathPrefix') { `$env:Path = '$pathPrefix;' + `$env:Path }
Set-Location -LiteralPath '$projectRoot'
Write-Host ''
Write-Host '=== $Title ===' -ForegroundColor Cyan
Write-Host ''
$Command
"@

  Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $inner
  ) | Out-Null
}

Write-Host ""
Write-Host "TravelBoard launcher" -ForegroundColor Green
Write-Host "  Project: $projectRoot"
Write-Host ""
Write-Host "Opening two windows:" -ForegroundColor Yellow
Write-Host "  1. npm run dev          (site at http://localhost:3000)"
Write-Host "  2. npm run whatsapp-bot (WhatsApp -> Claude remote control)"
Write-Host ""

Start-TravelBoardWindow -Title "TravelBoard — dev server" -Command "npm run dev"
Start-Sleep -Seconds 2
Start-TravelBoardWindow -Title "TravelBoard — WhatsApp bot" -Command "npm run whatsapp-bot"

Write-Host "Done. Close either window to stop that service." -ForegroundColor Green
Write-Host "To stop a stuck bot: npm run whatsapp-bot:stop" -ForegroundColor DarkGray
Write-Host ""
