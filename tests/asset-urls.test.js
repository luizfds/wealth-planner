import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ---------------- Root-relative asset URLs ----------------
//
// Guarding a bug that shipped silently and was invisible from the code (fixed v2.78.1).
//
// By the time any app code runs, nav.js has rewritten the address bar to the current route. A
// *document*-relative URL therefore resolves against that route, not against index.html:
//
//   /dashboard          + "sw.js"  ->  /sw.js            correct, by luck
//   /expenses/spending  + "sw.js"  ->  /expenses/sw.js   404
//
// One-segment routes resolve correctly, which is why nobody noticed. On a fresh load of a
// two-segment route (/expenses/*, /assets/* — a shared link, a bookmark, a reload) the service
// worker never registered at all and the update check reported "Couldn't read the deployed
// version". Both had comments claiming they were safe.
//
// nav.js can't be imported here (it touches `location` at module load and these tests have no
// DOM), so this reads the source. A source-level guard is the right shape anyway: what must not
// come back is the *spelling*, and no runtime assertion would catch someone reintroducing it in a
// file this test doesn't happen to exercise.

var APP = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
var NAV = readFileSync(new URL("../src/components/nav.js", import.meta.url), "utf8");

// Strip comments — the explanations of this very bug quote the broken forms verbatim, so leaving
// them in would make the guard pass on prose alone.
//
// Line comments FIRST, then block comments, and the order is load-bearing: app.js contains the
// line comment "// src/*.js", whose "/*" made a block-comment-first strip swallow everything up
// to the next "*/" — including the very call this file is asserting on. (Found by this test
// failing against correct code, which is the right way round.)
function code(src){
  var noLineComments = src.split("\n").map(function(line){
    var i = line.indexOf("//");
    // Naive, but these files have no "//" inside a string literal on a line that matters here —
    // and erring toward stripping only ever makes this guard look at less, never more.
    return i === -1 ? line : line.slice(0, i);
  }).join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
}
var APP_CODE = code(APP);

test("the service worker is registered by a root-relative URL, not a document-relative one", function(){
  assert.match(APP_CODE, /serviceWorker\.register\(\s*appAssetUrl\(/,
    "register() must go through appAssetUrl()");
  assert.doesNotMatch(APP_CODE, /serviceWorker\.register\(\s*["'`]/,
    'register() must not take a bare string — "sw.js" resolves against the current route');
});

test("the deployed-version probe fetches a root-relative index.html", function(){
  assert.match(APP_CODE, /fetch\(\s*appAssetUrl\(\s*["']index\.html["']\s*\)/,
    "the version probe must go through appAssetUrl()");
  assert.doesNotMatch(APP_CODE, /fetch\(\s*["'`]index\.html/,
    'a bare fetch("index.html") resolves against the current route and 404s on /expenses/spending');
});

test("no app code fetches a sibling asset by a bare relative name", function(){
  // Catches the next one of these before it ships, whatever file it lands in.
  var offenders = [];
  [["app.js", APP_CODE], ["nav.js", code(NAV)]].forEach(function(pair){
    var re = /(?:fetch|register)\(\s*["'`](?!\/|https?:|data:|appAssetUrl)([^"'`]+\.(?:js|html|json|webmanifest|css))/g;
    var m;
    while((m = re.exec(pair[1]))) offenders.push(pair[0] + ": " + m[1]);
  });
  assert.deepEqual(offenders, [], "use appAssetUrl() for these");
});

test("appAssetUrl builds a root-relative path under both bases", function(){
  // The function itself can't be imported (nav.js touches `location` at module load), so this
  // pins the shape of what it returns, which is the part that matters: a leading slash, so the
  // URL is resolved against the origin rather than against whatever route is showing.
  var body = /export function appAssetUrl\(file\)\{?[\s\S]*?\n\}/.exec(NAV);
  assert.ok(body, "appAssetUrl should still live in nav.js next to BASE_PATH");
  assert.match(body[0], /BASE_PATH \+ "\/" \+ file/,
    'must be BASE_PATH + "/" + file — BASE_PATH is "" locally and "/wealth-planner" on Pages, so ' +
    "both cases come out root-relative");
});
