import { state } from "../state.js";
import { getTaxPeople } from "./tax.js";

// ---------------- People (v3.44.0) ----------------
//
// A person isn't a record of its own in this app: someone exists once a Gross income row names
// them (getTaxPeople). Everything else about them hangs off that name — state.tax.settings[name],
// each property's ownership[name], a holding's person, a budget line's deductiblePerson, and each
// tax year's people[name] and lodged[name]. Like an account, the link is the string, so renaming
// has to walk every one of those or it silently splits a person in two.

// Every array of budget lines (and property income rows) that can carry a deductiblePerson.
function everyClaimableArray(){
  var arrays = [state.shared || [], state.income || []];
  Object.keys(state.home || {}).forEach(function(name){ if(Array.isArray(state.home[name])) arrays.push(state.home[name]); });
  (state.properties || []).forEach(function(p){
    if(Array.isArray(p.expenses)) arrays.push(p.expenses);
    if(Array.isArray(p.income)) arrays.push(p.income);
  });
  return arrays;
}

// Where a name is used — what the People tab shows under each person, and what a rename moves.
export function personReferences(name){
  var out = { incomeRows: 0, assets: 0, properties: [], deductibleLines: 0, taxYears: [] };
  if(!name) return out;
  (state.income || []).forEach(function(i){ if(i.person === name) out.incomeRows++; });
  (state.assets || []).forEach(function(a){ if(a.person === name) out.assets++; });
  (state.properties || []).forEach(function(p){
    var pct = p.ownership && p.ownership[name];
    if(pct != null && Number(pct) > 0) out.properties.push({ id: p.id, what: p.what || "Property", pct: Number(pct) });
  });
  everyClaimableArray().forEach(function(rows){
    rows.forEach(function(r){ if(r.deductible && r.deductiblePerson === name) out.deductibleLines++; });
  });
  Object.keys(state.taxYears || {}).forEach(function(fy){
    var rec = state.taxYears[fy];
    if(rec && ((rec.people && rec.people[name]) || (rec.lodged && rec.lodged[name]))) out.taxYears.push(Number(fy));
  });
  out.taxYears.sort();
  return out;
}

function moveKey(obj, from, to){
  if(!obj || typeof obj !== "object" || !(from in obj)) return false;
  obj[to] = obj[from];
  delete obj[from];
  return true;
}

// Renames a person on every row and record that names them. Returns how many places changed, or
// an error string when the rename can't happen (blank, or the name is already someone else's).
export function renamePersonEverywhere(oldName, newName){
  newName = String(newName || "").trim();
  if(!oldName || !newName) return { error: "A person needs a name" };
  if(newName === oldName) return { changed: 0 };
  if(getTaxPeople().indexOf(newName) !== -1) return { error: '"' + newName + '" already exists' };
  var changed = 0;
  (state.income || []).forEach(function(i){ if(i.person === oldName){ i.person = newName; changed++; } });
  (state.assets || []).forEach(function(a){ if(a.person === oldName){ a.person = newName; changed++; } });
  everyClaimableArray().forEach(function(rows){
    rows.forEach(function(r){ if(r.deductiblePerson === oldName){ r.deductiblePerson = newName; changed++; } });
  });
  // Ownership shares live on each property — missing one would drop that share to 0%.
  (state.properties || []).forEach(function(p){ if(moveKey(p.ownership, oldName, newName)) changed++; });
  if(state.tax && moveKey(state.tax.settings, oldName, newName)) changed++;
  Object.keys(state.taxYears || {}).forEach(function(fy){
    var rec = state.taxYears[fy];
    if(!rec) return;
    if(moveKey(rec.people, oldName, newName)) changed++;
    if(moveKey(rec.lodged, oldName, newName)) changed++;
  });
  return { changed: changed };
}

// Taking someone out of tax: their income rows go back to Net (counted at face value), their
// settings and property shares go. Holdings, budget lines and past tax years keep the name — those
// record what happened, and re-adding a person spelled the same way picks them back up.
export function removePersonFromTax(name){
  (state.income || []).forEach(function(i){ if(i.person === name){ i.incomeType = "Net"; i.person = ""; } });
  if(state.tax && state.tax.settings) delete state.tax.settings[name];
  (state.properties || []).forEach(function(p){ if(p.ownership) delete p.ownership[name]; });
}

// Age in whole years on a date ("YYYY-MM-DD"), or null without a date of birth.
export function ageOn(dob, today){
  if(!dob || !today) return null;
  var b = String(dob).split("-").map(Number), t = String(today).split("-").map(Number);
  if(b.length < 3 || t.length < 3 || b.some(isNaN) || t.some(isNaN)) return null;
  var age = t[0] - b[0];
  if(t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) age--;
  return age >= 0 ? age : null;
}
