# USB serial bridge: proxies TravelBoard API to ESP32 over COM port (no WiFi needed for dev/demos).
param(
  [string]$Port = $(if ($env:ESP32_PORT) { $env:ESP32_PORT } else { "COM4" }),
  [string]$ApiBase = $(if ($env:TB_API_BASE) { $env:TB_API_BASE } else { "http://127.0.0.1:3000" }),
  [int]$Baud = 115200
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Ports

function Write-Line([string]$text) {
  $port.WriteLine($text)
  $port.BaseStream.Flush()
}

function Read-LineBlocking() {
  while ($true) {
    if ($port.BytesToRead -gt 0) {
      return $port.ReadLine()
    }
    Start-Sleep -Milliseconds 5
  }
}

function Read-Exact([int]$count) {
  $buf = New-Object byte[] $count
  $got = 0
  while ($got -lt $count) {
    if ($port.BytesToRead -gt 0) {
      $n = $port.Read($buf, $got, $count - $got)
      if ($n -gt 0) { $got += $n }
    } else {
      Start-Sleep -Milliseconds 2
    }
  }
  return $buf
}

function Fetch-Url([string]$path) {
  $uri = "$ApiBase$path"
  try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("User-Agent", "TravelBoard-USB-Bridge/1.0")
    $bytes = $wc.DownloadData($uri)
    return @{ Ok = $true; Bytes = [byte[]]$bytes }
  } catch {
    return @{ Ok = $false; Error = $_.Exception.Message }
  }
}

Write-Host "TravelBoard USB bridge on $Port -> $ApiBase"
Write-Host "Press Ctrl+C to stop."

$port = New-Object System.IO.Ports.SerialPort $Port, $Baud
$port.NewLine = "`n"
$port.ReadTimeout = 500
$port.Open()

try {
  while ($true) {
    if ($port.BytesToRead -eq 0) {
      Start-Sleep -Milliseconds 5
      continue
    }
    $line = $port.ReadLine().Trim()
    if (-not $line) { continue }
    Write-Host "< $line"

    if ($line -eq "TB?PING") {
      Write-Line "TB!PONG"
      continue
    }

    if ($line -eq "TB?SYNC") {
      $r = Fetch-Url "/api/hardware-sync"
      if (-not $r.Ok) {
        Write-Line "TB!ERR sync $($r.Error)"
        continue
      }
      Write-Line "TB!SYNC $($r.Bytes.Length)"
      $port.Write($r.Bytes, 0, $r.Bytes.Length)
      $port.BaseStream.Flush()
      continue
    }

    if ($line -match "^TB\?COVER (.+)$") {
      $id = $Matches[1].Trim()
      $enc = [uri]::EscapeDataString($id)
      $r = Fetch-Url "/api/hardware-cover?id=$enc&format=rgb888"
      if (-not $r.Ok) {
        Write-Line "TB!ERR cover $($r.Error)"
        continue
      }
      Write-Line "TB!COVER $($r.Bytes.Length)"
      $port.Write($r.Bytes, 0, $r.Bytes.Length)
      $port.BaseStream.Flush()
      continue
    }

    Write-Line "TB!ERR unknown"
  }
} finally {
  $port.Close()
}
