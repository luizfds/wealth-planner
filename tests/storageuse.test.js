import test from "node:test";
import assert from "node:assert/strict";
import { storageUsedChars, storageLevel, storageLineText, STORAGE_QUOTA_CHARS } from "../src/lib/storageuse.js";

function fakeStorage(obj){ const k = Object.keys(obj); return { length: k.length, key: i => k[i], getItem: x => obj[x] }; }

test("storage used counts every key and value", () => {
  assert.equal(storageUsedChars(fakeStorage({ ab: "1234", c: "" })), 7);
  assert.equal(storageUsedChars({ get length(){ throw new Error("blocked"); } }), null);
});

test("storage speaks up from 70%, louder from 85%", () => {
  assert.equal(storageLevel(0.69 * STORAGE_QUOTA_CHARS).level, null);
  assert.equal(storageLevel(0.7 * STORAGE_QUOTA_CHARS).level, "info");
  assert.equal(storageLevel(0.9 * STORAGE_QUOTA_CHARS).level, "warn");
  assert.equal(storageLevel(null).level, null);
  assert.equal(storageLineText(480000), "Using 480 KB of about 5 MB this browser allows (10%).");
  assert.equal(storageLineText(3600000), "Using 3.6 MB of about 5 MB this browser allows (72%).");
  assert.equal(storageLineText(null), "");
});
