import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { aiKey, setAiKey } from "../src/components/askclaude.js";

function storage(){
  const items = new Map();
  return {
    getItem: key => items.has(key) ? items.get(key) : null,
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: key => { items.delete(key); }
  };
}

test("Anthropic key stays in session storage, not local storage", () => {
  const originalLocal = window.localStorage;
  const originalSession = window.sessionStorage;
  const local = storage(), session = storage();
  window.localStorage = local;
  window.sessionStorage = session;
  try {
    local.setItem("wealthPlanner.anthropicKey", "old-persistent-secret");
    assert.equal(aiKey(), "");
    assert.equal(local.getItem("wealthPlanner.anthropicKey"), null);
    setAiKey("session-secret");
    assert.equal(aiKey(), "session-secret");
    assert.equal(session.getItem("wealthPlanner.anthropicKey"), "session-secret");
    assert.equal(local.getItem("wealthPlanner.anthropicKey"), null);
    setAiKey("");
    assert.equal(aiKey(), "");
    assert.equal(session.getItem("wealthPlanner.anthropicKey"), null);
  } finally {
    window.localStorage = originalLocal;
    window.sessionStorage = originalSession;
  }
});

test("Anthropic key disappears when the browser session storage is replaced", () => {
  const originalLocal = window.localStorage;
  const originalSession = window.sessionStorage;
  window.localStorage = storage();
  window.sessionStorage = storage();
  try {
    setAiKey("temporary-secret");
    window.sessionStorage = storage();
    assert.equal(aiKey(), "");
  } finally {
    window.localStorage = originalLocal;
    window.sessionStorage = originalSession;
  }
});
