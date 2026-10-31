// ---------------- A timeline of when things happen (v3.192.0, item 223) ----------------
//
// A scenario's changes in the order they land: the year each starts (as set; at an age, from today's
// age; when cash reaches an amount, the year the projection found — or not within 30 years), a home bought
// or money invested now, retiring at an age. Pure: the changes, the projection's triggers and an age in.

function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
function money(n){ return "$" + Math.round(n).toLocaleString("en-AU"); }

// opts: { changes, triggers: { id: year|null }, age, buying, investing, propertyName(id) }
// → [{ year (0 = now, null = not within the projection), label, why }] sorted, the unreached last.
export function scenarioTimeline(opts){
  opts = opts || {};
  var out = [];
  if(opts.buying) out.push({ year: 0, label: "Buy the home", why: "" });
  if(opts.investing) out.push({ year: 0, label: "Invest instead", why: "" });
  (opts.changes || []).forEach(function(c){
    if(!c || c.kind === "home" || c.kind === "amount" || c.kind === "assume") return;
    var label = c.kind === "rent" ? "Rent " + money(num(c.amount)) + "/" + (c.freq === "Monthly" ? "mo" : "wk")
      : c.kind === "ip" ? (!c.what || c.what === "Investment property" ? "Buy an investment property" : "Buy " + c.what)
      : c.kind === "cost" ? (num(c.amount) < 0 ? "Save " + money(-num(c.amount)) : (c.what || "A new cost"))
      : c.kind === "sell" ? "Sell " + ((opts.propertyName && opts.propertyName(c.propertyId)) || "a property")
      : c.kind === "extra" ? "Extra repayments"
      : c.kind === "retire" ? "Retire at " + num(c.age) : "A change";
    var year, why = "";
    if(c.kind === "retire"){ year = opts.age == null ? null : Math.max(0, Math.round(num(c.age) - opts.age)); why = opts.age == null ? "your age isn't set" : ""; }
    else if(c.when === "cash" && c.kind !== "sell" && num(c.whenCash) > 0){
      year = opts.triggers && c.id in opts.triggers ? opts.triggers[c.id] : null;
      year = year == null ? null : year - 1; // the year it starts in, counted from now
      why = "when cash reaches " + money(num(c.whenCash));
    } else if(c.when === "age"){ year = opts.age == null ? null : Math.max(0, Math.round(num(c.whenAge) - opts.age)); why = "at " + num(c.whenAge); }
    else year = Math.max(0, Math.floor(num(c.fromYear)));
    out.push({ year: year, label: label, why: why });
  });
  return out.sort(function(a, b){ return (a.year == null) - (b.year == null) || (a.year || 0) - (b.year || 0); });
}
export function yearText(y){ return y == null ? "Not within 30 years" : y === 0 ? "Now" : "Year " + (y + 1); }
