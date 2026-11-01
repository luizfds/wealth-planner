// ---------------- Problems the app hit (v3.202.0, item 233) ----------------
//
// There's no server to send an error to, so the app keeps its own: the last few uncaught errors and
// rejected promises, on this device (localStorage, never in `state` or the sync file — an error says
// something about this browser, not about the household). Settings → Keeping your data safe lists them, to
// copy into a bug report, and clears them. A message is cut short and carries no data from the page.
//
// app.js imports this module first, so it's listening before anything else runs.
var KEY = "wealthPlanner.errors";
export var MAX_ERRORS = 30;

function storage(){ try { return typeof localStorage !== "undefined" ? localStorage : null; } catch(e){ return null; } }
export function errorLog(){
  var s = storage();
  if(!s) return [];
  try { var list = JSON.parse(s.getItem(KEY) || "[]"); return Array.isArray(list) ? list : []; } catch(e){ return []; }
}
export function clearErrorLog(){ var s = storage(); if(s) try { s.removeItem(KEY); } catch(e){} }

// One entry: { at (ISO time), kind ("error" | "promise"), message, where ("file.js:line"), version }.
// The same message from the same place within a minute counts once more rather than adding a line.
export function recordError(entry, now){
  var s = storage();
  if(!s) return null;
  var at = (now || new Date()).toISOString();
  var e = { at: at, kind: entry.kind || "error", message: String(entry.message || "Unknown error").slice(0, 300), where: String(entry.where || "").slice(0, 160), version: entry.version || "", count: 1 };
  var list = errorLog();
  var last = list[list.length - 1];
  if(last && last.message === e.message && last.where === e.where && Date.parse(at) - Date.parse(last.at) < 60000){ last.count = (last.count || 1) + 1; last.at = at; }
  else list.push(e);
  if(list.length > MAX_ERRORS) list = list.slice(-MAX_ERRORS);
  try { s.setItem(KEY, JSON.stringify(list)); } catch(err){ return null; }
  return e;
}

function shortWhere(file, line){
  if(!file) return "";
  var name = String(file).split("?")[0].split("/").pop();
  return name + (line ? ":" + line : "");
}
function appVersion(){
  try { var el = document.querySelector(".app-version-num"); return el ? el.textContent.trim() : ""; } catch(e){ return ""; }
}
export function installErrorLog(win){
  if(!win || typeof win.addEventListener !== "function" || win.__errorLogInstalled) return;
  win.__errorLogInstalled = true;
  win.addEventListener("error", function(ev){
    // A resource that failed to load (an image, a stylesheet) arrives here only when captured; uncaught
    // script errors carry a message.
    if(!ev || !ev.message) return;
    recordError({ kind: "error", message: ev.message, where: shortWhere(ev.filename, ev.lineno), version: appVersion() });
  });
  win.addEventListener("unhandledrejection", function(ev){
    var r = ev && ev.reason;
    var msg = r && r.message ? r.message : String(r);
    var where = r && r.stack ? (/([a-z0-9_-]+\.m?js)(?:\?[^:]*)?:(\d+)/i.exec(r.stack) || []).slice(1, 3).join(":") : "";
    recordError({ kind: "promise", message: msg, where: where, version: appVersion() });
  });
}

// For Settings: the list, newest first, with Copy and Clear — or nothing when there's nothing.
export function errorLogHtml(list, esc){
  list = list || [];
  if(!list.length) return "";
  var e = esc || function(s){ return String(s); };
  var rows = list.slice().reverse().map(function(x){
    return '<li><span class="el-when">' + e(String(x.at).slice(0, 16).replace("T", " ")) + '</span><span class="el-msg">' + e(x.message) + (x.count > 1 ? ' <small>×' + x.count + '</small>' : '') +
      '<small>' + e([x.where, x.version].filter(Boolean).join(" · ")) + '</small></span></li>';
  }).join("");
  return '<details class="sk-block el-log"><summary><b>Problems the app hit on this device</b> <small>(' + list.length + ')</small></summary>' +
    '<p class="ledger-note" style="margin:4px 0 8px">Errors in the app itself, kept only on this device and never with your data. If something didn\'t work, copying these into a bug report helps.</p>' +
    '<ul class="el-list">' + rows + '</ul>' +
    '<div class="el-actions"><button type="button" class="btn btn-sm" data-el-copy>Copy</button><button type="button" class="btn btn-sm btn-ghost" data-el-clear>Clear</button></div></details>';
}

if(typeof window !== "undefined") installErrorLog(window);
