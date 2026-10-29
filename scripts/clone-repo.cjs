// Clone un dépôt GitHub en tâche de fond (détachée), logs dans le fichier indiqué.
// Usage: node scripts/clone-repo.cjs <url> <dest> <logfile>
const { spawn } = require("node:child_process");
const fs = require("node:fs");

const [url, dest, logFile] = process.argv.slice(2);
if (!url || !dest || !logFile) {
  console.error("Usage: node scripts/clone-repo.cjs <url> <dest> <logfile>");
  process.exit(1);
}

fs.appendFileSync(logFile, `\n--- clone start ${new Date().toISOString()} ---\nurl: ${url}\ndest: ${dest}\n`);

const cmdLine = `git clone --progress "${url}" "${dest}" >> "${logFile}" 2>&1 && echo CLONE-DONE >> "${logFile}" || echo CLONE-FAIL >> "${logFile}"`;

const child = spawn("cmd.exe", ["/d", "/s", "/c", cmdLine], {
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();
console.log(`Clonage lancé (PID ${child.pid}). Logs: ${logFile}`);
