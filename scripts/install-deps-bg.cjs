// Installe les dépendances npm en tâche de fond (détachée), logs dans le fichier.
// Usage: node scripts/install-deps-bg.cjs <dir> <logfile>
const { spawn } = require("node:child_process");
const fs = require("node:fs");

const [dir, logFile] = process.argv.slice(2);
if (!dir || !logFile) {
  console.error("Usage: node scripts/install-deps-bg.cjs <dir> <logfile>");
  process.exit(1);
}

fs.appendFileSync(logFile, `\n--- install-deps-bg start ${new Date().toISOString()} ---\ndir: ${dir}\n`);

const cmdLine = `npm.cmd install --no-audit --no-fund >> "${logFile}" 2>&1 && echo INSTALL-DONE >> "${logFile}" || echo INSTALL-FAIL >> "${logFile}"`;

const child = spawn("cmd.exe", ["/d", "/s", "/c", cmdLine], {
  cwd: dir,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();
console.log(`Installation lancée (PID ${child.pid}). Logs: ${logFile}`);
