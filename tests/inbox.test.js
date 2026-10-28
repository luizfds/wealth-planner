import test from "node:test";
import assert from "node:assert/strict";
import { isStatementName, statementFiles, inboxMessage } from "../src/calc/inbox.js";

test("only CSV and PDF files count as statements, not hidden or partial ones", () => {
  assert.equal(isStatementName("October.csv"), true);
  assert.equal(isStatementName("card statement.PDF"), true);
  assert.equal(isStatementName(".October.csv"), false);
  assert.equal(isStatementName("~$sheet.csv"), false);
  assert.equal(isStatementName("notes.txt"), false);
  assert.equal(isStatementName(""), false);
});

test("statements come oldest first, empty files left out", () => {
  const out = statementFiles([
    { name: "b.csv", modified: "2026-10-02T00:00:00Z", size: 10 },
    { name: "a.pdf", modified: "2026-10-01T00:00:00Z", size: 10 },
    { name: "empty.csv", modified: "2026-09-01T00:00:00Z", size: 0 },
    { name: "photo.jpg", modified: "2026-09-01T00:00:00Z", size: 10 },
    { name: "a.csv", modified: "2026-10-02T00:00:00Z", size: 10 }
  ]);
  assert.deepEqual(out.map((f) => f.name), ["a.pdf", "a.csv", "b.csv"]);
});

test("the waiting message counts", () => {
  assert.equal(inboxMessage(0, "Dropbox"), "");
  assert.equal(inboxMessage(1, "Dropbox"), "A statement is waiting in Dropbox");
  assert.equal(inboxMessage(3, "Dropbox"), "3 statements are waiting in Dropbox");
});
