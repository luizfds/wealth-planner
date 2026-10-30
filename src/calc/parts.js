// ---------------- Only the parts you use (v3.161.0, item 191) ----------------
//
// A renter with no shares saw a Property tab, a Shares tab, two Benchmarks cards and three reports
// about things they don't have. Each part here is on when the household has one (worked out from the
// data — a property, a share holding) unless it's been set in Settings → Preferences or answered in
// the first-run setup: state.parts[key] = "on" | "off", absent for "work it out". Off hides; it never
// deletes, and what's hidden still counts in net worth. Pure: components/parts.js applies it.
//
// Two parts, not five: super is in every Australian household's picture, a partner is just a second
// person (nothing to hide), and the app has nothing for a business yet.

export var PARTS = [
  { key: "property", label: "A property", hint: "a home you own or an investment property" },
  { key: "shares", label: "Shares", hint: "shares, ETFs or crypto" }
];

export function partHasData(key, st){
  st = st || {};
  if(key === "property") return (st.properties || []).length > 0;
  if(key === "shares") return (st.assets || []).some(function(a){ return a && a.category === "Shares"; });
  return true;
}

// Whether the part shows: the household's own answer if it gave one, otherwise whether it has one.
export function partOn(key, st){
  var set = st && st.parts && st.parts[key];
  if(set === "on") return true;
  if(set === "off") return false;
  return partHasData(key, st);
}

// For Settings: what "work it out" currently comes to, in words.
export function partReading(key, st){
  var set = st && st.parts && st.parts[key];
  return { setting: set === "on" || set === "off" ? set : "auto", on: partOn(key, st), hasData: partHasData(key, st) };
}

// Notices (calc/advice.js) and Checks (calc/health.js) that are about a part, by id — kept out while
// the part is off, so a household that set Property off isn't told about its rental.
var PART_IDS = {
  property: [/^payg:/, /^offset-/, /^ded-noprop/, /^ded-propdouble/, /^dep-missing/, /^dup-acq/, /^loan-/, /^own\b/, /^rent-vs-statements/],
  shares: [/^concentration/, /^tiny-holdings/]
};
export function partAllows(id, st){
  return !Object.keys(PART_IDS).some(function(key){
    return !partOn(key, st) && PART_IDS[key].some(function(re){ return re.test(String(id || "")); });
  });
}
