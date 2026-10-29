import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Item 185: one type scale. Every font-size is a --fs-* token from base.css (print sizes in pt
// aside), the scale has nothing under 12px, and there are two weights.
var root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
function files(dir, ext){ return fs.readdirSync(path.join(root, dir)).filter(function(f){ return f.endsWith(ext); }).map(function(f){ return path.join(dir, f); }); }
var all = files("src/styles", ".css").concat(files("src/components", ".js"), files("src/lib", ".js"), ["src/app.js", "index.html"]);

test("no font-size in px outside the scale's own tokens", function(){
  var bad = [];
  all.forEach(function(f){
    fs.readFileSync(path.join(root, f), "utf8").split("\n").forEach(function(line, i){
      if(/^\s*--fs-[a-z0-9]+:\s*\d/.test(line)) return;
      if(/font-size\s*:\s*[\d.]+px|font:\s*(\d{3}\s+)?[\d.]+px/.test(line)) bad.push(f + ":" + (i + 1));
    });
  });
  assert.deepEqual(bad, []);
});

test("the scale starts at 12px and the weights are 400 and 600", function(){
  var base = fs.readFileSync(path.join(root, "src/styles/base.css"), "utf8");
  var sizes = [...base.matchAll(/--fs-[a-z0-9]+:\s*([\d.]+)px/g)].map(function(m){ return Number(m[1]); });
  assert.ok(sizes.length >= 6 && Math.min.apply(null, sizes) >= 12, "sizes " + sizes);
  var heavy = [];
  all.forEach(function(f){ if(/font-weight\s*:\s*(500|650|700|800|900|bold)\b/.test(fs.readFileSync(path.join(root, f), "utf8"))) heavy.push(f); });
  assert.deepEqual(heavy, []);
});
