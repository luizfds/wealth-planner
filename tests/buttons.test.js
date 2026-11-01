import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Item 186: five kinds of button. A delete is .btn-danger, never a ghost that happens to hover red,
// and .link-btn has a look of its own rather than the browser's grey box.
var root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
function files(dir, ext){ return fs.readdirSync(path.join(root, dir)).filter(function(f){ return f.endsWith(ext); }).map(function(f){ return path.join(dir, f); }); }
var sources = files("src/components", ".js").concat(files("src/lib", ".js"), ["src/app.js", "index.html"]);

test("every delete button is .btn-danger", function(){
  var bad = [];
  sources.forEach(function(f){
    (fs.readFileSync(path.join(root, f), "utf8").match(/<button[^>]*>/g) || []).forEach(function(t){
      if(/btn-ghost/.test(t) && /data-[a-z-]*-del(?:ete)?[="' ]|data-delete=|row-del|menu-danger/.test(t)) bad.push(f + ": " + t.slice(0, 80));
    });
  });
  assert.deepEqual(bad, []);
});

test(".link-btn and .btn-danger are defined in base.css", function(){
  var base = fs.readFileSync(path.join(root, "src/styles/base.css"), "utf8");
  assert.match(base, /\.link-btn\{[^}]*background:none[^}]*color: var\(--brass-strong\)/);
  assert.match(base, /\.btn-danger\{[^}]*color: var\(--bad-ink\)/);
  assert.doesNotMatch(base, /\.btn-ghost:hover\{[^}]*bad-ink/, "a ghost button isn't a delete");
});
