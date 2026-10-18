import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { hashPasscode, setPasscode, checkPasscode, passcodeSet, clearPasscode } from "../src/lib/safekeeping.js";

test("a passcode is stored salted and hashed, and checks", async function(){
  assert.equal(passcodeSet(), false);
  assert.equal(await checkPasscode("anything"), true, "no passcode: always open");
  await setPasscode("4821");
  assert.ok(passcodeSet());
  var stored = JSON.parse(localStorage.getItem("wealthPlanner.passcode"));
  assert.ok(stored.salt && stored.hash);
  assert.ok(!JSON.stringify(stored).includes("4821"));
  assert.equal(await checkPasscode("4821"), true);
  assert.equal(await checkPasscode("1111"), false);
  assert.equal((await hashPasscode("x", "s")).length, 64);
  clearPasscode();
  assert.equal(passcodeSet(), false);
});
