// ---------------- Sync through a synced folder (v3.134.0) ----------------
//
// Item 163, the first way: the folder backups already write to a folder the person picked, and a
// Dropbox, OneDrive or iCloud Drive folder carries it to their other computers. Sync keeps one file
// there, wealth-planner-sync.json, always encrypted, rewritten shortly after each change; each device
// reads it on opening. One copy is the truth (since v3.143.0 a conflict is merged — calc/syncmerge.js):
//
//   the file carries `rev` (a counter) and, in the clear, when and by which device it was written;
//   each device remembers `base`, the rev it last wrote or loaded, and whether it has changed since.
//   file rev == base, nothing changed here since  → nothing to do
//   file rev == base, changed here since          → write ours (rev + 1)
//   file rev  > base, nothing changed here since  → load theirs
//   file rev  > base, changed here too            → conflict: merge (or, with no agreed copy, ask)
//   no file yet                                   → write ours
// Pure: the envelope's shape and that decision. lib/foldersync.js does the files and the crypto.

export var SYNC_FILE = "wealth-planner-sync.json";

// local: { base, dirty } (this device's memory: the rev it last wrote or loaded, and whether anything
// changed here since); file: the envelope's clear fields { rev, savedAt, savedBy } or null.
// A device that has never synced, meeting a file, has to ask: it may be a new device with nothing on
// it (load theirs) or an old one with a different history (either could be the one to keep).
export function syncDecision(local, file){
  local = local || {};
  var base = Number(local.base) || 0, changedHere = !!local.dirty;
  if(!file) return "push";
  if(!base) return "conflict";
  var rev = Number(file.rev) || 0;
  if(rev <= base) return changedHere ? "push" : "same"; // rev < base: the folder was rolled back; ours is newer
  return changedHere ? "conflict" : "pull";
}

// The file: what's readable without the passphrase is only when, by which device and which rev.
export function makeEnvelope(meta, crypt){
  return { wealthPlannerSync: 1, rev: meta.rev, savedAt: meta.savedAt, savedBy: meta.savedBy,
    salt: crypt.salt, iv: crypt.iv, ciphertext: crypt.ciphertext };
}
export function readEnvelope(text){
  var j = null;
  try { j = JSON.parse(text); } catch(e){ return null; }
  if(!j || j.wealthPlannerSync !== 1 || !j.ciphertext || !j.salt || !j.iv) return null;
  return j;
}

// What counts as a change worth syncing: the state without when/where it was saved and the price
// readers' bookkeeping — a save that only stamps those (opening the app, a price check that found
// nothing new) mustn't make two devices look as if both had been edited. FNV-1a over the JSON.
var VOLATILE = { savedAt: 1, savedBy: 1, autoPrices: 1, lastFolderBackup: 1, lastBackupDate: 1 };
export function contentHash(st){
  var json = JSON.stringify(st, function(k, v){
    if(this === st && VOLATILE[k]) return undefined;
    if(k === "lastRead" || k === "lastResult") return undefined;
    return v;
  });
  var h = 0x811c9dc5;
  for(var i = 0; i < json.length; i++){ h ^= json.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16) + ":" + json.length;
}
