// ---------------- Statements from a folder (v3.142.0, item 181) ----------------
//
// A bank, card or property manager statement dropped into the app's Statements folder — in Dropbox
// (Apps/<app name>/Statements) or in the synced folder backups go to — from any device, a phone's
// share sheet included. On opening, the app lists what's waiting; each one goes through the same
// importer as a file chosen by hand (rules, transfers, duplicates), so the review only asks about
// rows it can't place. Once imported a file moves to Statements/Imported, so it's never offered twice.
// Pure: which entries count, in what order, and the words. lib/inbox.js does the listing and moving.

export var INBOX_DIR = "Statements";
export var DONE_DIR = "Imported";

// A statement the importer can read: a CSV or a PDF, not a hidden or partial file.
export function isStatementName(name){
  name = String(name || "");
  if(!name || name.charAt(0) === "." || name.charAt(0) === "~") return false;
  return /\.(csv|pdf)$/i.test(name);
}

// entries: [{ name, modified, size, … }] → the statements, oldest first (the order they happened in,
// so a later statement's duplicate check sees the earlier one already imported), then by name.
export function statementFiles(entries){
  return (entries || []).filter(function(e){ return e && isStatementName(e.name) && !(e.size === 0); })
    .slice().sort(function(a, b){
      var ma = String(a.modified || ""), mb = String(b.modified || "");
      if(ma !== mb) return ma < mb ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
}

// "2 statements are waiting in Dropbox"
export function inboxMessage(count, where){
  if(!count) return "";
  return (count === 1 ? "A statement is" : count + " statements are") + " waiting in " + (where || "the Statements folder");
}
