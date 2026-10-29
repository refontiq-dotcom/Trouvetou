// Installe les dépendances npm d'un projet de façon synchrone avec log fichier.
// Usage: node scripts/install-deps.cjs <dir> <logfile>
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");

const [dir, logFile] = process.argv.slice(2);
if (!dir || !logFile) {
  console.error("Usage: node scripts/install-deps.cjs <dir> <logfile>");
  process.exit(1);
}

fs.appendFileSync(logFile, `\n--- install-deps start ${new Date().toISOString()} ---\ndir: ${dir}\n`);
try {
  const out = execFileSync("npm.cmd", ["install", "--no-audit", "--no-fund"], {
    cwd: dir,
    encoding: "utf8",
    timeout: 1200000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  fs.appendFileSync(logFile, out.slice(-3000) + "\nINSTALL-DONE\n");
  console.log("INSTALL-DONE");
} catch (e) {
  fs.appendFileSync(
    logFile,
    `EXIT ${e.status}\nSTDOUT:\n${(e.stdout || "").slice(-2000)}\nSTDERR:\n${(e.stderr || "").slice(-2000)}\nINSTALL-FAIL\n`
  );
  console.log("INSTALL-FAIL status=" + e.status);
}
