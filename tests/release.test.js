import { test } from "node:test";
import assert from "node:assert/strict";
import { nextVersion, decideBump, shipsToUsers } from "../scripts/release.mjs";

test("the next version: minor resets the patch, patch counts up", function(){
  assert.equal(nextVersion("3.201.0", "minor"), "3.202.0");
  assert.equal(nextVersion("v3.201.4", "minor"), "3.202.0");
  assert.equal(nextVersion("3.201.0", "patch"), "3.201.1");
  assert.equal(nextVersion("3.9.9", "major"), "4.0.0");
  assert.throws(function(){ nextVersion("3.2", "minor"); });
  assert.throws(function(){ nextVersion("3.2.0", "big"); });
});

test("which release: a label decides; else nothing shipped is none, all fixes a patch, anything else minor", function(){
  var app = ["src/calc/autopay.js", "index.html"];
  assert.equal(decideBump({ labels: ["release: patch"], titles: ["A new thing"], files: app }), "patch");
  assert.equal(decideBump({ labels: ["Release: None"], titles: ["A new thing"], files: app }), "none");
  assert.equal(decideBump({ labels: ["release:minor"], titles: ["Fix a thing"], files: app }), "minor");
  assert.equal(decideBump({ labels: [], titles: ["Roadmap: 240 started", "Docs"], files: [".claude/ROADMAP.md", "CLAUDE.md"] }), "none");
  assert.equal(decideBump({ labels: [], titles: ["Tests"], files: ["tests/a.test.js", ".github/workflows/checks.yml"] }), "none");
  assert.equal(decideBump({ labels: [], titles: ["Fix the bills sheet on a phone", "Roadmap: 233 started"], files: app }), "patch");
  assert.equal(decideBump({ labels: [], titles: ["Automatic payments (231)", "Fix a typo"], files: app }), "minor");
  // A push that already moved the version by hand isn't released twice.
  assert.equal(decideBump({ labels: ["release: minor"], titles: ["x"], files: app, versionChanged: true }), "none");
});

test("what ships: the app and its assets, not docs, tests or tooling", function(){
  ["src/app.js", "src/styles/base.css", "index.html", "styles.css", "sw.js", "vendor/pdfjs/pdf.min.mjs", "icons/icon-512.png"].forEach(function(f){ assert.ok(shipsToUsers(f), f); });
  [".claude/ROADMAP.md", "CLAUDE.md", "tests/x.test.js", "scripts/smoke.mjs", "package.json", ".github/workflows/release.yml", "prices/latest.json"].forEach(function(f){ assert.ok(!shipsToUsers(f), f); });
});
