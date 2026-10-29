// Réinstalle framer-motion + dépendances motion alignées, en tâche de fond.
// Usage: node scripts/fix-framer.cjs
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const logFile = path.join(root, "fix-framer.log");

fs.appendFileSync(logFile, `\n--- fix-framer v2 start ${new Date().toISOString()} ---\n`);

const cmdLine = `npm.cmd install framer-motion@12 --no-audit --no-fund >> "${logFile}" 2>&1 && echo FIX-FRAMER-DONE >> "${logFile}" || echo FIX-FRAMER-FAIL >> "${logFile}"`;

const child = spawn("cmd.exe", ["/d", "/s", "/c", cmdLine], {
  cwd: root,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();
console.log(`Réinstallation alignée lancée (PID ${child.pid}). Logs: fix-framer.log`);
