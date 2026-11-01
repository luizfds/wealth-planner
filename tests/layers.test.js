import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// v3.207.1 (item 238): every stylesheet sits in a cascade layer, in the order styles.css declares — so which rule wins
// between files is the declared order, never the order of the @import lines or specificity across files.
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const dir = new URL("../src/styles/", import.meta.url);
const files = fs.readdirSync(dir).filter(f => f.endsWith(".css"));
const declared = [...css.matchAll(/^@layer ([^;{]+);/gm)].flatMap(m => m[1].split(",").map(s => s.trim()));
const imports = [...css.matchAll(/^@import url\("src\/styles\/([a-z-]+\.css)[^"]*"\)(?: layer\(([a-z.-]+)\))?;/gm)].map(m => ({ file: m[1], layer: m[2] }));

test("every stylesheet is imported once, into a declared layer", function(){
  assert.deepEqual(imports.map(i => i.file).sort(), files.slice().sort(), "src/styles/*.css and styles.css's @imports differ");
  imports.forEach(i => {
    assert.ok(i.layer, i.file + " is imported without a layer — unlayered CSS beats every layer");
    assert.ok(declared.includes(i.layer), i.file + "'s layer " + i.layer + " isn't declared in styles.css's @layer statements");
  });
  assert.deepEqual(declared.slice(0, 6), ["base", "layout", "components", "pages", "utilities", "phone"]);
});

test("no @layer blocks inside the stylesheets (they would nest under the file's own layer)", function(){
  files.forEach(f => assert.doesNotMatch(fs.readFileSync(new URL(f, dir), "utf8"), /@layer\b/, f));
});

test("only phone.css sets a size floor with !important — an earlier layer's !important would beat it", function(){
  files.filter(f => f !== "phone.css").forEach(f => {
    const text = fs.readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(text, /min-(height|width)\s*:[^;}]*!important/, f);
  });
});
