import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { appVersion, moduleFiles, stampedIndex, stampProblems, withScriptHashes } from "../scripts/stamp.mjs";

// The release stamps every module after a merge (scripts/release.mjs → npm run stamp); a pull request doesn't, so a
// release never conflicts with the PRs still open. What a PR can't leave for the release is checked here.
test("index.html and styles.css load nothing stale, missing or blocked", function(){
  var html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  var css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.deepEqual(stampProblems(html, css, appVersion(html), moduleFiles()), [], "fix these — an inline script's hash: npm run stamp -- --hashes");
});

test("what a pull request has to get right without stamping", function(){
  var v = "1.2.3", files = ["src/app.js", "src/state.js"];
  var base = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'">\n<p class="app-version"><span class="app-version-num">v1.2.3</span></p>\n<link rel="stylesheet" href="styles.css">\n<script type="module" src="src/app.js"></script>';
  var stamped = stampedIndex(base, v, files), css = '@import url("src/styles/base.css?v=1.2.3") layer(base);\n@import url("src/styles/new.css") layer(pages);';
  assert.deepEqual(stampProblems(stamped, css, v, files), [], "a stamped page is fine");
  assert.deepEqual(stampProblems(stamped, css, v, files.concat(["src/new.js"])), [], "a new module, not yet in the map, waits for the release");
  assert.match(stampProblems(stamped, css, v, ["src/app.js"]).join(), /lists src\/state\.js, which doesn't exist/);
  assert.match(stampProblems(stamped.replace("</p>", "</p><script>go()</script>"), css, v, files).join(), /inline <script> isn't allowed/);
  assert.deepEqual(stampProblems(withScriptHashes(stamped.replace("</p>", "</p><script>go()</script>")), css, v, files), [], "--hashes allows it");
  assert.match(stampProblems(stamped, css, "1.2.4", files).join(), /maps src\/app\.js to \.\/src\/app\.js\?v=1\.2\.3, not v1\.2\.4/);
  assert.match(stampProblems(stamped, css.replace("base.css?v=1.2.3", "base.css?v=1.0.0"), v, files).join(), /styles\.css imports src\/styles\/base\.css\?v=1\.0\.0/);
});

test("the import map maps each module to one versioned URL", function(){
  var out = stampedIndex('<p class="app-version"><span class="app-version-num">v1.2.3</span></p>\n<link rel="stylesheet" href="styles.css">\n<script type="module" src="src/app.js"></script>', "1.2.3", ["src/app.js", "src/state.js"]);
  var map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(out)[1]);
  assert.deepEqual(map.imports, { "./src/app.js": "./src/app.js?v=1.2.3", "./src/state.js": "./src/state.js?v=1.2.3" });
  assert.match(out, /src="src\/app\.js\?v=1\.2\.3"/);
  assert.match(out, /href="styles\.css\?v=1\.2\.3"/);
  assert.ok(out.indexOf("importmap") < out.indexOf('type="module"'), "the map comes before the module script");
  assert.deepEqual(out.match(/<link rel="modulepreload" href="[^"]+">/g), ['<link rel="modulepreload" href="./src/app.js?v=1.2.3">', '<link rel="modulepreload" href="./src/state.js?v=1.2.3">']);
  assert.ok(out.indexOf("importmap") < out.indexOf("modulepreload"), "the map comes before the preloads");
  assert.equal(stampedIndex(out, "1.2.4", ["src/app.js"]).match(/type="importmap"/g).length, 1, "re-stamping replaces, never adds");
});
