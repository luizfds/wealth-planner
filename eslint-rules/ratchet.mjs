// node eslint-rules/ratchet.mjs --update — writes today's counts to eslint-rules/ratchet.json (see ratchet.js).
import fs from "node:fs";
import path from "node:path";
import { parse } from "espree";
import { countIn, inScope } from "./counts.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
function files(dir){ return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith(".js") ? [path.join(dir, e.name)] : []); }
const out = {};
files(path.join(root, "src")).map(f => path.relative(root, f).replace(/\\/g, "/")).filter(inScope).sort().forEach(function(rel){
  const n = countIn(parse(fs.readFileSync(path.join(root, rel), "utf8"), { ecmaVersion: 2022, sourceType: "module" }));
  if(n.persist || n.stateWrites) out[rel] = n;
});
if(process.argv.includes("--update")){ fs.writeFileSync(path.join(root, "eslint-rules/ratchet.json"), JSON.stringify(out, null, 1) + "\n"); console.log("eslint-rules/ratchet.json updated"); }
const t = Object.values(out).reduce((s, n) => ({ persist: s.persist + n.persist, stateWrites: s.stateWrites + n.stateWrites }), { persist: 0, stateWrites: 0 });
console.log("bare persist(): " + t.persist + " · direct state writes: " + t.stateWrites + " (in " + Object.keys(out).length + " files)");
