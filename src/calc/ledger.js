export function toWeekly(amount, freq){
  amount = Number(amount) || 0;
  switch(freq){
    case "Weekly": return amount;
    case "Fortnightly": return amount / 2;
    case "Monthly": return amount / (52/12);
    case "Quarterly": return amount / 13;
    case "Yearly": return amount / 52;
    default: return 0;
  }
}
export function periodsOf(amount, freq){
  var w = toWeekly(amount, freq);
  return { weekly:w, fortnightly:w*2, monthly:w*52/12, quarterly:w*13, yearly:w*52 };
}
export function sumField(items, field){
  return items.reduce(function(s,i){ return s + periodsOf(i.amount, i.freq)[field]; }, 0);
}
export function sumByClassification(items, cls, field){
  return items.filter(function(i){ return i.classification === cls; })
              .reduce(function(s,i){ return s + periodsOf(i.amount, i.freq)[field]; }, 0);
}
export function safeDiv(a, b){ return b ? a / b : 0; }
// A ledger item can optionally carry a sparse per-scenario amount override (see
// state.shared[]'s scenarioOverrides) so the same expense (e.g. water rates) can differ between
// scenarios/the baseline without needing a separate row per scenario. Absent map or absent key
// for this scenario just falls back to the item's plain amount, so every existing item (which
// has no scenarioOverrides field at all) behaves exactly as before.
export function resolveSharedAmount(item, scenarioName){
  var overrides = item.scenarioOverrides;
  return (overrides && overrides[scenarioName] != null) ? overrides[scenarioName] : item.amount;
}
export function sumFieldForScenario(items, scenarioName, field){
  return items.reduce(function(s, i){ return s + periodsOf(resolveSharedAmount(i, scenarioName), i.freq)[field]; }, 0);
}
// Advances a date by one occurrence of the given ledger frequency. Month/year steps use
// setMonth/setFullYear rather than a fixed day count, so e.g. a Monthly bill last paid on the
// 31st correctly rolls to the last day of shorter months instead of drifting.
function addFreqStep(d, freq){
  var next = new Date(d.getTime());
  switch(freq){
    case "Weekly": next.setDate(next.getDate() + 7); break;
    case "Fortnightly": next.setDate(next.getDate() + 14); break;
    case "Quarterly": next.setMonth(next.getMonth() + 3); break;
    case "Yearly": next.setFullYear(next.getFullYear() + 1); break;
    default: next.setMonth(next.getMonth() + 1); // Monthly, and the default for any other freq
  }
  return next;
}
// Given when an expense was last incurred and how often it recurs, projects the next
// occurrence on/after fromDateStr (defaults to today) — always at least one step past
// lastIncurredDate, even if that date is today or in the future (i.e. "next due" never means
// "due today, the day you just paid it"). Returns null if lastIncurredDate is absent/invalid,
// so callers can distinguish "never tracked" from a real computed date.
export function nextDueDate(lastIncurredDate, freq, fromDateStr){
  if(!lastIncurredDate) return null;
  var d = new Date(lastIncurredDate + "T00:00:00");
  if(isNaN(d.getTime())) return null;
  var from = fromDateStr ? new Date(fromDateStr + "T00:00:00") : new Date();
  from.setHours(0, 0, 0, 0);
  d = addFreqStep(d, freq);
  var guard = 0; // belt-and-suspenders against an unexpected infinite loop, not expected to bite
  while(d.getTime() < from.getTime() && guard < 1000){
    d = addFreqStep(d, freq);
    guard++;
  }
  return d.toISOString().slice(0, 10);
}
// Whole days between fromDateStr (defaults to today) and dateStr — negative means dateStr is in
// the past (overdue).
export function daysUntil(dateStr, fromDateStr){
  var from = fromDateStr ? new Date(fromDateStr + "T00:00:00") : new Date();
  from.setHours(0, 0, 0, 0);
  var d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
export function sumByAccount(items, field){
  var map = {};
  items.forEach(function(i){
    var acct = (i.account || "").trim() || "Unassigned";
    var v = periodsOf(i.amount, i.freq)[field];
    map[acct] = (map[acct] || 0) + v;
  });
  return map;
}
