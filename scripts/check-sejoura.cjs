// Inspecte l'état du clonage Séjoura.
// Usage: node scripts/check-sejoura.cjs
const { execSync } = require("node:child_process");
const fs = require("node:fs");

const dest = "G:/Projets/Sejoura";
if (!fs.existsSync(dest)) {
  console.log("Sejoura dir: ABSENT");
} else {
  const entries = fs.readdirSync(dest);
  console.log("Sejoura dir: " + entries.length + " entrees");
  console.log(entries.slice(0, 15).join(", "));
  console.log("package.json: " + fs.existsSync(dest + "/package.json"));
}

try {
  const out = execSync("tasklist /FI \"IMAGENAME eq git.exe\"", { encoding: "utf8" });
  console.log("--- git.exe ---");
  console.log(out.slice(0, 800));
} catch (e) {
  console.log("tasklist fail: " + e.message);
}
