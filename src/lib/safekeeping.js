import { state, persist, deviceId } from "../state.js";
import { localDateStr } from "./format.js";

// ---------------- Safekeeping (v3.63.0): backups to a folder, and a passcode ----------------
//
// Everything lives in this browser's storage, so the two real risks are losing it (cleared site
// data, a new phone) and someone else opening it on a shared device. A downloaded backup only helps
// if someone remembers to make one; a folder backup writes one by itself, at most weekly, to a
// folder the person picked (a synced Dropbox/OneDrive/iCloud folder makes it off-device too). It
// needs the File System Access API — Chrome and Edge on a computer; elsewhere the option says so.
//
// The passcode is a lock screen, not encryption: it stops a casual look on a shared computer, but
// the data in browser storage is still readable by anyone with access to the device's files. The
// settings page says exactly that. Stored as a salted SHA-256 hash in localStorage (per device),
// never in state, so it never travels in a backup.
var DB = "wealthPlanner.fs", STORE = "handles", KEY = "backupDir";
var PASS_KEY = "wealthPlanner.passcode";
var WEEK = 7;

export function folderBackupSupported(){ return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined"; }

export function idb(mode, fn){
  return new Promise(function(resolve, reject){
    var req = indexedDB.open(DB, 1);
    req.onupgradeneeded = function(){ req.result.createObjectStore(STORE); };
    req.onerror = function(){ reject(req.error); };
    req.onsuccess = function(){
      var tx = req.result.transaction(STORE, mode);
      var r = fn(tx.objectStore(STORE));
      tx.oncomplete = function(){ resolve(r && r.result); };
      tx.onerror = function(){ reject(tx.error); };
    };
  });
}
export function savedFolder(){ return folderBackupSupported() ? idb("readonly", function(s){ return s.get(KEY); }).catch(function(){ return null; }) : Promise.resolve(null); }
export function chooseFolder(){
  return window.showDirectoryPicker({ mode: "readwrite", id: "wealth-planner-backups" }).then(function(handle){
    return idb("readwrite", function(s){ return s.put(handle, KEY); }).then(function(){ return handle; });
  });
}
export function forgetFolder(){ return idb("readwrite", function(s){ return s.delete(KEY); }); }

// Writes today's backup into the folder. `interactive` may ask for permission (needs a click).
export function backupToFolder(interactive){
  return savedFolder().then(function(handle){
    if(!handle) return { ok: false, reason: "no-folder" };
    var opts = { mode: "readwrite" };
    return handle.queryPermission(opts).then(function(p){
      if(p === "granted") return p;
      return interactive ? handle.requestPermission(opts) : p;
    }).then(function(p){
      if(p !== "granted") return { ok: false, reason: "permission", folder: handle.name };
      // Time and device in the name (v3.71.0): two devices backing up the same day must not
      // overwrite each other's file.
      var now = new Date();
      var stamp = localDateStr() + "-" + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
      var name = "wealth-planner-backup-" + stamp + "-" + deviceId().slice(-4) + ".json";
      state.lastBackupDate = localDateStr();
      state.lastFolderBackup = localDateStr();
      if(!state.savedAt) state.savedAt = now.toISOString();
      state.savedBy = deviceId();
      var body = JSON.stringify(state, null, 2);
      return handle.getFileHandle(name, { create: true }).then(function(fh){ return fh.createWritable(); })
        .then(function(w){ return w.write(body).then(function(){ return w.close(); }); })
        .then(function(){ persist(); return { ok: true, name: name, folder: handle.name }; });
    });
  });
}
// On load: a quiet weekly backup when the folder's permission is still granted.
export function maybeAutoBackup(today){
  today = today || localDateStr();
  var last = state.lastFolderBackup;
  if(last && Math.round((Date.parse(today) - Date.parse(last)) / 86400000) < WEEK) return Promise.resolve({ ok: false, reason: "recent" });
  return backupToFolder(false).catch(function(){ return { ok: false, reason: "error" }; });
}

// ---------------- Passcode ----------------
function hex(buf){ return Array.prototype.map.call(new Uint8Array(buf), function(b){ return b.toString(16).padStart(2, "0"); }).join(""); }
export function hashPasscode(code, salt){
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + code)).then(hex);
}
function readPass(){ try { return JSON.parse(localStorage.getItem(PASS_KEY) || "null"); } catch(e){ return null; } }
export function passcodeSet(){ return !!readPass(); }
export function setPasscode(code){
  var salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return hashPasscode(code, salt).then(function(h){ localStorage.setItem(PASS_KEY, JSON.stringify({ salt: salt, hash: h })); });
}
export function clearPasscode(){ try { localStorage.removeItem(PASS_KEY); } catch(e){} }
export function checkPasscode(code){
  var p = readPass();
  if(!p) return Promise.resolve(true);
  return hashPasscode(code, p.salt).then(function(h){ return h === p.hash; });
}

// ---------------- Restoring from the folder (v3.71.0) ----------------
// The newest backup in the chosen folder, read: { name, savedAt, savedBy, text, fromThisDevice,
// newerThanHere }. "Newest" is by the savedAt inside the file (when that copy last changed), falling
// back to the file's own modified time for backups made before savedAt existed.
export function newestFolderBackup(interactive){
  return savedFolder().then(function(handle){
    if(!handle) return null;
    var opts = { mode: "read" };
    return handle.queryPermission(opts).then(function(p){ return p === "granted" ? p : (interactive ? handle.requestPermission(opts) : p); }).then(function(p){
      if(p !== "granted") return { permission: false, folder: handle.name };
      var files = [];
      var it = handle.values();
      function next(){
        return it.next().then(function(r){
          if(r.done) return files;
          var e = r.value;
          if(e.kind === "file" && /^wealth-planner-backup-.*\.json$/i.test(e.name)) files.push(e);
          return next();
        });
      }
      return next().then(function(list){
        return Promise.all(list.map(function(fh){ return fh.getFile().then(function(f){ return { handle: fh, file: f }; }); }));
      }).then(function(all){
        if(!all.length) return { folder: handle.name, none: true };
        all.sort(function(a, b){ return b.file.lastModified - a.file.lastModified; });
        // Read the few most recent and pick by savedAt.
        return Promise.all(all.slice(0, 5).map(function(x){ return x.file.text().then(function(t){ return { name: x.file.name, text: t, modified: x.file.lastModified }; }); })).then(function(read){
          var parsed = read.map(function(r){
            var j = null; try { j = JSON.parse(r.text); } catch(e){}
            return { name: r.name, text: r.text, savedAt: (j && j.savedAt) || new Date(r.modified).toISOString(), savedBy: j && j.savedBy || "", encrypted: !!(j && j.wealthPlannerEncrypted) };
          }).sort(function(a, b){ return a.savedAt < b.savedAt ? 1 : -1; });
          var best = parsed[0];
          return Object.assign(best, { folder: handle.name, fromThisDevice: best.savedBy === deviceId(),
            newerThanHere: !state.savedAt || best.savedAt > state.savedAt });
        });
      });
    });
  });
}
// Which of two copies is newer, in words, for the confirm before a restore replaces this one.
export function compareCopies(incomingSavedAt){
  if(!incomingSavedAt || !state.savedAt) return "unknown";
  return incomingSavedAt > state.savedAt ? "incoming" : incomingSavedAt < state.savedAt ? "here" : "same";
}
