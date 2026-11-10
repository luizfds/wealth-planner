import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// #255 (docs/design/pages.md §3): one way to say add, one way to show delete. The smoke run checks what is on a
// page; most deletes live inside a row's editor, which it doesn't open — so this reads the markup where it is written.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["index.html"].concat(["src/components", "src/lib"].flatMap(function(dir){
  return fs.readdirSync(path.join(root, dir)).filter(function(f){ return f.endsWith(".js"); }).map(function(f){ return dir + "/" + f; });
}));
// Every <button …> a file writes, with the text that follows it up to the next tag.
function buttons(){
  var out = [];
  files.forEach(function(file){
    fs.readFileSync(path.join(root, file), "utf8").split("\n").forEach(function(line, i){
      var re = /<button\b([^>]*)>([^<]*)/g, m;
      while((m = re.exec(line))) out.push({ where: file + ":" + (i + 1), tag: m[1], text: m[2].trim() });
    });
  });
  return out;
}

test("every delete or remove button is .btn-danger", function(){
  var bad = buttons().filter(function(b){
    var label = (/aria-label="([^"]*)/.exec(b.tag) || [])[1] || "";
    var deletes = /^(Delete|Remove)\b/.test(b.text) || /^(Delete|Remove)\b/.test(label);
    return deletes && !/\bbtn-danger\b/.test(b.tag);
  }).map(function(b){ return b.where + " " + (b.text || b.tag.slice(0, 60)); });
  assert.deepEqual(bad, []);
});

test("an add button reads \"+ Add\" and the thing, lower case, with no article", function(){
  var bad = buttons().filter(function(b){
    if(!/^\+? ?Add\b/.test(b.text)) return false;
    if(/^Add (to|with|from) /.test(b.text)) return false;          // "Add to budget", "Add with full details": not adding a row
    if(/^Add ' \+/.test(b.text)) return false;                      // "Add 3 trades": a count, built in code
    return !/^\+ Add (?!an? |the )([a-z]|' \+)/.test(b.text);
  }).map(function(b){ return b.where + " " + b.text; });
  assert.deepEqual(bad, []);
});
