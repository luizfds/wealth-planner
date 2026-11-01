import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// v3.206.1 (item 237): page modules reach app.js through `app` (src/lib/appctx.js). ESLint's no-undef sees a
// name a moved handler lost; this sees the other half — an app.<name> nothing registered, which would be
// undefined only when that handler ran.
const src = path.join(import.meta.dirname, "..", "src");
const appJs = fs.readFileSync(path.join(src, "app.js"), "utf8");
const reg = appJs.match(/registerApp\(\{([^}]*)\}\)/);
const registered = new Set((reg ? reg[1].split(",").map(x => x.trim()).filter(Boolean) : []).concat([...appJs.matchAll(/defineVar\("([\w$]+)"/g)].map(m => m[1])));

function files(dir){ return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? files(path.join(dir, d.name)) : d.name.endsWith(".js") ? [path.join(dir, d.name)] : []); }

test("every app.<name> a module uses is registered by app.js", function(){
  const missing = [];
  files(src).filter(f => !f.endsWith("app.js") && !f.endsWith("appctx.js")).forEach(function(f){
    const text = fs.readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");
    if(!/import \{ app \} from "[./]+lib\/appctx\.js"|import \{ app \} from "\.\/appctx\.js"/.test(text)) return;
    for(const m of text.matchAll(/\bapp\.([\w$]+)/g)) if(!registered.has(m[1])) missing.push(path.relative(src, f) + ": app." + m[1]);
  });
  assert.deepEqual([...new Set(missing)], []);
  assert.ok(registered.size > 0);
});
