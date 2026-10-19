import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { appVersion, moduleFiles, stampedIndex, stampedStyles } from "../scripts/stamp.mjs";

// The version bump and `npm run stamp` go together: if index.html's version moved on and the
// script URLs didn't, an update could again load a new page with an old module.
test("every module and stylesheet carries the current version", function(){
  var html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  var v = appVersion(html);
  assert.equal(html, stampedIndex(html, v, moduleFiles()), "index.html is out of date — run npm run stamp");
  var css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.equal(css, stampedStyles(css, v), "styles.css is out of date — run npm run stamp");
});

test("the import map maps each module to one versioned URL", function(){
  var out = stampedIndex('<p class="app-version"><span class="app-version-num">v1.2.3</span></p>\n<link rel="stylesheet" href="styles.css">\n<script type="module" src="src/app.js"></script>', "1.2.3", ["src/app.js", "src/state.js"]);
  var map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(out)[1]);
  assert.deepEqual(map.imports, { "./src/app.js": "./src/app.js?v=1.2.3", "./src/state.js": "./src/state.js?v=1.2.3" });
  assert.match(out, /src="src\/app\.js\?v=1\.2\.3"/);
  assert.match(out, /href="styles\.css\?v=1\.2\.3"/);
  assert.ok(out.indexOf("importmap") < out.indexOf('type="module"'), "the map comes before the module script");
  assert.equal(stampedIndex(out, "1.2.4", ["src/app.js"]).match(/type="importmap"/g).length, 1, "re-stamping replaces, never adds");
});
