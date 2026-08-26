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
export function sumByAccount(items, field){
  var map = {};
  items.forEach(function(i){
    var acct = (i.account || "").trim() || "Unassigned";
    var v = periodsOf(i.amount, i.freq)[field];
    map[acct] = (map[acct] || 0) + v;
  });
  return map;
}
