import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { recordError, errorLog, clearErrorLog, errorLogHtml, MAX_ERRORS } from "../src/lib/errorlog.js";

test("an error is kept on this device, the same one within a minute counted, the oldest dropped past the cap", function(){
  clearErrorLog();
  var t = new Date("2026-11-01T10:00:00Z");
  recordError({ kind: "error", message: "x is not defined", where: "home.js:12", version: "v3.202.0" }, t);
  recordError({ kind: "error", message: "x is not defined", where: "home.js:12", version: "v3.202.0" }, new Date(t.getTime() + 30000));
  assert.equal(errorLog().length, 1);
  assert.equal(errorLog()[0].count, 2);
  recordError({ kind: "error", message: "x is not defined", where: "home.js:12" }, new Date(t.getTime() + 120000));
  assert.equal(errorLog().length, 2, "a minute later it's a new line");
  for(var i = 0; i < MAX_ERRORS + 5; i++) recordError({ message: "e" + i, where: "a.js:" + i }, new Date(t.getTime() + 200000 + i * 1000));
  assert.equal(errorLog().length, MAX_ERRORS);
  assert.equal(errorLog()[MAX_ERRORS - 1].message, "e" + (MAX_ERRORS + 4));
  assert.equal(recordError({ message: "y".repeat(500) }, t).message.length, 300, "a message is cut short");
  clearErrorLog();
  assert.deepEqual(errorLog(), []);
});

test("Settings shows nothing until there's something, then the newest first, escaped", function(){
  assert.equal(errorLogHtml([]), "");
  var html = errorLogHtml([{ at: "2026-11-01T10:00:00.000Z", message: "first", where: "a.js:1", count: 1 }, { at: "2026-11-01T11:00:00.000Z", message: "<b>second</b>", where: "b.js:2", count: 3 }],
    function(s){ return String(s).replace(/</g, "&lt;"); });
  assert.ok(html.indexOf("second") < html.indexOf("first"));
  assert.match(html, /&lt;b>second/);
  assert.match(html, /×3/);
  assert.match(html, /data-el-copy/);
});
