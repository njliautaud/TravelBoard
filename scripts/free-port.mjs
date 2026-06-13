/**
 * Free a TCP port before starting the dev server (avoids 3000 → 3001 → 3002 drift).
 * Only stops node.exe listeners — never kills PowerShell or other shells.
 * Usage: node scripts/free-port.mjs 3000
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const port = process.argv[2] ?? "3000";

if (process.platform === "win32") {
  const ps1 = `
$ErrorActionPreference = 'SilentlyContinue'
$conns = Get-NetTCPConnection -LocalPort ${port} -State Listen
foreach ($c in $conns) {
  $procId = $c.OwningProcess
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$procId"
  if ($p -and $p.Name -ieq 'node.exe') {
    Write-Host "Freeing port ${port}: node.exe (pid $procId)"
    Stop-Process -Id $procId -Force
  } elseif ($p) {
    Write-Host "Port ${port} in use by $($p.Name) (pid $procId) - leaving it alone"
  }
}
`;
  const scriptPath = path.join(os.tmpdir(), `travelboard-free-port-${port}.ps1`);
  fs.writeFileSync(scriptPath, ps1, "utf8");
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
      stdio: "inherit",
    });
  } catch {
    // Non-fatal — dev may still start if port is free
    console.warn(`Note: could not fully free port ${port}; continuing anyway.`);
  } finally {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      /* ok */
    }
  }
} else {
  try {
    execFileSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { shell: true, stdio: "inherit" });
  } catch {
    /* port already free */
  }
}
