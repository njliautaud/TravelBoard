/**
 * Stop a stale WhatsApp bot / Puppeteer session.
 * Run: node scripts/whatsapp-bot-stop.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const authMarker = path.join(projectRoot, ".whatsapp-auth").replace(/'/g, "''");

const ps1 = `
$ErrorActionPreference = 'SilentlyContinue'
$auth = '${authMarker}'
$procs = Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*whatsapp-bot*') -or
  ($_.Name -eq 'chrome.exe' -and $_.CommandLine -like "*$auth*")
}
$count = 0
foreach ($p in $procs) {
  Write-Host "Stopping $($p.Name) pid $($p.ProcessId)"
  Stop-Process -Id $p.ProcessId -Force
  $count++
}
Write-Host "Stopped $count process(es)."
`;

const scriptPath = path.join(os.tmpdir(), "travelboard-whatsapp-stop.ps1");
fs.writeFileSync(scriptPath, ps1, "utf8");

try {
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
    { stdio: "inherit" }
  );
} finally {
  fs.unlinkSync(scriptPath);
}

for (const lock of ["DevToolsActivePort", "SingletonLock", "SingletonCookie", "SingletonSocket"]) {
  const lockFile = path.join(projectRoot, ".whatsapp-auth", "session", lock);
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      console.log("Removed lock:", lock);
    } catch {
      // still held — a process may remain
    }
  }
}

console.log("Done. You can run: npm.cmd run whatsapp-bot");
