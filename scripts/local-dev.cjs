// Lance Next.js en processus détaché (survit au lanceur), logs via cmd.exe.
// Usage: node scripts/local-dev.cjs [--port 3000]
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const portArg = process.argv.indexOf("--port");
const port = portArg !== -1 ? process.argv[portArg + 1] : "3000";
const logFile = path.join(root, "dev.log");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

fs.appendFileSync(
  logFile,
  `\n--- local-dev start (port ${port}) ${new Date().toISOString()} ---\nnextBin exists: ${fs.existsSync(nextBin)}\n`
);

const cmdLine =
  `"${process.execPath}" "${nextBin}" dev --webpack --port ${port} >> "${logFile}" 2>&1`;

const child = spawn("cmd.exe", ["/d", "/s", "/c", cmdLine], {
  cwd: root,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
  env: { ...process.env, PORT: String(port) },
});
child.unref();
console.log(`Serveur dev lancé (PID ${child.pid}) sur le port ${port}. Logs: dev.log`);
