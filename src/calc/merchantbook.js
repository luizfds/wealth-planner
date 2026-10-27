// ---------------- Well-known merchants (v3.111.0) ----------------
//
// A first import had nothing to go on but budget line names, so most rows landed in "Needs you" —
// even the supermarket, the petrol station and the phone bill, which every Australian household
// files the same way. This is a short list of large public brands and the default category each
// belongs to (constants.js DEFAULT_CATEGORIES), consulted after your own rules and line names, so
// a first import arrives mostly sorted. Brand names only — public, not anyone's data.
//
// Pure: no state. `name` is how the brand is shown once a statement's text is cleaned up.
import { normaliseDescription } from "./bank-import.js";
import { merchantKey } from "./import-rules.js";

export var KNOWN_MERCHANTS = [
  // Groceries
  ["woolworths", "Woolworths", "Groceries"], ["woolies", "Woolworths", "Groceries"], ["coles", "Coles", "Groceries"],
  ["aldi", "ALDI", "Groceries"], ["iga", "IGA", "Groceries"], ["harris farm", "Harris Farm", "Groceries"],
  ["foodworks", "FoodWorks", "Groceries"], ["costco", "Costco", "Groceries"],
  // Fuel and getting around
  ["bp", "BP", "Car"], ["shell", "Shell", "Car"], ["caltex", "Caltex", "Car"], ["ampol", "Ampol", "Car"],
  ["7 eleven", "7-Eleven", "Car"], ["united petroleum", "United Petroleum", "Car"], ["metro petroleum", "Metro Petroleum", "Car"],
  ["puma energy", "Puma Energy", "Car"], ["coles express", "Coles Express", "Car"], ["repco", "Repco", "Car"], ["supercheap auto", "Supercheap Auto", "Car"],
  ["linkt", "Linkt", "Transport"], ["citylink", "CityLink", "Transport"], ["opal", "Opal", "Transport"], ["myki", "myki", "Transport"],
  ["translink", "Translink", "Transport"], ["transperth", "Transperth", "Transport"], ["uber trip", "Uber", "Transport"],
  ["didi", "DiDi", "Transport"], ["13cabs", "13cabs", "Transport"], ["wilson parking", "Wilson Parking", "Transport"], ["secure parking", "Secure Parking", "Transport"],
  // Phones and internet, power, water, gas
  ["telstra", "Telstra", "Utilities"], ["optus", "Optus", "Utilities"], ["vodafone", "Vodafone", "Utilities"], ["tpg", "TPG", "Utilities"],
  ["aussie broadband", "Aussie Broadband", "Utilities"], ["belong", "Belong", "Utilities"], ["amaysim", "amaysim", "Utilities"], ["iinet", "iiNet", "Utilities"],
  ["agl", "AGL", "Utilities"], ["origin energy", "Origin Energy", "Utilities"], ["energyaustralia", "EnergyAustralia", "Utilities"],
  ["energy australia", "EnergyAustralia", "Utilities"], ["red energy", "Red Energy", "Utilities"], ["alinta", "Alinta Energy", "Utilities"],
  ["simply energy", "Simply Energy", "Utilities"], ["powershop", "Powershop", "Utilities"], ["sydney water", "Sydney Water", "Utilities"],
  ["yarra valley water", "Yarra Valley Water", "Utilities"], ["sa water", "SA Water", "Utilities"], ["urban utilities", "Urban Utilities", "Utilities"],
  // Insurance and health cover
  ["nrma", "NRMA", "Insurance"], ["racv", "RACV", "Insurance"], ["racq", "RACQ", "Insurance"], ["aami", "AAMI", "Insurance"],
  ["budget direct", "Budget Direct", "Insurance"], ["allianz", "Allianz", "Insurance"], ["suncorp", "Suncorp", "Insurance"],
  ["youi", "Youi", "Insurance"], ["gio", "GIO", "Insurance"], ["qbe", "QBE", "Insurance"],
  ["medibank", "Medibank", "Health"], ["bupa", "Bupa", "Health"], ["hcf", "HCF", "Health"], ["nib", "nib", "Health"], ["ahm", "ahm", "Health"],
  ["chemist warehouse", "Chemist Warehouse", "Health"], ["priceline", "Priceline", "Health"], ["terry white", "TerryWhite Chemmart", "Health"],
  // Eating out and delivery
  ["mcdonalds", "McDonald's", "Eating out"], ["kfc", "KFC", "Eating out"], ["hungry jacks", "Hungry Jack's", "Eating out"],
  ["guzman y gomez", "Guzman y Gomez", "Eating out"], ["oporto", "Oporto", "Eating out"], ["dominos", "Domino's", "Eating out"],
  ["subway", "Subway", "Eating out"], ["starbucks", "Starbucks", "Eating out"], ["grill d", "Grill'd", "Eating out"],
  ["uber eats", "Uber Eats", "Eating out"], ["menulog", "Menulog", "Eating out"], ["doordash", "DoorDash", "Eating out"],
  // Subscriptions
  ["netflix", "Netflix", "Subscriptions"], ["spotify", "Spotify", "Subscriptions"], ["disney plus", "Disney+", "Subscriptions"],
  ["stan com", "Stan", "Subscriptions"], ["binge", "Binge", "Subscriptions"], ["kayo", "Kayo", "Subscriptions"],
  ["youtube premium", "YouTube Premium", "Subscriptions"], ["amazon prime", "Amazon Prime", "Subscriptions"], ["audible", "Audible", "Subscriptions"],
  // Shopping
  ["kmart", "Kmart", "Shopping"], ["target", "Target", "Shopping"], ["big w", "BIG W", "Shopping"], ["bunnings", "Bunnings", "Shopping"],
  ["officeworks", "Officeworks", "Shopping"], ["jb hi fi", "JB Hi-Fi", "Shopping"], ["harvey norman", "Harvey Norman", "Shopping"],
  ["the good guys", "The Good Guys", "Shopping"], ["myer", "Myer", "Shopping"], ["david jones", "David Jones", "Shopping"],
  ["ikea", "IKEA", "Shopping"], ["amazon", "Amazon", "Shopping"], ["ebay", "eBay", "Shopping"], ["uniqlo", "Uniqlo", "Shopping"],
  ["rebel", "rebel", "Shopping"], ["dan murphys", "Dan Murphy's", "Shopping"], ["bws", "BWS", "Shopping"],
  // Personal
  ["anytime fitness", "Anytime Fitness", "Personal"], ["fitness first", "Fitness First", "Personal"], ["f45", "F45", "Personal"]
].map(function(m){ return { key: m[0], name: m[1], category: m[2] }; });

