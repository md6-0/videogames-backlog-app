#!/usr/bin/env node
/* Ejecuta las pruebas una detrás de otra (cada una usa su propio servidor local) y resume el resultado.
   Uso:  node run.js            todas
         node run.js 14 31      solo test14.js y test31.js */
const { spawnSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");

const only = process.argv.slice(2).map(n => `test${n}.js`);
const files = fs.readdirSync(__dirname)
  .filter(f => /^test\d+\.js$/.test(f) && (!only.length || only.includes(f)))
  .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "biblioteca-run-"));   // algunas pruebas escriben archivos sueltos

const failed = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { cwd, encoding: "utf8", timeout: 300000 });
  const out = (r.stdout || "") + (r.stderr || "");
  const bad = out.split("\n").filter(l => /^(FAIL|CRASH)/.test(l.trim()));
  const ok = !bad.length && r.status === 0 && /(^|\n)OK/.test(out);
  console.log((ok ? "✓ " : "✗ ") + f);
  if (!ok) { failed.push(f); (bad.length ? bad : out.trim().split("\n").slice(-3)).forEach(l => console.log("    " + l)); }
}
console.log(`\n${files.length - failed.length} de ${files.length} bien` + (failed.length ? `; fallan: ${failed.join(", ")}` : ""));
process.exit(failed.length ? 1 : 0);
