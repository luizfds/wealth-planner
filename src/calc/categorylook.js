// ---------------- A colour and an icon for each category (v3.157.0, item 187) ----------------
//
// The same category looks the same wherever it shows: a transaction row, a budget card, a chart
// segment. A category is a plain name (state.categories), so its look is worked out from the name
// — groceries a cart, fuel a pump — unless the household picked its own in Settings → Categories,
// kept in state.categoryLooks[name] = { color, icon }. Pure: lib/caticons.js draws it.

export var CATEGORY_COLORS = 12;   // --cat-0 … --cat-11 in base.css, light and dark
export var CATEGORY_ICONS = ["cart", "fork", "fuel", "bus", "car", "house", "building", "bolt", "phone", "shield",
  "heart", "dumbbell", "book", "child", "repeat", "bag", "user", "paw", "plane", "gift", "ticket", "receipt", "piggy", "dot"];

// First match wins, so the more particular words come before the general ones.
/** @type {Array<[RegExp, string, number]>} */
var RULES = [
  [/^(other|misc|miscellaneous|general)$/i, "dot", 9],
  [/investment property|rental|strata|council|body corp/i, "building", 10],
  [/grocer|supermarket|food shop/i, "cart", 2],
  [/eating|restaurant|dining|caf[eé]|coffee|takeaway|take-away|lunch|dinner/i, "fork", 1],
  [/fuel|petrol|diesel/i, "fuel", 3],
  [/public transport|transport|transit|parking|toll|taxi|rideshare|uber/i, "bus", 0],
  [/\bcar\b|vehicle|rego|registration|motor/i, "car", 9],
  [/housing|rent\b|mortgage|home loan|\bhome\b/i, "house", 6],
  [/utilit|electric|\bgas\b|water|energy|power/i, "bolt", 3],
  [/phone|mobile|internet|broadband|nbn/i, "phone", 8],
  [/insurance|cover\b/i, "shield", 8],
  [/gym|fitness|sport/i, "dumbbell", 5],
  [/health|medical|doctor|dental|pharma|chemist|hospital/i, "heart", 7],
  [/educat|school|course|tuition|uni\b|university/i, "book", 11],
  [/child|kids|baby|daycare/i, "child", 4],
  [/subscri|streaming|membership/i, "repeat", 8],
  [/shop|clothing|clothes|fashion/i, "bag", 11],
  [/personal|hair|beauty|grooming/i, "user", 5],
  [/\bpets?\b|\bvet\b|animal/i, "paw", 10],
  [/travel|holiday|flight|trip|accommodation|hotel/i, "plane", 8],
  [/gift|donation|charity/i, "gift", 7],
  [/entertain|fun|hobb|leisure|movies|concert/i, "ticket", 1],
  [/tax|accountant|fees|bank charge/i, "receipt", 9],
  [/saving|invest|super\b/i, "piggy", 5]
];

// A name nothing matches still gets a steady colour of its own, not the same grey as every other.
function hashColor(name){
  var h = 0;
  for(var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % CATEGORY_COLORS;
}

// name → { color: 0–11, icon }. `looks` is state.categoryLooks; a pick there wins, field by field.
export function categoryLook(name, looks){
  name = String(name || "").trim();
  var own = (looks && name && looks[name]) || {};
  var hit = null;
  for(var i = 0; i < RULES.length && name; i++){ if(RULES[i][0].test(name)){ hit = RULES[i]; break; } }
  var color = hit ? hit[2] : (name ? hashColor(name) : 9);
  var icon = hit ? hit[1] : "dot";
  if(Number.isInteger(own.color) && own.color >= 0 && own.color < CATEGORY_COLORS) color = own.color;
  if(own.icon && CATEGORY_ICONS.indexOf(own.icon) !== -1) icon = own.icon;
  return { color: color, icon: icon, custom: !!(own.color != null || own.icon) };
}

// A rename carries the look across; a delete drops it. Returns the new map (doesn't mutate).
export function renameCategoryLook(looks, from, to){
  var out = Object.assign({}, looks || {});
  if(out[from]){ if(to && !out[to]) out[to] = out[from]; delete out[from]; }
  return out;
}