function containsWholeWords(haystack, needle){
  var i = haystack.indexOf(needle);
  while(i !== -1){
    var after = i + needle.length;
    if((i === 0 || haystack[i - 1] === " ") && (after === haystack.length || haystack[after] === " ")) return true;
    i = haystack.indexOf(needle, i + 1);
  }
  return false;
}

// The brand a bank description names, or null. A short key (BP, IGA, nib…) has to be where the
// merchant starts — as a stray word mid-description it is too easily something else; a longer one
// may be anywhere. The longest key wins, so "uber eats" beats "uber trip" and "amazon prime" beats
// "amazon".
export function knownMerchant(description){
  var norm = normaliseDescription(description);
  if(!norm) return null;
  var lead = merchantKey(description);
  var best = null;
  KNOWN_MERCHANTS.forEach(function(m){
    var ok = m.key.length <= 3 ? (lead === m.key || lead.indexOf(m.key + " ") === 0) : containsWholeWords(norm, m.key);
    if(ok && (!best || m.key.length > best.key.length)) best = m;
  });
  return best;
}

// What a list shows for a transaction: a known brand by its name; bank text (all capitals, or
// carrying a long reference number) cleaned to its merchant words in title case; anything someone
// typed themselves exactly as typed. The bank's own text stays on the transaction.
var STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "nt", "act", "au", "aus", "australia"];
export function looksLikeBankText(s){
  var t = String(s || "").trim();
  return !!t && ((/[A-Z]/.test(t) && t === t.toUpperCase()) || /\d{4,}/.test(t) || /\*/.test(t));
}
export function cleanMerchantName(description){
  var raw = String(description || "").trim();
  if(!looksLikeBankText(raw)) return raw;
  var known = knownMerchant(raw);
  if(known) return known.name;
  var key = merchantKey(raw);
  var words = key.split(" ").filter(function(w){ return w && STATES.indexOf(w) === -1; });
  if(!words.length) return raw;
  return words.map(function(w){ return w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
}
