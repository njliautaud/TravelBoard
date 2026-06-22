# Run PlatformIO for esp32-touch when `pio` is not on PATH.
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PioArgs
)

# PIP_USER=1 forces `pip install --user`, which is illegal inside a virtualenv and
# breaks pioarduino's penv bootstrap (it pip-installs `uv` into a fresh venv).
# Clear it so platform/tool installs into PlatformIO-managed venvs succeed.
$env:PIP_USER = ""

# Force UTF-8 for child processes (esptool/pio). Without this, the default Windows
# cp1252 console codec raises UnicodeEncodeError on esptool's progress output and can
# abort an upload mid-write. (Build also warns: "Set the terminal codepage to utf-8".)
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$candidates = @(
  "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe",
  "$env:LOCALAPPDATA\Packages\PythonSoftwareFoundation.Python.3.10_qbz5n2kfra8p0\LocalCache\local-packages\Python310\Scripts\pio.exe"
)

$pio = $null
foreach ($path in $candidates) {
  if (Test-Path $path) {
    $pio = $path
    break
  }
}

if (-not $pio) {
  Write-Error "PlatformIO not found. Install PlatformIO IDE extension or: pip install platformio"
  exit 1
}

$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root "esp32-touch"
Push-Location $project
try {
  & $pio @PioArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
