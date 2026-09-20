// Grouping hand-typed transaction descriptions into merchants.
//
// Deliberately NOT import-rules.js's merchantKey(). That one is tuned for bank export strings
// ("EFTPOS WOOLWORTHS 1234 SYDNEY NS") and earns its aggression there — it drops leading payment
// rails, stops at the first token containing a digit, and caps at three tokens. Run it over
// something a person typed and it mangles: "Date Night / Eating Out" comes out as
// "night eating out". The two inputs have nothing in common except being strings.
//
// What people actually type is already close to the merchant name. So the job here is only to
// stop near-identical spellings from splitting into separate rows, and nothing more:
//
//   "Leaf café" / "Leaf Café"          -> one merchant (case, accents)
//   "Doordash" / "Doordash (El Jannah)" -> one merchant (the bracket says which restaurant,
//                                          but the money went to DoorDash)
//   "Date Night / Eating Out"           -> "Date Night" (a slash is someone writing two labels)
//
// Anything more clever — stemming, fuzzy distance, token frequency — would start merging things
// the user meant to keep apart, and they have no way to correct it. Under-grouping shows two rows
// where one would do; over-grouping reports a number that is wrong. The first is a blemish, the
// second is a lie, so this errs firmly toward under-grouping.

// Accent-folded, case-folded, bracket- and slash-trimmed. Used only for deciding what groups with
// what — never shown; see merchantGroups() for what the user reads.
export function merchantGroupKey(description){
  var s = String(description == null ? "" : description);
  // Everything after a slash is a second label, not part of the name.
  var slash = s.indexOf("/");
  if(slash > 0) s = s.slice(0, slash);
  // A trailing "(...)" qualifies the purchase rather than naming who was paid.
  s = s.replace(/\s*\([^)]*\)\s*$/, "");
  // NFD splits an accented letter into letter + combining mark, so stripping the marks leaves
  // "café" and "cafe" identical. Done before lowercasing so both halves see the same string.
  if(s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// [{key, label, count, total, share}] sorted biggest spend first.
//
// `label` is the spelling the user themselves used most often for this merchant (ties broken by
// whichever was seen first), so the list reads back in their own words — "Leaf Café", not a
// normalised "leaf cafe" they never typed. Their casing and accents are theirs to keep.
export function merchantGroups(transactions){
  var byKey = {};
  var order = [];
  (transactions || []).forEach(function(t){
    var raw = String((t && t.what) || "").trim();
    if(!raw) return;
    var key = merchantGroupKey(raw);
    if(!key) return;
    if(!byKey[key]){ byKey[key] = { key: key, count: 0, total: 0, spellings: {} }; order.push(key); }
    var g = byKey[key];
    g.count++;
    g.total += Number(t.amount) || 0;
    g.spellings[raw] = (g.spellings[raw] || 0) + 1;
  });
  var grandTotal = order.reduce(function(sum, k){ return sum + byKey[k].total; }, 0);
  return order.map(function(k){
    var g = byKey[k];
    var best = "", bestN = -1;
    Object.keys(g.spellings).forEach(function(sp){
      if(g.spellings[sp] > bestN){ bestN = g.spellings[sp]; best = sp; }
    });
    return {
      key: g.key,
      label: best,
      count: g.count,
      total: Math.round(g.total * 100) / 100,
      share: grandTotal > 0 ? g.total / grandTotal : 0
    };
  }).sort(function(a, b){ return b.total - a.total; });
}

// Whether a breakdown is worth showing at all.
//
// One merchant is not a breakdown, it is the row you already clicked. Two transactions that happen
// to have different names is not a pattern either. The bar is deliberately low but non-zero: this
// panel earns its place on a catch-all line ("Misc." hiding five Amazon orders and a pair of
// shoes), and would be pure noise on "Internet", where every transaction is the same bill.
export var MERCHANT_MIN_GROUPS = 2;
export var MERCHANT_MIN_TRANSACTIONS = 3;
export function worthShowingMerchants(groups, transactionCount){
  return groups.length >= MERCHANT_MIN_GROUPS && transactionCount >= MERCHANT_MIN_TRANSACTIONS;
}

// The merchants a person has actually used recently, newest first — what the quick-log sheet
// offers as tap-to-fill chips. Typing "Doordash" by hand every time is both friction and the
// reason spellings drift apart in the first place, so the chips are as much a data-quality
// feature as a speed one.
//
// Scoped to a budget line when one is given: the chips under "Eating Out" should be the places
// you eat, not last week's electricity bill.
export function recentMerchants(transactions, linkedExpenseId, limit){
  limit = limit || 6;
  var seen = {};
  var out = [];
  var sorted = (transactions || []).slice().sort(function(a, b){
    return String((b && b.date) || "").localeCompare(String((a && a.date) || ""));
  });
  for(var i = 0; i < sorted.length && out.length < limit; i++){
    var t = sorted[i];
    if(linkedExpenseId && t.linkedExpenseId !== linkedExpenseId) continue;
    var raw = String((t && t.what) || "").trim();
    if(!raw) continue;
    var key = merchantGroupKey(raw);
    if(!key || seen[key]) continue;
    seen[key] = true;
    out.push(raw);
  }
  return out;
}
