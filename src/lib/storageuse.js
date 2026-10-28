// ---------------- How full the browser's storage is (v3.138.0) ----------------
//
// Everything lives in localStorage, and a browser allows a site about five million characters of it
// (Chrome, Firefox and Safari all land near there). Nothing warned before a save failed for lack of
// room. This measures what the app's keys hold and says how far along that is; a notification
// speaks up from 70%, and Settings → Preferences shows the figure any time. The data is almost all
// plain text, so a character is about a byte, which is how it's shown.
export var STORAGE_QUOTA_CHARS = 5000000;

// Characters held under every key (key and value, as browsers count them).
export function storageUsedChars(ls){
  var n = 0;
  try {
    for(var i = 0; i < ls.length; i++){ var k = ls.key(i); n += k.length + (ls.getItem(k) || "").length; }
  } catch(e){ return null; }
  return n;
}
// { pct, level: null | "info" (70%+) | "warn" (85%+) }.
export function storageLevel(used, quota){
  quota = quota || STORAGE_QUOTA_CHARS;
  var pct = used == null ? 0 : used / quota;
  return { pct: pct, level: pct >= 0.85 ? "warn" : pct >= 0.7 ? "info" : null };
}
function kb(n){ return n >= 1000000 ? (Math.round(n / 100000) / 10) + " MB" : Math.max(1, Math.round(n / 1000)) + " KB"; }
export function storageLineText(used, quota){
  if(used == null) return "";
  var l = storageLevel(used, quota);
  return "Using " + kb(used) + " of about " + kb(quota || STORAGE_QUOTA_CHARS) + " this browser allows (" + Math.max(1, Math.round(l.pct * 100)) + "%).";
}
