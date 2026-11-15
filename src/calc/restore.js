// ---------------- Restoring a backup: check it, say what it holds (#265) ----------------
//
// A backup replaces the whole household, so it is checked before anything asks to replace it. It used to be
// enough for a file to have an `income` and a `home`: `{"income":[],"home":{}}` passed and emptied a
// household, and `{"income":"x","home":"y"}` was offered as a replacement before failing. Now the lists a
// backup holds have to be lists, and it has to migrate (in a copy) the way the app would load it.
//
// What a household holds is summed the same way for the backup and for this device, so the dialog can put
// the two side by side. Shared by Settings → Preferences (components/datawiring.js) and welcome.html.
import { migrateState } from "../state.js";

var LISTS = ["income", "shared", "transactions", "assets", "accounts", "properties", "debts", "incomeLog", "transfers", "savingsGoals", "scenarios"];

// { ok: true, household } with the backup migrated as the app would load it, or { ok: false, reason }.
// `parsed` is not changed.
export function readBackup(parsed){
  if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "That file doesn't look like a valid backup" };
  if(!Array.isArray(parsed.income) || !parsed.home || typeof parsed.home !== "object" || Array.isArray(parsed.home)) return { ok: false, reason: "That file doesn't look like a valid backup" };
  var wrong = LISTS.filter(function(k){ return parsed[k] != null && !Array.isArray(parsed[k]); });
  if(wrong.length) return { ok: false, reason: "That file doesn't look like a valid backup — its " + wrong.join(", ") + (wrong.length === 1 ? " isn't a list" : " aren't lists") };
  var copy;
  try { copy = migrateState(JSON.parse(JSON.stringify(parsed))); }
  catch(e){ return { ok: false, reason: "That backup couldn't be read by this version of the app" }; }
  return { ok: true, household: copy };
}

function count(list, keep){ return Array.isArray(list) ? list.filter(keep || Boolean).length : 0; }

// What a household holds, in the words the pages use. Computed rows (a person's take-home, the rent) are
// worked out from the others and aren't counted.
export function householdSummary(st){
  st = st || {};
  return {
    savedAt: st.savedAt || "",
    savedBy: st.savedByName || "",
    // The Budget tab's lines; today's housing is among them (a scenario's own housing is part of that scenario).
    budget: count(st.shared),
    income: count(st.income, function(r){ return r && !r.computed; }),
    transactions: count(st.transactions),
    accounts: count(st.accounts),
    holdings: count(st.assets),
    properties: count(st.properties),
    debts: count(st.debts)
  };
}

var PARTS = [["budget", "budget line", "budget lines"], ["income", "income row", "income rows"], ["transactions", "transaction", "transactions"],
  ["accounts", "account", "accounts"], ["holdings", "asset", "assets"], ["properties", "property", "properties"], ["debts", "debt", "debts"]];

export function summaryIsEmpty(s){ return PARTS.every(function(p){ return !s[p[0]]; }); }

// "20 budget lines, 3 income rows, …" — or "nothing" for an empty household.
export function summaryText(s){
  var bits = PARTS.filter(function(p){ return s[p[0]]; }).map(function(p){ return s[p[0]] + " " + (s[p[0]] === 1 ? p[1] : p[2]); });
  return bits.length ? bits.join(", ") : "nothing";
}

// The restore dialog's question and its two lines: what the backup holds, and what this device holds.
// `when` formats a saved-at time for display; `newer` is "here" | "incoming" | other (compareCopies).
export function restoreQuestion(backup, here, newer, when){
  var b = householdSummary(backup), h = householdSummary(here);
  var empty = summaryIsEmpty(b);
  var message = empty
    ? "This backup is empty — it holds no budget, income, transactions, accounts, assets, properties or debts. Restoring it leaves this device with an empty household."
    : newer === "here"
      ? "This backup is OLDER than what's on this device. Replace this device's newer household with it?"
      : "Replace this device's household with this backup?";
  var details = [
    "This backup" + (b.savedAt ? ", last changed " + when(b.savedAt) : "") + (b.savedBy ? " by " + b.savedBy : "") + ": " + summaryText(b) + ".",
    "This device" + (h.savedAt ? ", last changed " + when(h.savedAt) : "") + ": " + summaryText(h) + ".",
    "You can undo this straight after, until anything else changes."
  ];
  return { message: message, details: details, empty: empty };
}
