// Clone synchrone avec log fichier. Bloque jusqu'à la fin du clone.
// Usage: node scripts/clone-sync.cjs <url> <dest> <logfile>
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");

const [url, dest, logFile] = process.argv.slice(2);
fs.appendFileSync(logFile, `\n--- clone-sync start ${new Date().toISOString()} ---\n`);
try {
  const out = execFileSync("git", ["clone", "--progress", url, dest], {
    encoding: "utf8",
    timeout: 600000,
    windowsHide: true,
  });
  fs.appendFileSync(logFile, out.slice(-3000) + "\nCLONE-DONE\n");
  console.log("CLONE-DONE");
} catch (e) {
  fs.appendFileSync(
    logFile,
    `EXIT ${e.status}\nSTDOUT:\n${(e.stdout || "").slice(-2000)}\nSTDERR:\n${(e.stderr || "").slice(-2000)}\nCLONE-FAIL\n`
  );
  console.log("CLONE-FAIL status=" + e.status);
}
