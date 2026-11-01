import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { commit, onCommit } from "../src/state.js";

// v3.204.1 (item 235c): an edit says what it touched; listeners hear it. A bare persist() isn't heard
// (it says nothing), and commit() with nothing named is heard as ["*"] — anything may have changed.
test("commit tells its listeners which parts of the state an edit touched", function(){
  // persist() saves a moment later and then shows the saved status — a stand-in for the page it writes to.
  const el = () => ({ className: "", textContent: "", hidden: false, title: "" });
  globalThis.document = globalThis.document || { getElementById: el };
  const heard = [];
  onCommit(function(t){ heard.push(t); });
  assert.deepEqual(commit(["transfers", "accounts"]), ["transfers", "accounts"]);
  commit();
  commit([]);
  assert.deepEqual(heard, [["transfers", "accounts"], ["*"], ["*"]]);
  onCommit(function(){ throw new Error("a listener that breaks"); });
  assert.doesNotThrow(function(){ commit(["txViews"]); }, "one listener failing doesn't stop the save or the rest");
  assert.deepEqual(heard[heard.length - 1], ["txViews"]);
});
